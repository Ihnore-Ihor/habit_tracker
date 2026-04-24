namespace HabitTracker.Domain.Events;

/// <summary>
/// Fired when a user logs their sleep (can be retroactive).
/// </summary>
public sealed record SleepLoggedEvent(
    Guid UserId, 
    Guid SleepLogId, 
    DateTime SleepStart, 
    DateTime SleepEnd, 
    int SleepQuality,
    List<string>? Tags) : IDomainEvent
{
    public DateTime OccurredAtUtc { get; } = DateTime.UtcNow;
}