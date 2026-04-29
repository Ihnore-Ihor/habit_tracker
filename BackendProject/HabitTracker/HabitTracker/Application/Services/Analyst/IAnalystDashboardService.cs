using HabitTracker.Application.DTOs.Analyst;

namespace HabitTracker.Application.Services.Analyst
{
    public interface IAnalystDashboardService
    {
        /// <summary>
        /// Returns all habits from <c>mvw_global_habit_stats</c> sorted by drop-off risk (highest first).
        /// </summary>
        Task<IReadOnlyList<HabitNeedsAttentionDto>> GetHabitsNeedingAttentionAsync(CancellationToken ct = default);

        /// <summary>
        /// Derives effectiveness metrics by comparing the two cohorts in
        /// <c>mvw_sleep_recommendation_effectiveness</c>.
        /// </summary>
        Task<SleepEffectivenessDto> GetSleepEffectivenessAsync(CancellationToken ct = default);

        /// <summary>
        /// Returns month-over-month execution trends for habits that had an implemented proposal,
        /// sourced from <c>mvw_analyst_proposal_impact</c>.
        /// </summary>
        Task<IReadOnlyList<HabitTrendDto>> GetHabitTrendsAsync(CancellationToken ct = default);

        /// <summary>Creates a new <c>AnalystProposal</c> owned by <paramref name="analystId"/>.</summary>
        Task<AnalystProposalDto> CreateProposalAsync(Guid analystId, CreateProposalRequest request, CancellationToken ct = default);

        /// <summary>Returns all proposals authored by the calling analyst, newest first.</summary>
        Task<IReadOnlyList<AnalystProposalDto>> GetMyProposalsAsync(Guid analystId, CancellationToken ct = default);

        /// <summary>Returns all proposals authored by other analysts, newest first, with analyst names.</summary>
        Task<IReadOnlyList<AnalystProposalDto>> GetOthersProposalsAsync(Guid analystId, CancellationToken ct = default);
    }
}
