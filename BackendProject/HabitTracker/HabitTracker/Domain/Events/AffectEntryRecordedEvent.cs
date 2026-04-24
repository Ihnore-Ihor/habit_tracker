namespace HabitTracker.Domain.Events;

/// <summary>
/// Fired when a user records a PAD physiological state.
/// </summary>
public sealed record AffectEntryRecordedEvent(
    Guid UserId, 
    Guid AffectEntryId, 
    int PleasureScore, 
    int ArousalScore, 
    int DominanceScore,
    List<string>? ContextTags) : IDomainEvent
{
    public DateTime OccurredAtUtc { get; } = DateTime.UtcNow;
}

