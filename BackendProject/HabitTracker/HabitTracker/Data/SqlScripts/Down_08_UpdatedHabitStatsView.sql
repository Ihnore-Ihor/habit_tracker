-- Restore vw_user_habit_stats to the original static-column version.
DROP VIEW IF EXISTS vw_user_habit_stats;

CREATE OR REPLACE VIEW vw_user_habit_stats AS
SELECT
    uh.id AS user_habit_id,
    uh.user_id,
    uh.habit_id,
    COALESCE(h.title, uh.custom_name) AS display_name,
    uh.category_id,
    uh.is_negative,
    uh.current_streak,
    uh.longest_streak,
    (
        SELECT COUNT(*)
        FROM habit_executions he
        WHERE he.user_habit_id = uh.id
    ) AS total_executions,
    (
        SELECT COUNT(*)
        FROM habit_executions he
        WHERE he.user_habit_id = uh.id
          AND he.execution_time >= NOW() - INTERVAL '30 days'
    ) AS executions_last_30_days,
    (
        SELECT MAX(he.execution_time)
        FROM habit_executions he
        WHERE he.user_habit_id = uh.id
    ) AS last_execution_at
FROM user_habits uh
LEFT JOIN habits h ON h.id = uh.habit_id
WHERE uh.is_archived = false;
