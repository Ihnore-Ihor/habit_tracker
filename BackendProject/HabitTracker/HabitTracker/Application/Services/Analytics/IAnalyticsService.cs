using HabitTracker.Application.DTOs.Analytics;

namespace HabitTracker.Application.Services.Analytics
{
    /// <summary>
    /// Read-only query layer over the four user-facing PostgreSQL views
    /// (<c>vw_user_daily_summary</c>, <c>vw_user_habit_stats</c>, <c>vw_user_category_balance</c>,
    /// <c>vw_user_correlations</c>). Mini-CQRS: bypasses the EF entity model and projects
    /// view rows directly into DTOs via <c>SqlQueryRaw&lt;T&gt;()</c>.
    /// </summary>
    public interface IAnalyticsService
    {
        /// <summary>
        /// Daily summaries for the caller, optionally constrained by a closed local-date range.
        /// Both bounds are inclusive; either may be null.
        /// </summary>
        Task<IReadOnlyList<DailySummaryDto>> GetDailySummariesAsync(
            Guid userId,
            DateOnly? startDate,
            DateOnly? endDate,
            CancellationToken ct = default);

        /// <summary>Per-subscription stats card for every active <c>UserHabit</c> the caller owns.</summary>
        Task<IReadOnlyList<HabitStatsDto>> GetHabitStatsAsync(
            Guid userId,
            CancellationToken ct = default);

        /// <summary>Category-balance breakdown (radar chart input).</summary>
        Task<IReadOnlyList<CategoryBalanceDto>> GetCategoryBalanceAsync(
            Guid userId,
            CancellationToken ct = default);

        /// <summary>Pearson correlations between each subscription's daily completion and the day's PAD centroid.</summary>
        Task<IReadOnlyList<CorrelationDto>> GetCorrelationsAsync(
            Guid userId,
            CancellationToken ct = default);
    }
}
