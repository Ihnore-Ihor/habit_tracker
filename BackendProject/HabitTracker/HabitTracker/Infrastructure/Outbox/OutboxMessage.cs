namespace HabitTracker.Infrastructure.Outbox
{
    /// <summary>
    /// Durable envelope for an <see cref="Domain.Events.IDomainEvent"/> awaiting dispatch.
    /// Inserted in the same DbContext transaction as the business write that produced the event,
    /// guaranteeing at-least-once delivery: if the transaction commits, the event will be seen;
    /// if it rolls back, the event never existed.
    /// Consumed by <see cref="OutboxDispatcherService"/>.
    /// </summary>
    public class OutboxMessage
    {
        /// <summary>UUID primary key (v4). Generated client-side so the row can be referenced before SaveChanges.</summary>
        public Guid Id { get; set; } = Guid.NewGuid();

        /// <summary>
        /// Assembly-qualified CLR type name of the serialised event, e.g.
        /// <c>HabitTracker.Domain.Events.HabitExecutedEvent</c>. The dispatcher resolves this
        /// through a closed whitelist (see <c>DomainEventRegistry</c>) — raw <c>Type.GetType</c> is avoided
        /// for security and rename-resilience.
        /// </summary>
        public string EventType { get; set; } = string.Empty;

        /// <summary>JSON payload (System.Text.Json) of the domain event. Stored as JSONB.</summary>
        public string Payload { get; set; } = string.Empty;

        /// <summary>UTC moment the producer raised the event (from <see cref="Domain.Events.IDomainEvent.OccurredAtUtc"/>).</summary>
        public DateTime OccurredAtUtc { get; set; }

        /// <summary>UTC moment the row was inserted. Set by database default.</summary>
        public DateTime CreatedAtUtc { get; set; }

        /// <summary>UTC moment the dispatcher finished successfully. NULL = unprocessed.</summary>
        public DateTime? ProcessedAtUtc { get; set; }

        /// <summary>Number of delivery attempts made by the dispatcher (including the successful one).</summary>
        public int Attempts { get; set; }

        /// <summary>Last error message observed while processing — useful for poison-message triage.</summary>
        public string? LastError { get; set; }
    }
}
