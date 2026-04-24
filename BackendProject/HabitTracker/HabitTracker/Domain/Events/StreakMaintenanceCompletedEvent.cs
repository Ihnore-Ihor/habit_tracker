namespace HabitTracker.Domain.Events;

/// <summary>
/// Fired by the hourly background service for users whose local time just crossed midnight.
/// Triggers the gamification service to evaluate time-based achievements (e.g. PERFECT_DAY_STREAK).
/// </summary>
public sealed record StreakMaintenanceCompletedEvent(
    Guid UserId, 
    DateTime DateEvaluated) : IDomainEvent
{
    public DateTime OccurredAtUtc { get; } = DateTime.UtcNow;
}