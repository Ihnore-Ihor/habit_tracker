-- ============================================================================
-- 10_StreakYinSumFix.sql
-- Purpose : Patch fn_calc_current_streak and fn_calc_longest_streak so that
--           a Yin (negative) habit day is only counted as a "failure" when
--           SUM(logged_value) > 0 for that local date.
--
-- WHY this patch is needed
-- ────────────────────────
-- The "undo" mechanism inserts a compensating execution with logged_value = -1
-- to cancel an earlier failure (+1). After the undo the daily net sum is 0,
-- so the day is clean — but the previous version of fn_calc_current_streak
-- used MAX(execution_time), which returns the timestamp of the undo record
-- itself, incorrectly treating the day as a failure. The streak was therefore
-- reset to 0 (or a very small number) even though no net failure existed.
--
-- Both functions are patched in one file so they stay consistent with each
-- other. The fix is identical in spirit to the Yang target-sum check that was
-- already correct: aggregate per local day, then apply the threshold.
-- ============================================================================

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
    -- A day is a failure only when the NET logged_value for that local date
    -- is strictly > 0. A compensating undo entry (negative logged_value)
    -- brings the daily sum back to ≤ 0, restoring the day to "clean".
    IF p_is_negative THEN
        DECLARE
            v_start_date DATE;
            v_last_fail  DATE;
        BEGIN
            -- Fallback: use earliest execution date since user_habits lacks created_at
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
                -- No failures? Streak is every day since the habit was created.
                RETURN GREATEST(0, v_today - v_start_date);
            END IF;
        END;
    END IF;

    -- ── Yang path ─────────────────────────────────────────────────────────
    SELECT COALESCE(uh.target_value, 1)
    INTO   v_target_val
    FROM   user_habits uh
    WHERE  uh.id = p_user_habit_id;

    -- Grace: start from today when the target has been met; else from yesterday.
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
    -- ── Yin path ──────────────────────────────────────────────────────────
    -- Same net-sum filter as fn_calc_current_streak: only days where
    -- SUM(logged_value) > 0 are treated as failures.
    IF p_is_negative THEN
        DECLARE
            v_start_date DATE;
        BEGIN
            -- Fallback: use earliest execution date since user_habits lacks created_at
            SELECT (MIN(execution_time) AT TIME ZONE v_tz)::DATE INTO v_start_date
            FROM   habit_executions
            WHERE  user_habit_id = p_user_habit_id;

            IF v_start_date IS NULL THEN
                v_start_date := v_today;
            END IF;


            SELECT COALESCE(MAX(gap), 0)
            INTO   v_longest
            FROM (
                -- 1. Gap between habit creation and the very first failure
                SELECT (MIN(fail_date) - v_start_date) AS gap
                FROM (
                    SELECT (he.execution_time AT TIME ZONE v_tz)::DATE AS fail_date
                    FROM   habit_executions he
                    WHERE  he.user_habit_id = p_user_habit_id
                    GROUP  BY (he.execution_time AT TIME ZONE v_tz)::DATE
                    HAVING SUM(he.logged_value) > 0
                ) first_fail
                UNION ALL
                -- 2. Gaps between consecutive failures
                SELECT (LEAD(fail_date) OVER (ORDER BY fail_date) - fail_date - 1) AS gap
                FROM (
                    SELECT (he.execution_time AT TIME ZONE v_tz)::DATE AS fail_date
                    FROM   habit_executions he
                    WHERE  he.user_habit_id = p_user_habit_id
                    GROUP  BY (he.execution_time AT TIME ZONE v_tz)::DATE
                    HAVING SUM(he.logged_value) > 0
                ) fd
                UNION ALL
                -- 3. Gap between the last failure and today
                SELECT (v_today - MAX(fail_date)) AS gap
                FROM (
                    SELECT (he.execution_time AT TIME ZONE v_tz)::DATE AS fail_date
                    FROM   habit_executions he
                    WHERE  he.user_habit_id = p_user_habit_id
                    GROUP  BY (he.execution_time AT TIME ZONE v_tz)::DATE
                    HAVING SUM(he.logged_value) > 0
                ) last_fail
                UNION ALL
                -- 4. Case: No failures ever recorded (streak = today - creation)
                SELECT (v_today - v_start_date) AS gap
                WHERE NOT EXISTS (
                    SELECT 1 FROM habit_executions he
                    WHERE he.user_habit_id = p_user_habit_id
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
