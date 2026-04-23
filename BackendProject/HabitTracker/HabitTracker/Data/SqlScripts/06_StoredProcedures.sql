-- ============================================================================
-- 06_StoredProcedures.sql
-- Purpose : Scheduled bulk-maintenance procedures. Nothing in this file owns
--           *business* logic — the DB handles only data integrity and the
--           nightly streak sweep that is most efficient as a set-based SQL
--           operation. All achievement / gamification logic lives in the
--           Application Layer (GamificationService + condition evaluators).
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
