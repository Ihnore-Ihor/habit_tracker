-- ============================================================================
-- 07_StreakFunctions.sql
-- Purpose : Dynamic, on-the-fly streak calculation functions.
--
-- WHY these exist
-- ───────────────
-- The static current_streak column on user_habits is maintained by two
-- co-operating agents:
--   • trg_on_habit_execution  — fires per INSERT, handles the "success/fail
--                               logged today" side.
--   • sp_daily_streak_maintenance — runs nightly, handles the "day passed
--                               without a log" side.
-- During bulk seeding (months of history inserted in one go) the nightly job
-- has never run, so Yin (negative) habit streaks stay at zero and Yang
-- (positive) habit streaks drift because the trigger counts every target-
-- crossing without verifying that the prior day was also consecutive.
--
-- The functions below compute the correct value directly from habit_executions.
-- vw_user_habit_stats uses fn_calc_current_streak so the Dashboard and
-- Analytics always show the true streak, even immediately after seeding.
-- sp_resync_streaks (08_StreakResyncProc.sql) uses both functions to
-- back-fill the static column so that the nightly job continues from a
-- correct baseline.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- fn_calc_current_streak(p_user_habit_id, p_is_negative, p_timezone)
--
-- Yang (is_negative = false)
--   Counts consecutive local days, going backwards from today, on which the
--   habit's daily logged_value SUM met or exceeded target_value.
--   "Grace" rule: if today has no execution yet the check starts from
--   yesterday — the user still has time to complete it without breaking their
--   streak.
--
-- Yin (is_negative = true)
--   Returns (today_local − last_failure_date_local) in whole days.
--   No failures ever recorded → 0 (habit was just created or never failed).
--   A failure logged today → 0.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_calc_current_streak(
    p_user_habit_id UUID,
    p_is_negative   BOOLEAN,
    p_timezone      TEXT
) RETURNS INTEGER
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_tz         TEXT    := COALESCE(NULLIF(TRIM(p_timezone), ''), 'UTC');
    v_today      DATE    := (NOW() AT TIME ZONE v_tz)::DATE;
    v_target_val NUMERIC;
    v_streak     INT     := 0;
    v_check      DATE;
    v_daily_sum  NUMERIC;
BEGIN
    -- ── Yin path ──────────────────────────────────────────────────────────
    -- Only days where SUM(logged_value) > 0 count as failures. An undo entry
    -- (negative logged_value) brings the daily net to ≤ 0, restoring the day.
    IF p_is_negative THEN
        DECLARE
            v_start_date DATE;
            v_last_fail  DATE;
        BEGIN
            SELECT (MIN(execution_time) AT TIME ZONE v_tz)::DATE INTO v_start_date
            FROM   habit_executions
            WHERE  user_habit_id = p_user_habit_id;

            IF v_start_date IS NULL THEN
                v_start_date := v_today;
            END IF;


            SELECT MAX(fail_date) INTO v_last_fail
            FROM (
                SELECT (he.execution_time AT TIME ZONE v_tz)::DATE AS fail_date
                FROM   habit_executions he
                WHERE  he.user_habit_id = p_user_habit_id
                GROUP  BY (he.execution_time AT TIME ZONE v_tz)::DATE
                HAVING SUM(he.logged_value) > 0
            ) net_failures;

            IF v_last_fail IS NOT NULL THEN
                RETURN GREATEST(0, v_today - v_last_fail);
            ELSE
                RETURN GREATEST(0, v_today - v_start_date);
            END IF;
        END;
    END IF;

    -- ── Yang path ─────────────────────────────────────────────────────────
    SELECT COALESCE(uh.target_value, 1)
    INTO   v_target_val
    FROM   user_habits uh
    WHERE  uh.id = p_user_habit_id;

    -- Start from today when the target has been met today; else start from
    -- yesterday so an in-progress day does not reset the streak display.
    SELECT COALESCE(SUM(he.logged_value), 0)
    INTO   v_daily_sum
    FROM   habit_executions he
    WHERE  he.user_habit_id = p_user_habit_id
      AND  (he.execution_time AT TIME ZONE v_tz)::DATE = v_today;

    v_check := CASE WHEN v_daily_sum >= v_target_val THEN v_today
                    ELSE v_today - 1
               END;

    -- Walk backwards while each day's sum meets the target.
    LOOP
        SELECT COALESCE(SUM(he.logged_value), 0)
        INTO   v_daily_sum
        FROM   habit_executions he
        WHERE  he.user_habit_id = p_user_habit_id
          AND  (he.execution_time AT TIME ZONE v_tz)::DATE = v_check;

        EXIT WHEN v_daily_sum < v_target_val;

        v_streak := v_streak + 1;
        v_check  := v_check - 1;
    END LOOP;

    RETURN v_streak;
END;
$$;


-- ---------------------------------------------------------------------------
-- fn_calc_longest_streak(p_user_habit_id, p_is_negative, p_timezone)
--
-- Yang: longest unbroken run of consecutive local-days where target was met.
--       Uses the "subtract row-number" gaps-and-islands trick — O(n log n).
--
-- Yin:  longest gap (in whole days) between any two consecutive failure logs,
--       OR between the last failure and today — whichever is largest.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_calc_longest_streak(
    p_user_habit_id UUID,
    p_is_negative   BOOLEAN,
    p_timezone      TEXT
) RETURNS INTEGER
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_tz         TEXT    := COALESCE(NULLIF(TRIM(p_timezone), ''), 'UTC');
    v_today      DATE    := (NOW() AT TIME ZONE v_tz)::DATE;
    v_target_val NUMERIC;
    v_longest    INT     := 0;
BEGIN
    -- ── Yin path ──────────────────────────────────────────────────────────
    -- Same net-sum filter: only SUM > 0 days are failures.
    IF p_is_negative THEN
        DECLARE
            v_start_date DATE;
        BEGIN
            SELECT (MIN(execution_time) AT TIME ZONE v_tz)::DATE INTO v_start_date
            FROM   habit_executions
            WHERE  user_habit_id = p_user_habit_id;

            IF v_start_date IS NULL THEN
                v_start_date := v_today;
            END IF;


            SELECT COALESCE(MAX(gap), 0)
            INTO   v_longest
            FROM (
                -- Gap between start and first failure
                SELECT (MIN(fail_date) - v_start_date) AS gap
                FROM (
                    SELECT (he.execution_time AT TIME ZONE v_tz)::DATE AS fail_date
                    FROM   habit_executions he
                    WHERE  he.user_habit_id = p_user_habit_id
                    GROUP  BY (he.execution_time AT TIME ZONE v_tz)::DATE
                    HAVING SUM(he.logged_value) > 0
                ) first_fail
                UNION ALL
                -- Gaps between failures
                SELECT (LEAD(fail_date) OVER (ORDER BY fail_date) - fail_date - 1) AS gap
                FROM (
                    SELECT (he.execution_time AT TIME ZONE v_tz)::DATE AS fail_date
                    FROM   habit_executions he
                    WHERE  he.user_habit_id = p_user_habit_id
                    GROUP  BY (he.execution_time AT TIME ZONE v_tz)::DATE
                    HAVING SUM(he.logged_value) > 0
                ) fd
                UNION ALL
                -- Gap between last failure and today
                SELECT (v_today - MAX(fail_date)) AS gap
                FROM (
                    SELECT (he.execution_time AT TIME ZONE v_tz)::DATE AS fail_date
                    FROM   habit_executions he
                    WHERE  he.user_habit_id = p_user_habit_id
                    GROUP  BY (he.execution_time AT TIME ZONE v_tz)::DATE
                    HAVING SUM(he.logged_value) > 0
                ) last_fail
                UNION ALL
                -- Case: No failures ever recorded (gap = today - start)
                SELECT (v_today - v_start_date) AS gap
                WHERE NOT EXISTS (
                    SELECT 1 FROM habit_executions he
                    WHERE he.user_habit_id = p_user_habit_id
                    GROUP BY (he.execution_time AT TIME ZONE v_tz)::DATE
                    HAVING SUM(he.logged_value) > 0
                )
            ) gaps
            WHERE gap IS NOT NULL AND gap >= 0;

            RETURN v_longest;
        END;
    END IF;

    -- ── Yang path ─────────────────────────────────────────────────────────
    SELECT COALESCE(uh.target_value, 1)
    INTO   v_target_val
    FROM   user_habits uh
    WHERE  uh.id = p_user_habit_id;

    -- Gaps-and-islands: group consecutive successful days by subtracting their
    -- ordinal rank from the date value; same island ⟺ same difference.
    SELECT COALESCE(MAX(island_len), 0)
    INTO   v_longest
    FROM (
        SELECT COUNT(*) AS island_len
        FROM (
            SELECT d,
                   d - ROW_NUMBER() OVER (ORDER BY d)::INT AS grp
            FROM (
                SELECT (he.execution_time AT TIME ZONE v_tz)::DATE AS d
                FROM   habit_executions he
                WHERE  he.user_habit_id = p_user_habit_id
                GROUP  BY (he.execution_time AT TIME ZONE v_tz)::DATE
                HAVING SUM(he.logged_value) >= v_target_val
            ) successful_days
        ) labelled
        GROUP BY grp
    ) islands;

    RETURN v_longest;
END;
$$;
