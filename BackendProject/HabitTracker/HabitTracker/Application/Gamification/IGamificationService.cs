using HabitTracker.Domain.Events;

namespace HabitTracker.Application.Gamification
{
    /// <summary>
    /// Entry point invoked by the outbox dispatcher once per durable domain event.
    /// Implementations own the "event → achievements → evaluators" fan-out and persist any progress changes.
    /// </summary>
    public interface IGamificationService
    {
        /// <summary>Handle one dequeued domain event. Must be idempotent (see <see cref="IAchievementEvaluator"/>).</summary>
        Task HandleAsync(IDomainEvent @event, CancellationToken ct);
    }
}