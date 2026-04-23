namespace HabitTracker.Domain.Entities
{
    /// <summary>
    /// Per-user progress tracker for a single <see cref="Achievement"/>. Row is upserted by
    /// <c>sp_update_achievement_progress</c> whenever a relevant event fires; the composite primary key
    /// (UserId, AchievementId) enforces one row per user/award pair and is declared in Fluent API.
    /// </summary>
    public class UserAchievement
    {
        /// <summary>First half of the composite PK. FK to <see cref="User"/>.</summary>
        public Guid UserId { get; set; }

        /// <summary>Second half of the composite PK. FK to <see cref="Achievement"/>.</summary>
        public int AchievementId { get; set; }

        /// <summary>Absolute progress accumulator compared against <see cref="Achievement.TargetValue"/>.</summary>
        public int CurrentProgress { get; set; }

        /// <summary>True once the unlock condition has been met; never reverts to false.</summary>
        public bool IsUnlocked { get; set; }

        /// <summary>Moment of unlock (UTC); null while still in progress.</summary>
        public DateTime? UnlockedAt { get; set; }

        /// <summary>User navigation.</summary>
        public User User { get; set; } = null!;

        /// <summary>Achievement navigation.</summary>
        public Achievement Achievement { get; set; } = null!;
    }
}
