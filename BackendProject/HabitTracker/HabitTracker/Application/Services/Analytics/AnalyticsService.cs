using HabitTracker.Application.DTOs.Analytics;
using HabitTracker.Data;
using Microsoft.EntityFrameworkCore;

namespace HabitTracker.Application.Services.Analytics
{
    /// <summary>
    /// Default <see cref="IAnalyticsService"/>. Each method aliases the view's snake_case columns
    /// to the DTO's PascalCase property names directly inside the SQL — EF Core's
    /// <see cref="RelationalDatabaseFacadeExtensions.SqlQueryRaw{TResult}"/> matches columns to
    /// properties by name, so the alias is what makes the projection work.
    /// <para>
    /// All queries scope rows to the calling user via a parameterised <c>WHERE user_id = {0}</c>;
    /// raw user input is never concatenated into the SQL.
    /// </para>
    /// </summary>
    public sealed class AnalyticsService : IAnalyticsService
    {
        private readonly AppDbContext _db;

        public AnalyticsService(AppDbContext db)
        {
            _db = db;
        }

        public async Task<IReadOnlyList<DailySummaryDto>> GetDailySummariesAsync(
            Guid userId,
            DateOnly? startDate,
            DateOnly? endDate,
            CancellationToken ct = default)
        {
            // Range filter is applied inside the SQL — adding it as a LINQ Where on top of
            // SqlQueryRaw forces an additional outer projection. Easier and faster to push it down.
            const string sql = """
                SELECT
                    user_id        AS "UserId",
                    local_date     AS "LocalDate",
                    success_rate_pct AS "SuccessRatePct",
                    sleep_hours    AS "SleepHours",
                    p_centroid     AS "PCentroid",
                    p_remembered   AS "PRemembered",
                    a_centroid     AS "ACentroid",
                    a_remembered   AS "ARemembered",
                    d_centroid     AS "DCentroid",
                    d_remembered   AS "DRemembered",
                    p_volatility   AS "PVolatility",
                    a_volatility   AS "AVolatility",
                    d_volatility   AS "DVolatility"
                FROM vw_user_daily_summary
                WHERE user_id = {0}
                  AND ({1}::date IS NULL OR local_date >= {1}::date)
                  AND ({2}::date IS NULL OR local_date <= {2}::date)
                ORDER BY local_date DESC
                """;

            // SqlQueryRaw's params signature is `params object[]` (non-nullable). Coalesce missing
            // bounds to DBNull.Value so Npgsql sees an SQL NULL parameter.
            object startParam = startDate.HasValue ? startDate.Value : DBNull.Value;
            object endParam   = endDate.HasValue   ? endDate.Value   : DBNull.Value;

            return await _db.Database
                .SqlQueryRaw<DailySummaryDto>(sql, userId, startParam, endParam)
                .ToListAsync(ct);
        }

        public async Task<IReadOnlyList<HabitStatsDto>> GetHabitStatsAsync(
            Guid userId,
            CancellationToken ct = default)
        {
            const string sql = """
                SELECT
                    user_habit_id            AS "UserHabitId",
                    user_id                  AS "UserId",
                    habit_id                 AS "HabitId",
                    display_name             AS "DisplayName",
                    category_id              AS "CategoryId",
                    is_negative              AS "IsNegative",
                    current_streak           AS "CurrentStreak",
                    longest_streak           AS "LongestStreak",
                    total_executions         AS "TotalExecutions",
                    executions_last_30_days  AS "ExecutionsLast30Days",
                    last_execution_at        AS "LastExecutionAt"
                FROM vw_user_habit_stats
                WHERE user_id = {0}
                ORDER BY current_streak DESC, total_executions DESC
                """;

            return await _db.Database
                .SqlQueryRaw<HabitStatsDto>(sql, userId)
                .ToListAsync(ct);
        }

        public async Task<IReadOnlyList<CategoryBalanceDto>> GetCategoryBalanceAsync(
            Guid userId,
            CancellationToken ct = default)
        {
            const string sql = """
                SELECT
                    user_id              AS "UserId",
                    category_id          AS "CategoryId",
                    category_name        AS "CategoryName",
                    color_hex            AS "ColorHex",
                    is_negative          AS "IsNegative",
                    category_executions  AS "CategoryExecutions",
                    total_executions     AS "TotalExecutions",
                    percentage           AS "Percentage"
                FROM vw_user_category_balance
                WHERE user_id = {0}
                ORDER BY percentage DESC
                """;

            return await _db.Database
                .SqlQueryRaw<CategoryBalanceDto>(sql, userId)
                .ToListAsync(ct);
        }

        public async Task<IReadOnlyList<CorrelationDto>> GetCorrelationsAsync(
            Guid userId,
            CancellationToken ct = default)
        {
            const string sql = """
                SELECT
                    user_habit_id      AS "UserHabitId",
                    user_id            AS "UserId",
                    pearson_pleasure   AS "PearsonPleasure",
                    pearson_arousal    AS "PearsonArousal",
                    pearson_dominance  AS "PearsonDominance",
                    sample_days        AS "SampleDays"
                FROM vw_user_correlations
                WHERE user_id = {0}
                ORDER BY sample_days DESC
                """;

            return await _db.Database
                .SqlQueryRaw<CorrelationDto>(sql, userId)
                .ToListAsync(ct);
        }
    }
}
