namespace HabitTracker.Application.DTOs.Analytics
{
    /// <summary>
    /// Read-only projection of <c>vw_user_correlations</c> (A10) — Pearson r between daily binary
    /// completion of each <c>UserHabit</c> and the day's PAD centroid on each axis.
    /// All Pearson columns are nullable because Postgres's <c>corr()</c> returns NULL when the
    /// sample has &lt;2 paired observations or zero variance on either side.
    /// </summary>
    public sealed class CorrelationDto
    {
        public Guid UserHabitId { get; init; }
        public Guid UserId { get; init; }

        /// <summary>Pearson r in [-1, 1] of completion vs. pleasure centroid.</summary>
        public double? PearsonPleasure { get; init; }

        /// <summary>Pearson r in [-1, 1] of completion vs. arousal centroid.</summary>
        public double? PearsonArousal { get; init; }

        /// <summary>Pearson r in [-1, 1] of completion vs. dominance centroid.</summary>
        public double? PearsonDominance { get; init; }

        /// <summary>Number of days with non-null centroid that contributed to the correlation.</summary>
        public long SampleDays { get; init; }
    }
}
