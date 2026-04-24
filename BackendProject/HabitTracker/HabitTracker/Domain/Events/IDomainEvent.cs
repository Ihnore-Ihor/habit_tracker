namespace HabitTracker.Domain.Events
{
    /// <summary>
    /// Marker interface for any business fact the application wants to propagate to handlers
    /// (gamification, notifications, analytics) via the transactional outbox.
    /// Implementations must be immutable, JSON-serialisable records so they survive the
    /// outbox round-trip without losing fidelity.
    /// </summary>
    public interface IDomainEvent
    {
        /// <summary>UTC timestamp the event was raised. Set by the producer, not by the outbox dispatcher.</summary>
        DateTime OccurredAtUtc { get; }
    }
}
