using HabitTracker.Application.DTOs.Awards;

namespace HabitTracker.Application.Services.Awards
{
    public interface IAwardsService
    {
        /// <summary>
        /// Returns every non-archived achievement in the catalog, enriched with the caller's personal
        /// progress and global rarity data. Achievements the user has never started have progress = 0.
        /// </summary>
        Task<IReadOnlyList<AwardDto>> GetAwardsForUserAsync(Guid userId, CancellationToken ct = default);
    }
}
