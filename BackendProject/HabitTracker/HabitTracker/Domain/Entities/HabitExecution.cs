using System.ComponentModel.DataAnnotations;

namespace HabitTracker.Domain.Entities
{
    /// <summary>
    /// Immutable log of a single habit execution (Yang: success; Yin: a failure event).
    /// <b>NEVER deleted</b> — not even when the parent <see cref="UserHabit"/> is archived, and not when the owning
    /// <see cref="User"/> is removed (per A6). The full execution stream feeds analytics, streak maintenance,
    /// and the Pearson-correlation views indefinitely.
    /// </summary>
    public class HabitExecution
    {
        /// <summary>UUID primary key.</summary>
        [Key]
        public Guid Id { get; set; }

        /// <summary>FK to the owning <see cref="UserHabit"/> subscription.</summary>
        public Guid UserHabitId { get; set; }

        /// <summary>
        /// Moment the execution actually occurred (UTC). May be in the past — users are allowed to log
        /// retroactively up to 30 days back. Validated at the service layer, not the database.
        /// </summary>
        public DateTime ExecutionTime { get; set; }

        /// <summary>Server-side insertion timestamp (UTC), provided by <c>DEFAULT NOW()</c>.</summary>
        public DateTime CreatedAt { get; set; }

        /// <summary>Recorded numeric value for metric habits (e.g. 500 when the unit is "ml"). Null for checkbox habits.</summary>
        public decimal? LoggedValue { get; set; }

        /// <summary>Optional short note attached to this execution.</summary>
        [MaxLength(500)]
        public string? Note { get; set; }

        /// <summary>Parent subscription.</summary>
        public UserHabit UserHabit { get; set; } = null!;
    }
}
