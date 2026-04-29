namespace HabitTracker.Domain.ReadModels
{
    /// <summary>Keyless EF projection of <c>mvw_global_habit_stats</c>.</summary>
    public sealed class GlobalHabitStatsView
    {
        public int HabitId { get; init; }
        public string Title { get; init; } = string.Empty;
        public long SubscribersActive { get; init; }
        public decimal DropoffRatePct { get; init; }
        public decimal TotalExecutions { get; init; }
        public decimal AvgExecutionsPerActiveUser { get; init; }
    }
}
