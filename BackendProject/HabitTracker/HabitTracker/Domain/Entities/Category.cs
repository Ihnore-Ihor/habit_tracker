using System.ComponentModel.DataAnnotations;

namespace HabitTracker.Domain.Entities
{
    /// <summary>
    /// Global habit category maintained by content managers (e.g. "Health", "Focus", "Addictions").
    /// Soft-deleted: rows are never physically removed so that historical <see cref="UserHabit"/> rows
    /// and analytics views keep referential integrity. Global query filter hides archived rows by default.
    /// </summary>
    public class Category
    {
        /// <summary>Surrogate SERIAL primary key (dictionary table).</summary>
        [Key]
        public int Id { get; set; }

        /// <summary>Human-readable category name shown in the habit picker.</summary>
        [Required, MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        /// <summary>Optional long-form description of the category's scope and intent.</summary>
        public string? Description { get; set; }

        /// <summary>UI accent colour as a HEX string (e.g. "#22C55E").</summary>
        [Required, MaxLength(7)]
        public string ColorHex { get; set; } = string.Empty;

        /// <summary>Emoji glyph (or short emoji sequence) used as the category icon.</summary>
        [Required, MaxLength(16)]
        public string IconEmoji { get; set; } = string.Empty;

        /// <summary>True when the category groups harmful habits (Yin half of the Yin-Yang system).</summary>
        public bool IsNegative { get; set; }

        /// <summary>
        /// Soft-delete flag. Rows with <c>true</c> are hidden by EF Core's global query filter.
        /// Set by the <c>trg_soft_delete</c> trigger when DELETE is attempted.
        /// </summary>
        public bool IsArchived { get; set; }

        /// <summary>Habits in this category in the global catalog.</summary>
        public ICollection<Habit> Habits { get; set; } = new List<Habit>();

        /// <summary>User habits that reference this category (including custom ones where <c>HabitId</c> is null).</summary>
        public ICollection<UserHabit> UserHabits { get; set; } = new List<UserHabit>();
    }
}
