using System.Text.Json;
using HabitTracker.Application.Abstractions;
using HabitTracker.Data;
using HabitTracker.Domain.Events;

namespace HabitTracker.Infrastructure.Outbox
{
    /// <summary>
    /// Default <see cref="IOutboxWriter"/> implementation. Registered as <c>Scoped</c> so it shares
    /// the ambient <see cref="AppDbContext"/> with the calling service — the outbox row and the
    /// business row land in the same <c>SaveChangesAsync</c> call and therefore the same transaction.
    /// </summary>
    public sealed class OutboxWriter : IOutboxWriter
    {
        private static readonly JsonSerializerOptions SerializerOptions = new()
        {
            // Keep the serialised payload small and stable across renames of private fields.
            // Records with PascalCase properties serialise fine with defaults; no custom naming policy.
            WriteIndented = false
        };

        private readonly AppDbContext _db;

        public OutboxWriter(AppDbContext db)
        {
            _db = db;
        }

        /// <inheritdoc />
        public Task EnqueueAsync<TEvent>(TEvent @event, CancellationToken ct = default)
            where TEvent : IDomainEvent
        {
            ArgumentNullException.ThrowIfNull(@event);
            _db.OutboxMessages.Add(BuildMessage(@event));
            return Task.CompletedTask;
        }

        /// <inheritdoc />
        public Task EnqueueManyAsync(IEnumerable<IDomainEvent> events, CancellationToken ct = default)
        {
            ArgumentNullException.ThrowIfNull(events);
            foreach (var evt in events)
                _db.OutboxMessages.Add(BuildMessage(evt));
            return Task.CompletedTask;
        }

        private static OutboxMessage BuildMessage(IDomainEvent @event) => new()
        {
            EventType = DomainEventRegistry.NameOf(@event),
            // Serialise against the concrete runtime type — not IDomainEvent — so every public property
            // of the concrete record is written (otherwise only OccurredAtUtc would land on the wire).
            Payload = JsonSerializer.Serialize(@event, @event.GetType(), SerializerOptions),
            OccurredAtUtc = @event.OccurredAtUtc
            // CreatedAtUtc is supplied by the DB default (NOW()).
        };
    }
}