using System.ComponentModel.DataAnnotations;

namespace HabitTracker.Domain.Entities
{
    /// <summary>
    /// Template habit in the global catalog (created and edited by content managers).
    /// Users derive concrete subscriptions via <see cref="UserHabit"/>. Soft-deleted so that existing
    /// subscriptions aren't orphaned — the <c>UserHabit.HabitId</c> FK uses ON DELETE SET NULL, turning
    /// the subscription into a pure custom habit should the template ever be removed.
    /// </summary>
    public class Habit
    {
        /// <summary>Surrogate SERIAL primary key (dictionary table).</summary>
        [Key]
        public int Id { get; set; }

        /// <summary>FK to <see cref="Category"/>. Always required for catalog habits.</summary>
        public int CategoryId { get; set; }

        /// <summary>Habit title shown in the catalog and in the user's schedule.</summary>
        [Required, MaxLength(150)]
        public string Title { get; set; } = string.Empty;

        /// <summary>Optional long-form description or protocol instructions.</summary>
        public string? Description { get; set; }

        /// <summary>Optional UI accent colour override (falls back to the category colour when null).</summary>
        [MaxLength(7)]
        public string? ColorHex { get; set; }

        /// <summary>Optional emoji override (falls back to the category icon when null).</summary>
        [MaxLength(16)]
        public string? IconEmoji { get; set; }

        /// <summary>True when this is a harmful habit tracked via "slide to fail" (Yin).</summary>
        public bool IsNegative { get; set; }

        /// <summary>Soft-delete flag. Hidden from users by the global query filter while preserving analytics history.</summary>
        public bool IsArchived { get; set; }

        /// <summary>Owning category.</summary>
        public Category Category { get; set; } = null!;

        /// <summary>User subscriptions derived from this template.</summary>
        public ICollection<UserHabit> UserHabits { get; set; } = new List<UserHabit>();

        /// <summary>Achievements explicitly tied to this habit (optional; most achievements are habit-agnostic).</summary>
        public ICollection<Achievement> Achievements { get; set; } = new List<Achievement>();

        /// <summary>Analyst proposals that target this habit.</summary>
        public ICollection<AnalystProposal> Proposals { get; set; } = new List<AnalystProposal>();
    }
}
