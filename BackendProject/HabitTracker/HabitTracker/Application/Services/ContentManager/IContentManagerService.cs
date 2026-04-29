using HabitTracker.Application.DTOs.ContentManager;

namespace HabitTracker.Application.Services.ContentManager
{
    public interface IContentManagerService
    {
        // ── Proposals ──────────────────────────────────────────────────────────────

        /// <summary>Returns all proposals joined with habit titles and analyst names, newest first.</summary>
        Task<IReadOnlyList<ProposalManagerDto>> GetProposalsAsync(CancellationToken ct = default);

        /// <summary>Updates the status of a proposal. Throws <c>NotFoundException</c> when the id is unknown.</summary>
        Task UpdateProposalStatusAsync(Guid id, int status, CancellationToken ct = default);

        // ── Categories ─────────────────────────────────────────────────────────────

        /// <summary>Returns all active categories enriched with their active habit count.</summary>
        Task<IReadOnlyList<CategoryManagerDto>> GetCategoriesAsync(CancellationToken ct = default);

        /// <summary>Creates a new category and returns it.</summary>
        Task<CategoryManagerDto> CreateCategoryAsync(CreateCategoryRequest request, CancellationToken ct = default);

        /// <summary>Updates an existing category. Throws <c>NotFoundException</c> when the id is unknown.</summary>
        Task UpdateCategoryAsync(int id, UpdateCategoryRequest request, CancellationToken ct = default);

        /// <summary>Soft-deletes a category. Throws <c>NotFoundException</c> when the id is unknown.</summary>
        Task DeleteCategoryAsync(int id, CancellationToken ct = default);

        // ── Habits ─────────────────────────────────────────────────────────────────

        /// <summary>Returns all active catalog habits with their parent category name resolved.</summary>
        Task<IReadOnlyList<HabitCatalogDto>> GetHabitsAsync(CancellationToken ct = default);

        /// <summary>Creates a new catalog habit and returns it.</summary>
        Task<HabitCatalogDto> CreateHabitAsync(CreateHabitRequest request, CancellationToken ct = default);

        /// <summary>Updates an existing habit. Throws <c>NotFoundException</c> when the id is unknown.</summary>
        Task UpdateHabitAsync(int id, UpdateHabitRequest request, CancellationToken ct = default);

        /// <summary>Soft-deletes a habit. Throws <c>NotFoundException</c> when the id is unknown.</summary>
        Task DeleteHabitAsync(int id, CancellationToken ct = default);

        // ── Achievements ───────────────────────────────────────────────────────────

        /// <summary>Returns all active achievements with <c>ConditionKey</c> as its enum member name.</summary>
        Task<IReadOnlyList<AchievementManagerDto>> GetAchievementsAsync(CancellationToken ct = default);

        /// <summary>Creates a new achievement and returns it.</summary>
        Task<AchievementManagerDto> CreateAchievementAsync(CreateAchievementRequest request, CancellationToken ct = default);

        /// <summary>Updates an existing achievement. Throws <c>NotFoundException</c> when the id is unknown.</summary>
        Task<AchievementManagerDto> UpdateAchievementAsync(int id, UpdateAchievementRequest request, CancellationToken ct = default);

        /// <summary>Soft-deletes an achievement (sets IsArchived = true). Throws <c>NotFoundException</c> when the id is unknown.</summary>
        Task DeleteAchievementAsync(int id, CancellationToken ct = default);
    }
}
