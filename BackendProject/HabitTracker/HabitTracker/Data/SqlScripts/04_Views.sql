-- ============================================================================
-- 04_Views.sql
-- Purpose : Virtual views that abstract the heavier aggregation joins
--           required by dashboards and correlation analytics.
-- Depends : fn_calculate_daily_affect_centroid, fn_is_habit_scheduled
--           (02_Functions.sql).
-- ============================================================================


-- ---------------------------------------------------------------------------
-- vw_user_daily_summary
-- One row per (user, local_date) for every date that has at least one signal
-- (affect entry, sleep log, or habit execution). Exposes:
--   - success_rate_pct : % of scheduled positive habits completed that day
--   - sleep_hours      : total sleep duration that day (local date bucketing)
--   - P/A/D centroid   : from fn_calculate_daily_affect_centroid (AUC)
--   - P/A/D remembered : Peak-End per A3
--   - P/A/D volatility : sample stddev within the day (A4)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_user_daily_summary AS
WITH signals AS (
    SELECT u.id AS user_id,
           COALESCE(u.timezone, 'UTC') AS tz,
           (ae.recorded_at AT TIME ZONE COALESCE(u.timezone, 'UTC'))::DATE AS local_date
    FROM users u
    JOIN affect_entries ae ON ae.user_id = u.id
    UNION
    SELECT u.id,
           COALESCE(u.timezone, 'UTC'),
           (sl.sleep_start AT TIME ZONE COALESCE(u.timezone, 'UTC'))::DATE
    FROM users u
    JOIN sleep_logs sl ON sl.user_id = u.id
    UNION
    SELECT u.id,
           COALESCE(u.timezone, 'UTC'),
           (he.execution_time AT TIME ZONE COALESCE(u.timezone, 'UTC'))::DATE
    FROM users u
    JOIN user_habits uh ON uh.user_id = u.id
    JOIN habit_executions he ON he.user_habit_id = uh.id
),
days AS (
    SELECT DISTINCT user_id, tz, local_date FROM signals
)
SELECT
    d.user_id,
    d.local_date,
    -- Positive-habit success rate for the day.
    (
        SELECT CASE
            WHEN COUNT(*) FILTER (
                WHERE fn_is_habit_scheduled(uh.frequency_type::TEXT, uh.schedule_rule, d.local_date)
            ) = 0 THEN NULL
            ELSE 100.0 * COUNT(*) FILTER (
                WHERE fn_is_habit_scheduled(uh.frequency_type::TEXT, uh.schedule_rule, d.local_date)
                  AND EXISTS (
                      SELECT 1 FROM habit_executions he2
                      WHERE he2.user_habit_id = uh.id
                        AND (he2.execution_time AT TIME ZONE d.tz)::DATE = d.local_date
                  )
            )::NUMERIC / COUNT(*) FILTER (
                WHERE fn_is_habit_scheduled(uh.frequency_type::TEXT, uh.schedule_rule, d.local_date)
            )
        END
        FROM user_habits uh
        WHERE uh.user_id = d.user_id
          AND uh.is_archived = false
          AND uh.is_negative = false
    ) AS success_rate_pct,
    -- Total sleep in hours for sleep logs whose start-date (local) equals local_date.
    (
        SELECT EXTRACT(EPOCH FROM SUM(sl.sleep_end - sl.sleep_start)) / 3600.0
        FROM sleep_logs sl
        WHERE sl.user_id = d.user_id
          AND (sl.sleep_start AT TIME ZONE d.tz)::DATE = d.local_date
    ) AS sleep_hours,
    -- PAD centroid + Peak-End ("remembered").
    cent.p_centroid,
    cent.p_remembered,
    cent.a_centroid,
    cent.a_remembered,
    cent.d_centroid,
    cent.d_remembered,
    -- PAD volatility = sample stddev within the local day (A4).
    (
        SELECT STDDEV_SAMP(ae.pleasure_score)::NUMERIC
        FROM affect_entries ae
        WHERE ae.user_id = d.user_id
          AND (ae.recorded_at AT TIME ZONE d.tz)::DATE = d.local_date
    ) AS p_volatility,
    (
        SELECT STDDEV_SAMP(ae.arousal_score)::NUMERIC
        FROM affect_entries ae
        WHERE ae.user_id = d.user_id
          AND (ae.recorded_at AT TIME ZONE d.tz)::DATE = d.local_date
    ) AS a_volatility,
    (
        SELECT STDDEV_SAMP(ae.dominance_score)::NUMERIC
        FROM affect_entries ae
        WHERE ae.user_id = d.user_id
          AND (ae.recorded_at AT TIME ZONE d.tz)::DATE = d.local_date
    ) AS d_volatility
FROM days d
LEFT JOIN LATERAL fn_calculate_daily_affect_centroid(d.user_id, d.local_date) cent ON TRUE;


-- ---------------------------------------------------------------------------
-- vw_user_category_balance
-- Share of a user's executions per category (drives the radar chart).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_user_category_balance AS
WITH per_user AS (
    SELECT uh.user_id, COUNT(*)::NUMERIC AS total_executions
    FROM habit_executions he
    JOIN user_habits uh ON uh.id = he.user_habit_id
    WHERE uh.is_archived = false
    GROUP BY uh.user_id
),
per_user_category AS (
    SELECT uh.user_id, uh.category_id, COUNT(*)::NUMERIC AS category_executions
    FROM habit_executions he
    JOIN user_habits uh ON uh.id = he.user_habit_id
    WHERE uh.is_archived = false
    GROUP BY uh.user_id, uh.category_id
)
SELECT
    puc.user_id,
    puc.category_id,
    c.name AS category_name,
    c.color_hex,
    c.is_negative,
    puc.category_executions,
    pu.total_executions,
    CASE WHEN pu.total_executions = 0 THEN 0
         ELSE 100.0 * puc.category_executions / pu.total_executions
    END AS percentage
FROM per_user_category puc
JOIN per_user pu ON pu.user_id = puc.user_id
JOIN categories c ON c.id = puc.category_id;


-- ---------------------------------------------------------------------------
-- vw_user_habit_stats
-- Per (user_habit) stats card: totals, recent activity, streaks.
-- ---------------------------------------------------------------------------
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


-- ---------------------------------------------------------------------------
-- vw_user_correlations (A10)
-- Pearson r between daily binary completion of each UserHabit (X) and the
-- day's PAD centroid on each of P / A / D (Y). Sample = days on which the
-- user recorded at least one affect entry (the domain of the PAD centroid).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_user_correlations AS
WITH affect_days AS (
    SELECT DISTINCT
        u.id AS user_id,
        COALESCE(u.timezone, 'UTC') AS tz,
        (ae.recorded_at AT TIME ZONE COALESCE(u.timezone, 'UTC'))::DATE AS local_date
    FROM users u
    JOIN affect_entries ae ON ae.user_id = u.id
),
daily AS (
    SELECT
        uh.id AS user_habit_id,
        uh.user_id,
        ad.local_date,
        CASE WHEN EXISTS (
            SELECT 1 FROM habit_executions he
            WHERE he.user_habit_id = uh.id
              AND (he.execution_time AT TIME ZONE ad.tz)::DATE = ad.local_date
        ) THEN 1 ELSE 0 END AS completed,
        cent.p_centroid,
        cent.a_centroid,
        cent.d_centroid
    FROM user_habits uh
    JOIN affect_days ad ON ad.user_id = uh.user_id
    LEFT JOIN LATERAL fn_calculate_daily_affect_centroid(uh.user_id, ad.local_date) cent ON TRUE
    WHERE uh.is_archived = false
)
SELECT
    user_habit_id,
    user_id,
    corr(completed::NUMERIC, p_centroid) AS pearson_pleasure,
    corr(completed::NUMERIC, a_centroid) AS pearson_arousal,
    corr(completed::NUMERIC, d_centroid) AS pearson_dominance,
    COUNT(*) FILTER (WHERE p_centroid IS NOT NULL) AS sample_days
FROM daily
GROUP BY user_habit_id, user_id;
