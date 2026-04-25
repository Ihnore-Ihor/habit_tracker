namespace HabitTracker.Application.DTOs.Analytics
{
    /// <summary>
    /// Read-only projection of <c>vw_user_daily_summary</c> — one row per (user, local_date)
    /// for every day with at least one signal (affect entry, sleep log, or habit execution).
    /// All NUMERIC columns are nullable: a day may have no scheduled positive habits, no sleep,
    /// or fewer than two affect entries (stddev undefined).
    /// </summary>
    public sealed class DailySummaryDto
    {
        public Guid UserId { get; init; }

        /// <summary>Local-timezone calendar date (DATE). Mapped 1:1 from <c>local_date</c>.</summary>
        public DateOnly LocalDate { get; init; }

        /// <summary>Percent of scheduled positive habits completed on this day. Null when nothing was scheduled.</summary>
        public decimal? SuccessRatePct { get; init; }

        /// <summary>Total sleep hours bucketed by local sleep-start date. <c>EXTRACT(EPOCH ...) / 3600</c> → DOUBLE PRECISION.</summary>
        public double? SleepHours { get; init; }

        // PAD centroid (Trapezoidal AUC) and Peak-End "remembered" values (NUMERIC).
        public decimal? PCentroid { get; init; }
        public decimal? PRemembered { get; init; }
        public decimal? ACentroid { get; init; }
        public decimal? ARemembered { get; init; }
        public decimal? DCentroid { get; init; }
        public decimal? DRemembered { get; init; }

        // PAD volatility = sample stddev within the local day (A4). Null for days with <2 entries.
        public decimal? PVolatility { get; init; }
        public decimal? AVolatility { get; init; }
        public decimal? DVolatility { get; init; }
    }
}
