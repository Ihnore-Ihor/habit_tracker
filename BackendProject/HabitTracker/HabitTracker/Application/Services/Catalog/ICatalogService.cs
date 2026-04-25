using HabitTracker.Application.DTOs.Catalog;

namespace HabitTracker.Application.Services.Catalog
{
    /// <summary>
    /// CRUD over the three "catalog" aggregate roots (<c>Category</c>, <c>Habit</c>, <c>Achievement</c>).
    /// <para>
    /// Read methods are open to any authenticated user (the SPA's habit picker / achievement gallery
    /// need them); write methods are gated to the ContentManager role at the controller layer.
    /// </para>
    /// <para>
    /// Delete methods perform a SOFT delete — they flip <c>IsArchived</c>. The hard delete path goes
    /// through the spec's <c>trg_soft_delete</c> trigger and is intentionally not exposed here so
    /// historical analytics rows keep referential integrity.
    /// </para>
    /// </summary>
    public interface ICatalogService
    {
        // ── Categories ──────────────────────────────────────────────────────────
        Task<IReadOnlyList<CategoryDto>> GetCategoriesAsync(CancellationToken ct = default);
        Task<CategoryDto> GetCategoryAsync(int id, CancellationToken ct = default);
        Task<CategoryDto> CreateCategoryAsync(CreateCategoryRequest request, CancellationToken ct = default);
        Task<CategoryDto> UpdateCategoryAsync(int id, UpdateCategoryRequest request, CancellationToken ct = default);
        Task DeleteCategoryAsync(int id, CancellationToken ct = default);

        // ── Habits ──────────────────────────────────────────────────────────────
        Task<IReadOnlyList<HabitDto>> GetHabitsAsync(int? categoryId, CancellationToken ct = default);
        Task<HabitDto> GetHabitAsync(int id, CancellationToken ct = default);
        Task<HabitDto> CreateHabitAsync(CreateHabitRequest request, CancellationToken ct = default);
        Task<HabitDto> UpdateHabitAsync(int id, UpdateHabitRequest request, CancellationToken ct = default);
        Task DeleteHabitAsync(int id, CancellationToken ct = default);

        // ── Achievements ────────────────────────────────────────────────────────
        Task<IReadOnlyList<AchievementDto>> GetAchievementsAsync(CancellationToken ct = default);
        Task<AchievementDto> GetAchievementAsync(int id, CancellationToken ct = default);
        Task<AchievementDto> CreateAchievementAsync(CreateAchievementRequest request, CancellationToken ct = default);
        Task<AchievementDto> UpdateAchievementAsync(int id, UpdateAchievementRequest request, CancellationToken ct = default);
        Task DeleteAchievementAsync(int id, CancellationToken ct = default);
    }
}