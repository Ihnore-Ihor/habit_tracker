-- ============================================================================
-- 08_UpdatedHabitStatsView.sql
-- Purpose : Replaces the static current_streak column in vw_user_habit_stats
--           with a live call to fn_calc_current_streak so the dashboard is
--           always self-consistent, even immediately after bulk seeding.
--
-- Depends : fn_calc_current_streak (07_StreakFunctions.sql).
-- ============================================================================

-- Drop and recreate so the column list changes take effect.
DROP VIEW IF EXISTS vw_user_habit_stats;

CREATE OR REPLACE VIEW vw_user_habit_stats AS
SELECT
    uh.id                                       AS user_habit_id,
    uh.user_id,
    uh.habit_id,
    COALESCE(h.title, uh.custom_name)           AS display_name,
    uh.category_id,
    uh.is_negative,

    -- Dynamic current streak: always reflects the true state of habit_executions,
    -- regardless of whether sp_daily_streak_maintenance has run.
    fn_calc_current_streak(uh.id, uh.is_negative, COALESCE(u.timezone, 'UTC'))
                                                AS current_streak,

    -- Longest streak: read from the static column, which is kept accurate by
    -- trg_on_habit_execution and sp_resync_streaks (called after bulk seeding).
    uh.longest_streak,

    (
        SELECT COUNT(*)
        FROM   habit_executions he
        WHERE  he.user_habit_id = uh.id
    )                                           AS total_executions,
    (
        SELECT COUNT(*)
        FROM   habit_executions he
        WHERE  he.user_habit_id = uh.id
          AND  he.execution_time >= NOW() - INTERVAL '30 days'
    )                                           AS executions_last_30_days,
    (
        SELECT MAX(he.execution_time)
        FROM   habit_executions he
        WHERE  he.user_habit_id = uh.id
    )                                           AS last_execution_at
FROM  user_habits  uh
JOIN  users        u  ON u.id  = uh.user_id
LEFT JOIN habits   h  ON h.id  = uh.habit_id
WHERE uh.is_archived = false;
