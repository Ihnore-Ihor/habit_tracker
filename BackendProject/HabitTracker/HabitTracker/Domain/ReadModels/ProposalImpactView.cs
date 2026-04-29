namespace HabitTracker.Domain.ReadModels
{
    /// <summary>Keyless EF projection of <c>mvw_analyst_proposal_impact</c>.</summary>
    public sealed class ProposalImpactView
    {
        public Guid ProposalId { get; init; }

        /// <summary>Never null in the view (filtered by the CTE), but typed nullable to match Postgres output.</summary>
        public int? HabitId { get; init; }

        public DateTime CreatedAt { get; init; }
        public decimal ExecutionsBefore { get; init; }
        public decimal ExecutionsAfter { get; init; }

        /// <summary>Null when <c>executions_before = 0</c> (prevents division by zero in the view).</summary>
        public decimal? MomChangePct { get; init; }
    }
}
