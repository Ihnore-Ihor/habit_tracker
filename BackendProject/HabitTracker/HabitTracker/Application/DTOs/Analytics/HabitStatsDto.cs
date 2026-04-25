namespace HabitTracker.Application.DTOs.Analytics
{
    /// <summary>
    /// Read-only projection of <c>vw_user_habit_stats</c> — one stats card per active subscription.
    /// Falls back to <c>UserHabit.CustomName</c> when the row has no template.
    /// </summary>
    public sealed class HabitStatsDto
    {
        public Guid UserHabitId { get; init; }
        public Guid UserId { get; init; }
        public int? HabitId { get; init; }
        public string DisplayName { get; init; } = string.Empty;
        public int CategoryId { get; init; }
        public bool IsNegative { get; init; }
        public int CurrentStreak { get; init; }
        public int LongestStreak { get; init; }

        /// <summary>All-time count of executions for this subscription.</summary>
        public long TotalExecutions { get; init; }

        /// <summary>Count of executions in the last 30 days (rolling, by server clock).</summary>
        public long ExecutionsLast30Days { get; init; }

        /// <summary>Most recent execution timestamp (UTC); null when no executions yet.</summary>
        public DateTime? LastExecutionAt { get; init; }
    }
}
