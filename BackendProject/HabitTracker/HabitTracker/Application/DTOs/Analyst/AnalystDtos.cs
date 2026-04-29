using System.ComponentModel.DataAnnotations;

namespace HabitTracker.Application.DTOs.Analyst
{
    // ── Habit performance ─────────────────────────────────────────────────────────

    /// <summary>One row from <c>mvw_global_habit_stats</c>, ordered by dropout risk.</summary>
    public sealed class HabitNeedsAttentionDto
    {
        public int HabitId { get; init; }
        public string Title { get; init; } = string.Empty;
        public long SubscribersActive { get; init; }
        public decimal AvgExecutions { get; init; }
        public decimal DropoffRatePct { get; init; }
    }

    // ── Sleep AI effectiveness ────────────────────────────────────────────────────

    /// <summary>
    /// Derived metrics comparing the 'adherent' vs 'non_adherent' cohorts from
    /// <c>mvw_sleep_recommendation_effectiveness</c>.
    /// Delta percentages express the difference as a fraction of the PAD ±5 range (10-point scale → ×10).
    /// </summary>
    public sealed class SleepEffectivenessDto
    {
        /// <summary>Share of users whose sleep log matched their recommendation (0–100).</summary>
        public decimal AdherenceRatePct { get; init; }

        /// <summary>
        /// Morning-mood improvement for adherent vs non-adherent users, expressed as % of the PAD Pleasure scale.
        /// Positive = adherent users feel better.
        /// </summary>
        public decimal MorningMoodDeltaPct { get; init; }

        /// <summary>
        /// Sleep-quality proxy: Arousal delta between cohorts (% of scale).
        /// Higher arousal in adherent group ≈ more refreshed on waking.
        /// </summary>
        public decimal SleepQualityDeltaPct { get; init; }

        /// <summary>
        /// Next-day completion proxy: Dominance delta between cohorts (% of scale).
        /// Higher dominance ≈ more in-control, correlated with habit completion.
        /// </summary>
        public decimal NextDayCompletionDeltaPct { get; init; }

        /// <summary>Human-readable summary generated from the delta values.</summary>
        public string KeyInsight { get; init; } = string.Empty;
    }

    // ── Habit trends ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Month-over-month execution change for habits that had an implemented proposal.
    /// Sourced from <c>mvw_analyst_proposal_impact</c>.
    /// </summary>
    public sealed class HabitTrendDto
    {
        public int HabitId { get; init; }
        public string HabitName { get; init; } = string.Empty;

        /// <summary>"Up" when <c>mom_change_pct ≥ 0</c>, otherwise "Down".</summary>
        public string TrendDirection { get; init; } = string.Empty;

        public decimal CompletionRateDeltaPct { get; init; }

        /// <summary>
        /// Average user mood change associated with the trend. Currently a constant proxy
        /// (no direct mood-per-habit data in this sprint); updated once the affect correlation
        /// pipeline is wired.
        /// </summary>
        public decimal AvgUserMoodDelta { get; init; }
    }

    // ── Proposals ────────────────────────────────────────────────────────────────

    /// <summary>
    /// Full view of an <c>AnalystProposal</c> row enriched with habit and analyst names.
    /// Status int values mirror <c>ProposalStatus</c>: 0=Pending, 1=Implemented, 2=Rejected.
    /// </summary>
    public sealed class AnalystProposalDto
    {
        public Guid Id { get; init; }
        public int? HabitId { get; init; }
        public string? HabitName { get; init; }
        public Guid AnalystId { get; init; }
        public string? AnalystName { get; init; }
        public string ProposedChange { get; init; } = string.Empty;
        public string Argumentation { get; init; } = string.Empty;
        public int Status { get; init; }
        public DateTime CreatedAt { get; init; }
    }

    /// <summary>Inbound payload for <c>POST /api/analyst/proposals</c>.</summary>
    public sealed class CreateProposalRequest
    {
        /// <summary>Target habit; null for catalog-wide suggestions.</summary>
        public int? HabitId { get; set; }

        [Required, MaxLength(200)]
        public string ProposedChange { get; set; } = string.Empty;

        [Required]
        public string Argumentation { get; set; } = string.Empty;
    }
}
