-- ============================================================================
-- 06_StoredProcedures.sql
-- Purpose : Scheduled / event-driven procedures that maintain streaks and
--           achievement progress.
-- Depends : fn_is_habit_scheduled (02_Functions.sql).
-- ============================================================================


-- ---------------------------------------------------------------------------
-- sp_daily_streak_maintenance
-- Hourly background job. For each active user_habit, evaluates "did the
-- habit's previous local day pass as expected?" and applies the right
-- streak transition per A7:
--   Yang (is_negative = false):
--       scheduled & executed      → handled by trg_on_habit_execution (++)
--       scheduled & NOT executed  → current_streak := 0
--       not scheduled             → no-op
--   Yin (is_negative = true):
--       not executed on day       → current_streak += 1 (day survived clean)
--       executed on day           → handled by trg_on_habit_execution (reset)
-- longest_streak watermarks off current_streak for BOTH polarities.
--
-- "Previous local day" is derived from each user's timezone so the procedure
-- can run at any UTC hour safely (it will only act on users whose local
-- calendar day has just flipped).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_daily_streak_maintenance()
LANGUAGE plpgsql AS $$
DECLARE
    r RECORD;
    v_local_today       DATE;
    v_local_yesterday   DATE;
    v_executed          BOOLEAN;
    v_scheduled         BOOLEAN;
BEGIN
    FOR r IN
        SELECT uh.id,
               uh.user_id,
               uh.is_negative,
               uh.frequency_type::TEXT AS frequency_type,
               uh.schedule_rule,
               COALESCE(u.timezone, 'UTC') AS tz
        FROM user_habits uh
        JOIN users u ON u.id = uh.user_id
        WHERE uh.is_archived = false
    LOOP
        v_local_today     := (NOW() AT TIME ZONE r.tz)::DATE;
        v_local_yesterday := v_local_today - INTERVAL '1 day';

        v_scheduled := fn_is_habit_scheduled(r.frequency_type, r.schedule_rule, v_local_yesterday::DATE);

        SELECT EXISTS (
            SELECT 1
            FROM habit_executions he
            WHERE he.user_habit_id = r.id
              AND (he.execution_time AT TIME ZONE r.tz)::DATE = v_local_yesterday::DATE
        ) INTO v_executed;

        IF r.is_negative THEN
            -- Yin: a clean (un-executed) day is a success regardless of schedule.
            IF NOT v_executed THEN
                UPDATE user_habits
                SET current_streak = current_streak + 1,
                    longest_streak = GREATEST(longest_streak, current_streak + 1)
                WHERE id = r.id;
            END IF;
        ELSE
            -- Yang: reset only if the habit was scheduled for yesterday AND was missed.
            IF v_scheduled AND NOT v_executed THEN
                UPDATE user_habits
                SET current_streak = 0
                WHERE id = r.id;
            END IF;
        END IF;
    END LOOP;
END;
$$;


-- ---------------------------------------------------------------------------
-- sp_update_achievement_progress
-- Event-driven procedure called by the application after relevant events
-- (execution inserted, streak updated, sleep logged, etc.). Recomputes
-- progress for every achievement whose `condition_key` matches and whose
-- optional `habit_id` scope is compatible.
--
-- CAVEAT: Only four of the thirteen condition_key values have formulas that
-- can be derived unambiguously from the spec and schema today. The remaining
-- nine are intentionally left as no-ops (progress := 0) with a visible NOTICE
-- so they won't silently misbehave until the business formulas are defined.
--
--   Implemented here:
--     POSITIVE_STREAK           max(current_streak) on positive habits
--     NEGATIVE_STREAK           max(current_streak) on negative habits
--     TOTAL_METRIC_VOLUME       sum(logged_value)    on matching habits
--     FIRST_ACTION              boolean — any execution exists for user
--
--   Pending clarification (formulas required before implementation):
--     PERFECT_DAY_STREAK, ANY_X_HABITS_STREAK, SYNERGY_COMBO,
--     CATEGORY_TOTAL_EXECUTIONS, TIME_SLOT_STREAK,
--     CONSISTENT_BEDTIME_STREAK, SLEEP_DEBT_CLEARED,
--     AFFECT_STABILITY, AFFECT_HIGH_DOMINANCE.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_update_achievement_progress(
    p_user_id UUID,
    p_condition_key condition_key,
    p_habit_id INT DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    r               RECORD;
    v_progress      INT;
    v_was_unlocked  BOOLEAN;
BEGIN
    FOR r IN
        SELECT a.id, a.target_value, a.habit_id
        FROM achievements a
        WHERE a.condition_key = p_condition_key
          AND a.is_archived = false
          AND (a.habit_id IS NULL OR a.habit_id = p_habit_id)
    LOOP
        -- Ensure the user_achievement row exists.
        INSERT INTO user_achievements (user_id, achievement_id, current_progress, is_unlocked)
        VALUES (p_user_id, r.id, 0, false)
        ON CONFLICT (user_id, achievement_id) DO NOTHING;

        -- Recompute progress for this condition.
        v_progress := CASE p_condition_key
            WHEN 'positive_streak'::condition_key THEN (
                SELECT COALESCE(MAX(current_streak), 0)
                FROM user_habits
                WHERE user_id     = p_user_id
                  AND is_negative = false
                  AND is_archived = false
                  AND (r.habit_id IS NULL OR habit_id = r.habit_id)
            )
            WHEN 'negative_streak'::condition_key THEN (
                SELECT COALESCE(MAX(current_streak), 0)
                FROM user_habits
                WHERE user_id     = p_user_id
                  AND is_negative = true
                  AND is_archived = false
                  AND (r.habit_id IS NULL OR habit_id = r.habit_id)
            )
            WHEN 'total_metric_volume'::condition_key THEN (
                SELECT COALESCE(SUM(he.logged_value), 0)::INT
                FROM habit_executions he
                JOIN user_habits uh ON uh.id = he.user_habit_id
                WHERE uh.user_id = p_user_id
                  AND (r.habit_id IS NULL OR uh.habit_id = r.habit_id)
            )
            WHEN 'first_action'::condition_key THEN (
                SELECT CASE WHEN EXISTS (
                    SELECT 1
                    FROM habit_executions he
                    JOIN user_habits uh ON uh.id = he.user_habit_id
                    WHERE uh.user_id = p_user_id
                      AND (r.habit_id IS NULL OR uh.habit_id = r.habit_id)
                ) THEN 1 ELSE 0 END
            )
            ELSE 0  -- Formula pending — see CAVEAT in header comment.
        END;

        SELECT is_unlocked INTO v_was_unlocked
        FROM user_achievements
        WHERE user_id = p_user_id AND achievement_id = r.id;

        UPDATE user_achievements
        SET current_progress = v_progress,
            is_unlocked      = (v_progress >= COALESCE(r.target_value, 1)),
            unlocked_at      = CASE
                WHEN NOT v_was_unlocked AND v_progress >= COALESCE(r.target_value, 1)
                    THEN NOW()
                ELSE unlocked_at
            END
        WHERE user_id = p_user_id AND achievement_id = r.id;

        -- Surface the "not yet implemented" cases during local dev.
        IF p_condition_key NOT IN (
            'positive_streak'::condition_key,
            'negative_streak'::condition_key,
            'total_metric_volume'::condition_key,
            'first_action'::condition_key
        ) THEN
            RAISE NOTICE 'sp_update_achievement_progress: condition_key=% has no formula yet; progress left at 0.', p_condition_key;
        END IF;
    END LOOP;
END;
$$;
