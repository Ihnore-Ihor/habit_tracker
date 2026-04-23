using System.ComponentModel.DataAnnotations;
using HabitTracker.Domain.ValueObjects;
using HabitTracker.Models;

namespace HabitTracker.Domain.Entities
{
    /// <summary>
    /// A user's subscription to a habit — either derived from a catalog <see cref="Habit"/> or fully custom
    /// (<see cref="HabitId"/> is null). Core write-heavy table of the tracking system; carries the per-habit
    /// O(1) streak counters updated by <c>trg_on_habit_execution</c>.
    /// Soft-deleted via <c>trg_soft_delete</c> to keep <see cref="HabitExecution"/> history intact forever.
    /// </summary>
    public class UserHabit
    {
        /// <summary>UUID primary key.</summary>
        [Key]
        public Guid Id { get; set; }

        /// <summary>Owning <see cref="User"/>.</summary>
        public Guid UserId { get; set; }

        /// <summary>
        /// Optional FK to the template <see cref="Habit"/>.
        /// Null = fully custom habit. Nulled out (ON DELETE SET NULL) if the template is ever removed.
        /// </summary>
        public int? HabitId { get; set; }

        /// <summary>FK to <see cref="Category"/>. Required for every habit (including custom ones) for analytics grouping.</summary>
        public int CategoryId { get; set; }

        /// <summary>Custom name — populated only when <see cref="HabitId"/> is null.</summary>
        [MaxLength(150)]
        public string? CustomName { get; set; }

        /// <summary>True for harmful habits tracked with the "slide to fail" mechanism (Yin).</summary>
        public bool IsNegative { get; set; }

        /// <summary>Optional target metric value (e.g. 2000 for "drink 2000 ml"). Null = checkbox-only habit.</summary>
        public decimal? TargetValue { get; set; }

        /// <summary>Unit label for the metric (e.g. "ml", "pages", "minutes"). Null when <see cref="TargetValue"/> is null.</summary>
        [MaxLength(32)]
        public string? MetricUnit { get; set; }

        /// <summary>Cadence family (Daily / Weekly / Monthly / Once). Drives how <see cref="ScheduleRule"/> is interpreted.</summary>
        public FrequencyType FrequencyType { get; set; }

        /// <summary>
        /// Polymorphic schedule stored as JSONB. Mapped with <c>OwnsOne(...).ToJson()</c> in the DbContext
        /// so individual fields can be queried via Postgres JSON operators when needed.
        /// </summary>
        public ScheduleRule? ScheduleRule { get; set; }

        /// <summary>Optional per-subscription colour override (falls back through template → category).</summary>
        [MaxLength(7)]
        public string? ColorHex { get; set; }

        /// <summary>Optional per-subscription emoji override.</summary>
        [MaxLength(16)]
        public string? IconEmoji { get; set; }

        /// <summary>
        /// Current consecutive-success counter for THIS habit. Updated O(1) by <c>trg_on_habit_execution</c>.
        /// Semantics are polarity-dependent:
        /// positive habit — execution increments, missed scheduled day resets to 0;
        /// negative habit — day passes without execution increments, any execution (= failure) resets to 0.
        /// </summary>
        public int CurrentStreak { get; set; }

        /// <summary>All-time maximum of <see cref="CurrentStreak"/> for this habit (positive or negative, whichever is longer).</summary>
        public int LongestStreak { get; set; }

        /// <summary>Soft-delete flag. Archived subscriptions are hidden from EF queries but their executions remain.</summary>
        public bool IsArchived { get; set; }

        /// <summary>Owning user.</summary>
        public User User { get; set; } = null!;

        /// <summary>Template habit (null for custom).</summary>
        public Habit? Habit { get; set; }

        /// <summary>Category navigation.</summary>
        public Category Category { get; set; } = null!;

        /// <summary>Historical executions. NEVER cascade-deleted — see <see cref="HabitExecution"/> docs.</summary>
        public ICollection<HabitExecution> Executions { get; set; } = new List<HabitExecution>();
    }
}
