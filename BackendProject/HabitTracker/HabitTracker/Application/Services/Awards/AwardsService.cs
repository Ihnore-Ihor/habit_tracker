using HabitTracker.Application.DTOs.Awards;
using HabitTracker.Data;
using Microsoft.EntityFrameworkCore;

namespace HabitTracker.Application.Services.Awards
{
    /// <summary>
    /// Joins the achievement catalog with the caller's <c>user_achievements</c> rows (LEFT JOIN —
    /// un-started achievements still appear with progress 0) and the <c>mvw_achievement_rarity</c>
    /// materialized view (LEFT JOIN — new achievements have no rarity row yet, defaulting to 0%).
    /// The <see cref="Achievement"/> global query filter already excludes archived entries.
    /// </summary>
    public sealed class AwardsService : IAwardsService
    {
        private readonly AppDbContext _db;

        public AwardsService(AppDbContext db) => _db = db;

        public async Task<IReadOnlyList<AwardDto>> GetAwardsForUserAsync(
            Guid userId,
            CancellationToken ct = default)
        {
            // Project into an anonymous type so EF Core handles the LEFT JOINs in one round-trip.
            // RarityTier classification runs in memory after the query (can't call C# methods in SQL).
            var rows = await (
                from a in _db.Achievements
                join ua in _db.UserAchievements.Where(x => x.UserId == userId)
                    on a.Id equals ua.AchievementId into uaGroup
                from ua in uaGroup.DefaultIfEmpty()
                join r in _db.AchievementRarityViews
                    on a.Id equals r.AchievementId into rGroup
                from r in rGroup.DefaultIfEmpty()
                orderby a.Id
                select new
                {
                    a.Id,
                    a.Title,
                    a.Description,
                    a.ColorHex,
                    a.IconUrl,
                    a.TargetValue,
                    CurrentProgress = (int?)ua.CurrentProgress ?? 0,
                    IsUnlocked      = (bool?)ua.IsUnlocked ?? false,
                    UnlockedAt      = (DateTime?)ua.UnlockedAt,
                    UnlockRatePct   = (decimal?)r.UnlockRatePct ?? 0m,
                }
            ).AsNoTracking().ToListAsync(ct);

            return rows.Select(row => new AwardDto
            {
                Id              = row.Id,
                Title           = row.Title,
                Description     = row.Description,
                ColorHex        = row.ColorHex,
                IconUrl         = row.IconUrl,
                TargetValue     = row.TargetValue ?? 0,
                CurrentProgress = row.CurrentProgress,
                IsUnlocked      = row.IsUnlocked,
                UnlockedAt      = row.UnlockedAt,
                UnlockRatePct   = row.UnlockRatePct,
                RarityTier      = ClassifyRarity(row.UnlockRatePct),
            }).ToList();
        }

        // ── Helpers ───────────────────────────────────────────────────────────────────

        private static string ClassifyRarity(decimal unlockRatePct) => unlockRatePct switch
        {
            < 1m           => "Legendary",
            >= 1m and < 5m => "Epic",
            >= 5m and < 10m => "Rare",
            _              => "Common",
        };
    }
}
