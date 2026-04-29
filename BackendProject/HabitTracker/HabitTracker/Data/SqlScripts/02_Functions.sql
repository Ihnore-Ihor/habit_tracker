-- ============================================================================
-- 02_Functions.sql
-- Purpose : Helper and business-logic functions used by triggers, views,
--           materialized views, and stored procedures.
-- Applied : on Up() of AddDatabaseObjects migration, before 03_Triggers.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- update_updated_at_column()
-- Generic before-update trigger function that sets `updated_at = NOW()`.
-- Attached to the `users` table via trg_users_updated_at (see 03_Triggers).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------------------------
-- fn_soft_delete()
-- Generic BEFORE DELETE trigger body. Intercepts the DELETE and converts it
-- to `UPDATE <table> SET is_archived = true WHERE id = OLD.id`, preserving
-- historical rows for analytics and referential integrity.
--
-- Bypass: SET LOCAL app.bypass_soft_delete = 'true' inside a transaction
-- (used by the GDPR user-deletion flow, where a genuine hard DELETE IS
-- required so that a User cascade can scrub every trace of the account).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('app.bypass_soft_delete', true) = 'true' THEN
        RETURN OLD;  -- allow the real delete to proceed
    END IF;

    EXECUTE format('UPDATE %I SET is_archived = true WHERE id = $1', TG_TABLE_NAME)
        USING OLD.id;

    RETURN NULL;  -- suppress the original DELETE
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------------------------
-- fn_on_habit_execution()
-- AFTER INSERT trigger on habit_executions. Maintains O(1) streak counters
-- on the parent user_habits row. Polarity-dependent per A7:
--   Yang (is_negative = false): execution ⇒ current_streak++.
--   Yin  (is_negative = true) : execution ⇒ current_streak := 0 (failure event).
--
-- NOTE: this trigger handles the "execution happened" side of the streak.
-- The "day passed without execution" side is handled by
-- sp_daily_streak_maintenance (06_StoredProcedures.sql).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_on_habit_execution()
RETURNS TRIGGER AS $$
DECLARE
    v_is_negative BOOLEAN;
    v_target_value NUMERIC;
    v_sum_prior NUMERIC;
    v_sum_total NUMERIC;
BEGIN
    SELECT is_negative, COALESCE(target_value, 1) INTO v_is_negative, v_target_value
    FROM public.user_habits WHERE id = NEW.user_habit_id;

    SELECT COALESCE(SUM(logged_value), 0) INTO v_sum_prior
    FROM public.habit_executions
    WHERE user_habit_id = NEW.user_habit_id 
      AND DATE(execution_time AT TIME ZONE 'UTC') = DATE(NEW.execution_time AT TIME ZONE 'UTC')
      AND id != NEW.id;

    v_sum_total := v_sum_prior + NEW.logged_value;

    IF v_is_negative = false THEN
        IF v_sum_prior < v_target_value AND v_sum_total >= v_target_value THEN
            UPDATE public.user_habits 
            SET current_streak = current_streak + 1,
                longest_streak = GREATEST(longest_streak, current_streak + 1)
            WHERE id = NEW.user_habit_id;
            
        ELSIF v_sum_prior >= v_target_value AND v_sum_total < v_target_value THEN
            UPDATE public.user_habits 
            SET current_streak = GREATEST(0, current_streak - 1)
            WHERE id = NEW.user_habit_id;
        END IF;
    ELSE
        IF v_sum_prior <= 0 AND v_sum_total > 0 THEN
            -- Failure event: reset current streak to 0.
            UPDATE public.user_habits SET current_streak = 0 WHERE id = NEW.user_habit_id;
        ELSIF v_sum_prior > 0 AND v_sum_total <= 0 THEN
            -- Undo event: recalculate the current streak from history.
            -- This restores the streak if the only failure for that day was negated.
            UPDATE public.user_habits 
            SET current_streak = public.fn_calc_current_streak(id, true, NULL)
            WHERE id = NEW.user_habit_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------------------------
-- fn_is_habit_scheduled(text, jsonb, date) -> boolean
-- Parses the JSONB schedule_rule (owned value object — PascalCase keys
-- matching the C# ScheduleRule POCO) and answers whether the habit is
-- scheduled on the given local date. Used by sp_daily_streak_maintenance
-- and vw_user_daily_summary.
--
-- DayOfWeek semantics: both System.DayOfWeek (Sunday=0) and Postgres DOW
-- (Sunday=0) share the same convention — no translation required.
--
-- Fallback behaviour:
--   Daily   - always true.
--   Weekly  - true if DaysOfWeek is null/missing (interpreted as every day)
--             or contains the date's DOW.
--   Monthly - requires DayOfMonth.
--   Once    - requires OneTimeDate.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_is_habit_scheduled(
    p_frequency TEXT,
    p_schedule JSONB,
    p_date DATE
) RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE AS $$
DECLARE
    v_days          JSONB;
    v_day_of_month  INT;
    v_one_time_date DATE;
    v_target_dow    INT;
BEGIN
    CASE p_frequency
        WHEN 'daily' THEN
            RETURN TRUE;

        WHEN 'weekly' THEN
            IF p_schedule IS NULL OR p_schedule->'DaysOfWeek' IS NULL
               OR jsonb_typeof(p_schedule->'DaysOfWeek') <> 'array' THEN
                RETURN TRUE;
            END IF;
            v_days := p_schedule->'DaysOfWeek';
            v_target_dow := EXTRACT(DOW FROM p_date)::INT;
            RETURN v_days @> to_jsonb(v_target_dow);

        WHEN 'monthly' THEN
            v_day_of_month := NULLIF(p_schedule->>'DayOfMonth', '')::INT;
            IF v_day_of_month IS NULL THEN
                RETURN FALSE;
            END IF;
            RETURN EXTRACT(DAY FROM p_date)::INT = v_day_of_month;

        WHEN 'once' THEN
            v_one_time_date := NULLIF(p_schedule->>'OneTimeDate', '')::DATE;
            RETURN v_one_time_date IS NOT NULL AND v_one_time_date = p_date;

        ELSE
            RETURN FALSE;
    END CASE;
EXCEPTION WHEN OTHERS THEN
    -- Malformed JSON → conservative "not scheduled".
    RETURN FALSE;
END;
$$;


-- ---------------------------------------------------------------------------
-- fn_calculate_daily_affect_centroid(uuid, date)
-- Returns six NUMERICs per axis — the time-weighted centroid (Trapezoidal
-- AUC over the awake window divided by its duration) AND the Peak-End
-- "remembered" value, per A3.
--
-- Window:
--   Primary  : wake_time .. sleep_time from sleep_logs on the given local day.
--              Wake  = MAX(sleep_end)   whose end   falls on p_date local.
--              Sleep = MIN(sleep_start) whose start falls on p_date local
--                      AND is after wake.
--   Fallback : midnight .. midnight in the user's local timezone.
--
-- Algorithm per axis:
--   Centroid (AUC)    : trapezoidal integration with implicit hold-before and
--                       hold-after (signal constant outside sampled range),
--                       divided by the full window duration in seconds.
--   Peak              : sample with maximum |value|; signed value kept.
--   End               : last sample within 4 hours before window end;
--                       fallback to the final sample of the window.
--   Remembered (PE)   : (peak + end) / 2.
--
-- Special case:
--   Zero entries  → returns NULLs (distinguishable from "real zero").
--   One entry     → Centroid = Remembered = that value (A3.e).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_calculate_daily_affect_centroid(
    p_user_id UUID,
    p_date DATE
) RETURNS TABLE (
    p_centroid   NUMERIC,
    p_remembered NUMERIC,
    a_centroid   NUMERIC,
    a_remembered NUMERIC,
    d_centroid   NUMERIC,
    d_remembered NUMERIC
)
LANGUAGE plpgsql
STABLE AS $$
DECLARE
    v_tz            TEXT;
    v_wake          TIMESTAMPTZ;
    v_sleep         TIMESTAMPTZ;
    v_window_start  TIMESTAMPTZ;
    v_window_end    TIMESTAMPTZ;
    v_end_boundary  TIMESTAMPTZ;
    v_duration      NUMERIC;
    v_count         INT;
    v_times         TIMESTAMPTZ[];
    v_p             NUMERIC[];
    v_a             NUMERIC[];
    v_d             NUMERIC[];
    v_auc_p         NUMERIC := 0;
    v_auc_a         NUMERIC := 0;
    v_auc_d         NUMERIC := 0;
    v_peak_p        NUMERIC;
    v_peak_a        NUMERIC;
    v_peak_d        NUMERIC;
    v_end_p         NUMERIC;
    v_end_a         NUMERIC;
    v_end_d         NUMERIC;
    i               INT;
BEGIN
    -- ---- 1. Resolve user timezone ----
    SELECT COALESCE(timezone, 'UTC') INTO v_tz FROM users WHERE id = p_user_id;
    IF v_tz IS NULL THEN
        v_tz := 'UTC';
    END IF;

    -- ---- 2. Determine the awake window ----
    SELECT MAX(sleep_end) INTO v_wake
    FROM sleep_logs
    WHERE user_id = p_user_id
      AND (sleep_end AT TIME ZONE v_tz)::DATE = p_date;

    SELECT MIN(sleep_start) INTO v_sleep
    FROM sleep_logs
    WHERE user_id = p_user_id
      AND (sleep_start AT TIME ZONE v_tz)::DATE = p_date
      AND (v_wake IS NULL OR sleep_start > v_wake);

    IF v_wake IS NOT NULL AND v_sleep IS NOT NULL THEN
        v_window_start := v_wake;
        v_window_end   := v_sleep;
        v_end_boundary := v_sleep - INTERVAL '4 hours';
    ELSE
        v_window_start := (p_date::TIMESTAMP AT TIME ZONE v_tz);
        v_window_end   := ((p_date + 1)::TIMESTAMP AT TIME ZONE v_tz);
        v_end_boundary := v_window_end - INTERVAL '4 hours';
    END IF;

    v_duration := EXTRACT(EPOCH FROM (v_window_end - v_window_start));
    IF v_duration IS NULL OR v_duration <= 0 THEN
        RETURN QUERY SELECT NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
                            NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC;
        RETURN;
    END IF;

    -- ---- 3. Pull sorted samples into parallel arrays ----
    SELECT
        ARRAY_AGG(recorded_at        ORDER BY recorded_at),
        ARRAY_AGG(pleasure_score::NUMERIC  ORDER BY recorded_at),
        ARRAY_AGG(arousal_score::NUMERIC   ORDER BY recorded_at),
        ARRAY_AGG(dominance_score::NUMERIC ORDER BY recorded_at)
    INTO v_times, v_p, v_a, v_d
    FROM affect_entries
    WHERE user_id = p_user_id
      AND recorded_at >= v_window_start
      AND recorded_at <  v_window_end;

    v_count := COALESCE(array_length(v_times, 1), 0);

    IF v_count = 0 THEN
        RETURN QUERY SELECT NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
                            NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC;
        RETURN;
    END IF;

    IF v_count = 1 THEN
        -- Per A3.e: single entry used as both centroid and peak-end.
        RETURN QUERY SELECT v_p[1], v_p[1], v_a[1], v_a[1], v_d[1], v_d[1];
        RETURN;
    END IF;

    -- ---- 4. Trapezoidal AUC per axis with hold-before / hold-after ----
    -- Before first sample: signal constant at v_*[1]  from v_window_start .. v_times[1]
    v_auc_p := v_p[1] * EXTRACT(EPOCH FROM (v_times[1] - v_window_start));
    v_auc_a := v_a[1] * EXTRACT(EPOCH FROM (v_times[1] - v_window_start));
    v_auc_d := v_d[1] * EXTRACT(EPOCH FROM (v_times[1] - v_window_start));

    FOR i IN 1..v_count - 1 LOOP
        v_auc_p := v_auc_p + EXTRACT(EPOCH FROM (v_times[i+1] - v_times[i]))
                             * (v_p[i] + v_p[i+1]) / 2.0;
        v_auc_a := v_auc_a + EXTRACT(EPOCH FROM (v_times[i+1] - v_times[i]))
                             * (v_a[i] + v_a[i+1]) / 2.0;
        v_auc_d := v_auc_d + EXTRACT(EPOCH FROM (v_times[i+1] - v_times[i]))
                             * (v_d[i] + v_d[i+1]) / 2.0;
    END LOOP;

    -- After last sample: signal constant at v_*[v_count] from v_times[v_count] .. v_window_end
    v_auc_p := v_auc_p + v_p[v_count] * EXTRACT(EPOCH FROM (v_window_end - v_times[v_count]));
    v_auc_a := v_auc_a + v_a[v_count] * EXTRACT(EPOCH FROM (v_window_end - v_times[v_count]));
    v_auc_d := v_auc_d + v_d[v_count] * EXTRACT(EPOCH FROM (v_window_end - v_times[v_count]));

    -- ---- 5. Peak per axis (max |value|, earliest sample wins ties) ----
    SELECT v_p[idx] INTO v_peak_p
    FROM generate_subscripts(v_p, 1) AS idx
    ORDER BY ABS(v_p[idx]) DESC, idx ASC
    LIMIT 1;

    SELECT v_a[idx] INTO v_peak_a
    FROM generate_subscripts(v_a, 1) AS idx
    ORDER BY ABS(v_a[idx]) DESC, idx ASC
    LIMIT 1;

    SELECT v_d[idx] INTO v_peak_d
    FROM generate_subscripts(v_d, 1) AS idx
    ORDER BY ABS(v_d[idx]) DESC, idx ASC
    LIMIT 1;

    -- ---- 6. End per axis (last sample within 4h before window end; else last overall) ----
    SELECT v_p[idx], v_a[idx], v_d[idx] INTO v_end_p, v_end_a, v_end_d
    FROM generate_subscripts(v_times, 1) AS idx
    WHERE v_times[idx] >= v_end_boundary
    ORDER BY v_times[idx] DESC
    LIMIT 1;

    IF v_end_p IS NULL THEN
        v_end_p := v_p[v_count];
        v_end_a := v_a[v_count];
        v_end_d := v_d[v_count];
    END IF;

    -- ---- 7. Emit centroid + peak-end per axis ----
    RETURN QUERY SELECT
        (v_auc_p / v_duration)::NUMERIC,
        ((v_peak_p + v_end_p) / 2.0)::NUMERIC,
        (v_auc_a / v_duration)::NUMERIC,
        ((v_peak_a + v_end_a) / 2.0)::NUMERIC,
        (v_auc_d / v_duration)::NUMERIC,
        ((v_peak_d + v_end_d) / 2.0)::NUMERIC;
END;
$$;
