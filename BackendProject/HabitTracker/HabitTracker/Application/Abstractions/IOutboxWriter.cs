using HabitTracker.Domain.Events;

namespace HabitTracker.Application.Abstractions
{
    /// <summary>
    /// Transactional-outbox producer. Business services call this inside the same unit of work as their
    /// primary write (e.g. inserting a <c>HabitExecution</c>) so that the event either commits together
    /// with the business row or is not stored at all — eliminating the dual-write inconsistency window.
    /// </summary>
    /// <remarks>
    /// Implementations MUST NOT call <c>SaveChangesAsync</c> themselves — the caller controls the transaction.
    /// </remarks>
    public interface IOutboxWriter
    {
        /// <summary>Enqueue a single domain event into the outbox within the caller's transaction.</summary>
        Task EnqueueAsync<TEvent>(TEvent @event, CancellationToken ct = default)
            where TEvent : IDomainEvent;

        /// <summary>Enqueue a batch of domain events. Use for multi-event business operations.</summary>
        Task EnqueueManyAsync(IEnumerable<IDomainEvent> events, CancellationToken ct = default);
    }
}