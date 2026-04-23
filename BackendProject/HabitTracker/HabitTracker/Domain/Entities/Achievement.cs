using System.ComponentModel.DataAnnotations;
using HabitTracker.Models;

namespace HabitTracker.Domain.Entities
{
    /// <summary>
    /// Catalog entry describing a gamification award a user can unlock.
    /// Content managers can vary <see cref="TargetValue"/> and <see cref="HabitId"/>, but never the
    /// <see cref="ConditionKey"/> — the set of recognised conditions is fixed at code level
    /// (evaluated by <c>sp_update_achievement_progress</c>).
    /// Soft-deleted to preserve historical <see cref="UserAchievement"/> rows.
    /// </summary>
    public class Achievement
    {
        /// <summary>Surrogate SERIAL primary key (dictionary table).</summary>
        [Key]
        public int Id { get; set; }

        /// <summary>Award title shown on the badge.</summary>
        [Required, MaxLength(150)]
        public string Title { get; set; } = string.Empty;

        /// <summary>Human-readable description of the unlock conditions.</summary>
        [Required]
        public string Description { get; set; } = string.Empty;

        /// <summary>UI badge accent colour (HEX).</summary>
        [Required, MaxLength(7)]
        public string ColorHex { get; set; } = string.Empty;

        /// <summary>Icon URL or emoji reference.</summary>
        [Required, MaxLength(500)]
        public string IconUrl { get; set; } = string.Empty;

        /// <summary>
        /// Strictly typed condition identifier driving the evaluator.
        /// Mapped to the PostgreSQL enum <c>condition_key</c> (Step 3 wires the name translator).
        /// </summary>
        public ConditionKey ConditionKey { get; set; }

        /// <summary>
        /// Absolute target value the condition uses (e.g. 100 for <c>POSITIVE_STREAK</c> = "100-day streak",
        /// or 5000 for <c>TOTAL_METRIC_VOLUME</c> = "5000 ml of water"). Null when the condition is boolean
        /// (e.g. <c>FIRST_ACTION</c>).
        /// </summary>
        public int? TargetValue { get; set; }

        /// <summary>Optional binding to a specific catalog habit (e.g. "drink 5 L of water"). Null for habit-agnostic awards.</summary>
        public int? HabitId { get; set; }

        /// <summary>Soft-delete flag.</summary>
        public bool IsArchived { get; set; }

        /// <summary>Optional habit this award is scoped to.</summary>
        public Habit? Habit { get; set; }

        /// <summary>Progress rows for individual users.</summary>
        public ICollection<UserAchievement> UserAchievements { get; set; } = new List<UserAchievement>();
    }
}
