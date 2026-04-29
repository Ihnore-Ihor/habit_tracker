-- Restore Yin paths to the pre-patch versions that used MAX(execution_time)
-- rather than the per-day SUM filter.

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
    IF p_is_negative THEN
        SELECT GREATEST(0, v_today - (MAX(he.execution_time) AT TIME ZONE v_tz)::DATE)
        INTO   v_streak
        FROM   habit_executions he
        WHERE  he.user_habit_id = p_user_habit_id;

        RETURN COALESCE(v_streak, 0);
    END IF;

    SELECT COALESCE(uh.target_value, 1)
    INTO   v_target_val
    FROM   user_habits uh
    WHERE  uh.id = p_user_habit_id;

    SELECT COALESCE(SUM(he.logged_value), 0)
    INTO   v_daily_sum
    FROM   habit_executions he
    WHERE  he.user_habit_id = p_user_habit_id
      AND  (he.execution_time AT TIME ZONE v_tz)::DATE = v_today;

    v_check := CASE WHEN v_daily_sum >= v_target_val THEN v_today
                    ELSE v_today - 1
               END;

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
    IF p_is_negative THEN
        SELECT COALESCE(MAX(gap), 0)
        INTO   v_longest
        FROM (
            SELECT (LEAD(fail_date) OVER (ORDER BY fail_date) - fail_date - 1) AS gap
            FROM (
                SELECT DISTINCT (he.execution_time AT TIME ZONE v_tz)::DATE AS fail_date
                FROM   habit_executions he
                WHERE  he.user_habit_id = p_user_habit_id
            ) fd
            UNION ALL
            SELECT (v_today - MAX((he.execution_time AT TIME ZONE v_tz)::DATE)) AS gap
            FROM   habit_executions he
            WHERE  he.user_habit_id = p_user_habit_id
        ) gaps
        WHERE gap IS NOT NULL AND gap >= 0;

        RETURN v_longest;
    END IF;

    SELECT COALESCE(uh.target_value, 1)
    INTO   v_target_val
    FROM   user_habits uh
    WHERE  uh.id = p_user_habit_id;

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
