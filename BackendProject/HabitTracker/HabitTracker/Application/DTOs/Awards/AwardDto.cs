namespace HabitTracker.Application.DTOs.Awards
{
    /// <summary>
    /// Represents one achievement from the catalog enriched with the caller's personal progress
    /// and the global rarity signal from <c>mvw_achievement_rarity</c>.
    /// Achievements the user has never interacted with are still returned (progress defaults to 0).
    /// </summary>
    public sealed class AwardDto
    {
        public int Id { get; init; }
        public string Title { get; init; } = string.Empty;
        public string Description { get; init; } = string.Empty;
        public string ColorHex { get; init; } = string.Empty;
        public string IconUrl { get; init; } = string.Empty;

        /// <summary>Absolute target for unlocking; 0 when the condition is boolean (e.g. FIRST_ACTION).</summary>
        public int TargetValue { get; init; }

        public int CurrentProgress { get; init; }
        public bool IsUnlocked { get; init; }

        /// <summary>Moment of unlock in UTC; null while still in progress.</summary>
        public DateTime? UnlockedAt { get; init; }

        /// <summary>Percentage of all users who have unlocked this achievement (0–100). 0 when no data yet.</summary>
        public decimal UnlockRatePct { get; init; }

        /// <summary>
        /// Human-readable rarity band derived from <see cref="UnlockRatePct"/>:
        /// <c>Legendary</c> (&lt;1%), <c>Epic</c> (1–5%), <c>Rare</c> (5–10%), <c>Common</c> (&gt;10%).
        /// </summary>
        public string RarityTier { get; init; } = string.Empty;
    }
}