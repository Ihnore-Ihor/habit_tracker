using System.ComponentModel.DataAnnotations;
using HabitTracker.Domain.ValueObjects;

namespace HabitTracker.Domain.Entities
{
    /// <summary>
    /// A snapshot of the multi-day sleep schedule the algorithm has produced for a user.
    /// Regenerated when <see cref="SleepLog"/> history or <see cref="UserSleepProfile"/> parameters change;
    /// A/B effectiveness of different snapshots is tracked in <c>mvw_sleep_recommendation_effectiveness</c>.
    /// </summary>
    public class SleepRecommendation
    {
        /// <summary>UUID primary key.</summary>
        [Key]
        public Guid Id { get; set; }

        /// <summary>Owning user (cascade-deleted with the user).</summary>
        public Guid UserId { get; set; }

        /// <summary>Moment the plan was produced (UTC). Used by effectiveness analytics.</summary>
        public DateTime GeneratedAt { get; set; }

        /// <summary>
        /// Multi-day plan payload. Persisted as JSONB via <c>OwnsOne(...).ToJson()</c>.
        /// </summary>
        public SleepPlan SleepPlan { get; set; } = new();

        /// <summary>Owning user.</summary>
        public User User { get; set; } = null!;
    }
}
