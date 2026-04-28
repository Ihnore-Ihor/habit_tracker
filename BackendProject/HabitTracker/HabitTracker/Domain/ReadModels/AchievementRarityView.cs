namespace HabitTracker.Domain.ReadModels
{
    /// <summary>
    /// Keyless EF Core projection of <c>mvw_achievement_rarity</c>.
    /// Maps only the two columns needed by <c>AwardsService</c>; the view holds more.
    /// </summary>
    public sealed class AchievementRarityView
    {
        public int AchievementId { get; init; }

        /// <summary>Percentage of the global user base that has unlocked this achievement (0–100).</summary>
        public decimal UnlockRatePct { get; init; }
    }
}