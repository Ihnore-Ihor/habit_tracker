namespace HabitTracker.Domain.Events;

/// <summary>
/// Fired when a user successfully logs an execution for a habit.
/// </summary>
public sealed record HabitExecutedEvent(
    Guid UserId, 
    Guid UserHabitId, 
    DateTime ExecutionTime, 
    decimal? LoggedValue) : IDomainEvent
{
    public DateTime OccurredAtUtc { get; } = DateTime.UtcNow;
}