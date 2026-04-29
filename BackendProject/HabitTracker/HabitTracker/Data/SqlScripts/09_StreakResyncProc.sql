-- ============================================================================
-- 09_StreakResyncProc.sql
-- Purpose : One-shot procedure that back-fills current_streak and
--           longest_streak on every active user_habit from the actual
--           habit_executions history.
--
-- When to call
-- ────────────
-- Call `CALL sp_resync_streaks()` after any bulk-insert operation that
-- bypasses the normal trigger/nightly-job lifecycle — primarily the
-- DatabaseSeeder after it finishes inserting months of history.
--
-- After the resync the nightly sp_daily_streak_maintenance picks up from
-- a correct baseline and continues incrementally.
--
-- Depends : fn_calc_current_streak, fn_calc_longest_streak (07_StreakFunctions.sql).
-- ============================================================================

CREATE OR REPLACE PROCEDURE sp_resync_streaks()
LANGUAGE plpgsql AS $$
DECLARE
    r           RECORD;
    v_current   INT;
    v_longest   INT;
BEGIN
    FOR r IN
        SELECT uh.id,
               uh.is_negative,
               uh.longest_streak                     AS stored_longest,
               COALESCE(u.timezone, 'UTC')           AS tz
        FROM   user_habits uh
        JOIN   users u ON u.id = uh.user_id
        WHERE  uh.is_archived = false
    LOOP
        v_current := fn_calc_current_streak(r.id, r.is_negative, r.tz);
        v_longest := fn_calc_longest_streak(r.id, r.is_negative, r.tz);

        -- Never let the resync lower the stored longest_streak; the trigger
        -- could have legitimately raised it during the current session.
        v_longest := GREATEST(v_longest, r.stored_longest);

        UPDATE user_habits
        SET    current_streak = v_current,
               longest_streak = v_longest
        WHERE  id = r.id;
    END LOOP;
END;
$$;
