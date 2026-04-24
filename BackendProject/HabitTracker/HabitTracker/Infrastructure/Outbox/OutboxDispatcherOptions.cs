namespace HabitTracker.Infrastructure.Outbox
{
    /// <summary>
    /// Tunable knobs for <see cref="OutboxDispatcherService"/>. Bind from configuration under
    /// the <c>Outbox</c> section, or register defaults via <c>services.Configure&lt;OutboxDispatcherOptions&gt;</c>.
    /// </summary>
    public sealed class OutboxDispatcherOptions
    {
        /// <summary>Configuration section name.</summary>
        public const string SectionName = "Outbox";

        /// <summary>How often the dispatcher wakes up to drain the outbox. Default 2 s.</summary>
        public TimeSpan PollInterval { get; set; } = TimeSpan.FromSeconds(2);

        /// <summary>Maximum messages drained per tick. Keeps each transaction short and bounded.</summary>
        public int BatchSize { get; set; } = 100;

        /// <summary>
        /// Maximum delivery attempts before the message is considered poison and left alone
        /// (still unprocessed, but ignored by subsequent polls via a <c>WHERE attempts &lt; MaxAttempts</c> filter).
        /// </summary>
        public int MaxAttempts { get; set; } = 5;
    }
}