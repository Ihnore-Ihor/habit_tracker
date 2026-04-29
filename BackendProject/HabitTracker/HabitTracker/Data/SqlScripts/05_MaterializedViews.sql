-- ============================================================================
-- 05_MaterializedViews.sql
-- Purpose : Heavy impersonal aggregates that should NOT run on every query.
--           Each MV has a unique index so REFRESH MATERIALIZED VIEW CONCURRENTLY
--           works. Refresh scheduling belongs at the ops layer (cron / hangfire).
-- ============================================================================


-- ---------------------------------------------------------------------------
-- mvw_global_habit_stats
-- Per-habit global metrics for the content-management dashboard.
-- NOTE: "drop-off rate" here = share of subscribers who have not logged
-- an execution in the last 14 days. This is a more actionable churn metric
-- than just counting archived subscriptions.
-- ---------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mvw_global_habit_stats;
CREATE MATERIALIZED VIEW mvw_global_habit_stats AS
WITH subs AS (
    SELECT habit_id,
           COUNT(DISTINCT user_id) AS subscribers_total
    FROM user_habits
    WHERE habit_id IS NOT NULL
    GROUP BY habit_id
),
recent_activity AS (
    -- Users who logged at least once in the last 14 days
    SELECT uh.habit_id, COUNT(DISTINCT uh.user_id) AS active_last_14d
    FROM habit_executions he
    JOIN user_habits uh ON uh.id = he.user_habit_id
    WHERE he.execution_time >= CURRENT_TIMESTAMP - INTERVAL '14 days'
    GROUP BY uh.habit_id
),
exec_counts AS (
    SELECT uh.habit_id, COUNT(*)::NUMERIC AS total_executions
    FROM habit_executions he
    JOIN user_habits uh ON uh.id = he.user_habit_id
    GROUP BY uh.habit_id
)
SELECT
    h.id                                                 AS habit_id,
    h.title,
    h.category_id,
    COALESCE(s.subscribers_total, 0)                     AS subscribers_total,
    COALESCE(ra.active_last_14d, 0)                      AS subscribers_active,
    COALESCE(s.subscribers_total, 0) - COALESCE(ra.active_last_14d, 0) AS subscribers_archived,
    CASE
        WHEN COALESCE(s.subscribers_total, 0) = 0 THEN 0
        ELSE 100.0 * (COALESCE(s.subscribers_total, 0) - COALESCE(ra.active_last_14d, 0)) / s.subscribers_total
    END                                                  AS dropoff_rate_pct,
    COALESCE(e.total_executions, 0)                      AS total_executions,
    CASE
        WHEN COALESCE(ra.active_last_14d, 0) = 0 THEN 0
        ELSE COALESCE(e.total_executions, 0) / ra.active_last_14d
    END                                                  AS avg_executions_per_active_user
FROM habits h
LEFT JOIN subs s            ON s.habit_id = h.id
LEFT JOIN recent_activity ra ON ra.habit_id = h.id
LEFT JOIN exec_counts e     ON e.habit_id = h.id;

CREATE UNIQUE INDEX idx_mvw_global_habit_stats_habit ON mvw_global_habit_stats (habit_id);


-- ---------------------------------------------------------------------------
-- mvw_achievement_rarity
-- Share of the global user base that has unlocked each achievement — drives
-- the rarity visual in the gamification UI.
-- ---------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mvw_achievement_rarity;
CREATE MATERIALIZED VIEW mvw_achievement_rarity AS
WITH totals AS (
    SELECT (SELECT COUNT(*)::NUMERIC FROM users) AS total_users
)
SELECT
    a.id AS achievement_id,
    a.title,
    a.condition_key,
    COUNT(ua.user_id) FILTER (WHERE ua.is_unlocked) AS unlocked_count,
    t.total_users,
    CASE WHEN t.total_users = 0 THEN 0
         ELSE 100.0 * COUNT(ua.user_id) FILTER (WHERE ua.is_unlocked) / t.total_users
    END AS unlock_rate_pct
FROM achievements a
LEFT JOIN user_achievements ua ON ua.achievement_id = a.id
CROSS JOIN totals t
GROUP BY a.id, a.title, a.condition_key, t.total_users;

CREATE UNIQUE INDEX idx_mvw_achievement_rarity_id ON mvw_achievement_rarity (achievement_id);


-- ---------------------------------------------------------------------------
-- mvw_analyst_proposal_impact (A15)
-- Month-over-month change in execution count for the target habit of each
-- implemented proposal, comparing a 30-day window before creation to the
-- 30-day window immediately after.
-- ---------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mvw_analyst_proposal_impact;
CREATE MATERIALIZED VIEW mvw_analyst_proposal_impact AS
WITH implemented AS (
    SELECT id, habit_id, created_at
    FROM analyst_proposals
    WHERE status = 1 -- 0=pending, 1=implemented, 2=rejected
      AND habit_id IS NOT NULL
),
before_after AS (
    SELECT
        p.id AS proposal_id,
        p.habit_id,
        p.created_at,
        (
            SELECT COUNT(*)::NUMERIC
            FROM habit_executions he
            JOIN user_habits uh ON uh.id = he.user_habit_id
            WHERE uh.habit_id = p.habit_id
              AND he.execution_time >= p.created_at - INTERVAL '30 days'
              AND he.execution_time <  p.created_at
        ) AS executions_before,
        (
            SELECT COUNT(*)::NUMERIC
            FROM habit_executions he
            JOIN user_habits uh ON uh.id = he.user_habit_id
            WHERE uh.habit_id = p.habit_id
              AND he.execution_time >= p.created_at
              AND he.execution_time <  p.created_at + INTERVAL '30 days'
        ) AS executions_after
    FROM implemented p
)
SELECT
    proposal_id,
    habit_id,
    created_at,
    executions_before,
    executions_after,
    CASE
        WHEN executions_before = 0 THEN NULL
        ELSE 100.0 * (executions_after - executions_before) / executions_before
    END AS mom_change_pct
FROM before_after;

CREATE UNIQUE INDEX idx_mvw_analyst_proposal_impact_id ON mvw_analyst_proposal_impact (proposal_id);


-- ---------------------------------------------------------------------------
-- mvw_sleep_recommendation_effectiveness
-- A/B comparison of avg daily PAD centroid (Pleasure axis as primary signal)
-- between users who adhered to their most-recent SleepRecommendation and
-- those who did not. "Adherent" is approximated here as: has at least one
-- post-recommendation sleep_log whose duration is within ±30 minutes of the
-- most recent SleepPlanDay.PlannedSleepHours. Adjust the adherence threshold
-- centrally if the product defines it more strictly.
-- ---------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mvw_sleep_recommendation_effectiveness;
CREATE MATERIALIZED VIEW mvw_sleep_recommendation_effectiveness AS
WITH latest_rec AS (
    SELECT DISTINCT ON (user_id)
        user_id,
        generated_at,
        sleep_plan
    FROM sleep_recommendations
    ORDER BY user_id, generated_at DESC
),
planned_hours AS (
    SELECT
        lr.user_id,
        lr.generated_at,
        AVG((day_elem->>'PlannedSleepHours')::NUMERIC) AS avg_planned_hours
    FROM latest_rec lr,
         LATERAL jsonb_array_elements(lr.sleep_plan->'Days') AS day_elem
    GROUP BY lr.user_id, lr.generated_at
),
adherence AS (
    SELECT
        ph.user_id,
        EXISTS (
            SELECT 1
            FROM sleep_logs sl
            WHERE sl.user_id = ph.user_id
              AND sl.sleep_start > ph.generated_at
              AND ABS(EXTRACT(EPOCH FROM (sl.sleep_end - sl.sleep_start)) / 3600.0
                      - ph.avg_planned_hours) <= 0.5
        ) AS is_adherent
    FROM planned_hours ph
),
user_pad AS (
    SELECT
        user_id,
        AVG(pleasure_score)::NUMERIC  AS mean_pleasure,
        AVG(arousal_score)::NUMERIC   AS mean_arousal,
        AVG(dominance_score)::NUMERIC AS mean_dominance
    FROM affect_entries
    GROUP BY user_id
)
SELECT
    CASE WHEN a.is_adherent THEN 'adherent' ELSE 'non_adherent' END AS cohort,
    COUNT(*)                               AS n_users,
    AVG(up.mean_pleasure)::NUMERIC         AS mean_p,
    AVG(up.mean_arousal)::NUMERIC          AS mean_a,
    AVG(up.mean_dominance)::NUMERIC        AS mean_d
FROM adherence a
JOIN user_pad up ON up.user_id = a.user_id
GROUP BY a.is_adherent;

CREATE UNIQUE INDEX idx_mvw_sleep_rec_effectiveness_cohort
    ON mvw_sleep_recommendation_effectiveness (cohort);
