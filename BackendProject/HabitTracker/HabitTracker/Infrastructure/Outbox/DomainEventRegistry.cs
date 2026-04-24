using System.Reflection;
using HabitTracker.Domain.Events;

namespace HabitTracker.Infrastructure.Outbox
{
    /// <summary>
    /// Closed whitelist of <see cref="IDomainEvent"/> implementations discovered by reflection on
    /// the assembly that hosts <see cref="IDomainEvent"/> itself. Exists so the dispatcher never
    /// calls <see cref="Type.GetType(string)"/> on untrusted strings (defence in depth: even though
    /// the outbox is populated by our own code, the value travels through JSONB and a refactor that
    /// renames an event type should fail loudly at startup rather than silently stop dispatching).
    /// </summary>
    public sealed class DomainEventRegistry
    {
        private readonly IReadOnlyDictionary<string, Type> _byFullName;

        public DomainEventRegistry()
        {
            var eventInterface = typeof(IDomainEvent);
            _byFullName = eventInterface.Assembly
                .GetTypes()
                .Where(t => t is { IsClass: true, IsAbstract: false } && eventInterface.IsAssignableFrom(t))
                .ToDictionary(t => t.FullName!, t => t, StringComparer.Ordinal);
        }

        /// <summary>
        /// Resolves a registered event type name to its CLR type, or returns <c>null</c> if unknown
        /// (typical cause: a historical row in the outbox refers to a type that has since been renamed/removed —
        /// the dispatcher treats these as poison and logs without retrying forever).
        /// </summary>
        public Type? Resolve(string fullName) =>
            _byFullName.TryGetValue(fullName, out var type) ? type : null;

        /// <summary>Canonical name used on the wire — the event's CLR <c>FullName</c>.</summary>
        public static string NameOf<T>() where T : IDomainEvent => typeof(T).FullName!;

        /// <inheritdoc cref="NameOf{T}"/>
        public static string NameOf(IDomainEvent @event) => @event.GetType().FullName!;
    }
}
