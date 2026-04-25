using HabitTracker.Application.Common.Exceptions;
using HabitTracker.Application.DTOs.Catalog;
using HabitTracker.Data;
using HabitTracker.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HabitTracker.Application.Services.Catalog
{
    /// <summary>
    /// Default <see cref="ICatalogService"/>. Reads honour the global query filters
    /// (archived rows are invisible); writes go straight through EF Core.
    /// </summary>
    public sealed class CatalogService : ICatalogService
    {
        private readonly AppDbContext _db;

        public CatalogService(AppDbContext db)
        {
            _db = db;
        }

        // ─────────────────────────── Categories ───────────────────────────

        public async Task<IReadOnlyList<CategoryDto>> GetCategoriesAsync(CancellationToken ct = default)
        {
            return await _db.Categories
                .AsNoTracking()
                .OrderBy(c => c.Name)
                .Select(c => MapCategory(c))
                .ToListAsync(ct);
        }

        public async Task<CategoryDto> GetCategoryAsync(int id, CancellationToken ct = default)
        {
            var category = await _db.Categories.AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == id, ct)
                ?? throw new NotFoundException(nameof(Category), id);

            return MapCategory(category);
        }

        public async Task<CategoryDto> CreateCategoryAsync(CreateCategoryRequest request, CancellationToken ct = default)
        {
            var entity = new Category
            {
                Name = request.Name.Trim(),
                ColorHex = request.ColorHex,
                IconEmoji = request.IconEmoji,
                IsNegative = request.IsNegative,
                IsArchived = false
            };

            _db.Categories.Add(entity);
            await _db.SaveChangesAsync(ct);

            return MapCategory(entity);
        }

        public async Task<CategoryDto> UpdateCategoryAsync(int id, UpdateCategoryRequest request, CancellationToken ct = default)
        {
            var entity = await _db.Categories.FirstOrDefaultAsync(c => c.Id == id, ct)
                ?? throw new NotFoundException(nameof(Category), id);

            entity.Name = request.Name.Trim();
            entity.ColorHex = request.ColorHex;
            entity.IconEmoji = request.IconEmoji;
            entity.IsNegative = request.IsNegative;

            await _db.SaveChangesAsync(ct);
            return MapCategory(entity);
        }

        public async Task DeleteCategoryAsync(int id, CancellationToken ct = default)
        {
            var entity = await _db.Categories.FirstOrDefaultAsync(c => c.Id == id, ct)
                ?? throw new NotFoundException(nameof(Category), id);

            // Soft delete — keeps UserHabit / analytics history intact.
            entity.IsArchived = true;
            await _db.SaveChangesAsync(ct);
        }

        // ───────────────────────────── Habits ─────────────────────────────

        public async Task<IReadOnlyList<HabitDto>> GetHabitsAsync(int? categoryId, CancellationToken ct = default)
        {
            var query = _db.Habits.AsNoTracking();
            if (categoryId.HasValue)
                query = query.Where(h => h.CategoryId == categoryId.Value);

            return await query
                .OrderBy(h => h.Title)
                .Select(h => MapHabit(h))
                .ToListAsync(ct);
        }

        public async Task<HabitDto> GetHabitAsync(int id, CancellationToken ct = default)
        {
            var entity = await _db.Habits.AsNoTracking()
                .FirstOrDefaultAsync(h => h.Id == id, ct)
                ?? throw new NotFoundException(nameof(Habit), id);

            return MapHabit(entity);
        }

        public async Task<HabitDto> CreateHabitAsync(CreateHabitRequest request, CancellationToken ct = default)
        {
            await EnsureCategoryExists(request.CategoryId, ct);

            var entity = new Habit
            {
                CategoryId = request.CategoryId,
                Title = request.Title.Trim(),
                Description = request.Description,
                ColorHex = request.ColorHex,
                IconEmoji = request.IconEmoji,
                IsNegative = request.IsNegative,
                IsArchived = false
            };

            _db.Habits.Add(entity);
            await _db.SaveChangesAsync(ct);

            return MapHabit(entity);
        }

        public async Task<HabitDto> UpdateHabitAsync(int id, UpdateHabitRequest request, CancellationToken ct = default)
        {
            var entity = await _db.Habits.FirstOrDefaultAsync(h => h.Id == id, ct)
                ?? throw new NotFoundException(nameof(Habit), id);

            if (entity.CategoryId != request.CategoryId)
                await EnsureCategoryExists(request.CategoryId, ct);

            entity.CategoryId = request.CategoryId;
            entity.Title = request.Title.Trim();
            entity.Description = request.Description;
            entity.ColorHex = request.ColorHex;
            entity.IconEmoji = request.IconEmoji;
            entity.IsNegative = request.IsNegative;

            await _db.SaveChangesAsync(ct);
            return MapHabit(entity);
        }

        public async Task DeleteHabitAsync(int id, CancellationToken ct = default)
        {
            var entity = await _db.Habits.FirstOrDefaultAsync(h => h.Id == id, ct)
                ?? throw new NotFoundException(nameof(Habit), id);

            entity.IsArchived = true;
            await _db.SaveChangesAsync(ct);
        }

        // ─────────────────────────── Achievements ───────────────────────────

        public async Task<IReadOnlyList<AchievementDto>> GetAchievementsAsync(CancellationToken ct = default)
        {
            return await _db.Achievements.AsNoTracking()
                .OrderBy(a => a.Title)
                .Select(a => MapAchievement(a))
                .ToListAsync(ct);
        }

        public async Task<AchievementDto> GetAchievementAsync(int id, CancellationToken ct = default)
        {
            var entity = await _db.Achievements.AsNoTracking()
                .FirstOrDefaultAsync(a => a.Id == id, ct)
                ?? throw new NotFoundException(nameof(Achievement), id);

            return MapAchievement(entity);
        }

        public async Task<AchievementDto> CreateAchievementAsync(CreateAchievementRequest request, CancellationToken ct = default)
        {
            if (request.HabitId.HasValue)
                await EnsureHabitExists(request.HabitId.Value, ct);

            var entity = new Achievement
            {
                Title = request.Title.Trim(),
                Description = request.Description,
                ColorHex = request.ColorHex,
                IconUrl = request.IconUrl,
                ConditionKey = request.ConditionKey,
                TargetValue = request.TargetValue,
                HabitId = request.HabitId,
                IsArchived = false
            };

            _db.Achievements.Add(entity);
            await _db.SaveChangesAsync(ct);

            return MapAchievement(entity);
        }

        public async Task<AchievementDto> UpdateAchievementAsync(int id, UpdateAchievementRequest request, CancellationToken ct = default)
        {
            var entity = await _db.Achievements.FirstOrDefaultAsync(a => a.Id == id, ct)
                ?? throw new NotFoundException(nameof(Achievement), id);

            if (request.HabitId.HasValue && request.HabitId != entity.HabitId)
                await EnsureHabitExists(request.HabitId.Value, ct);

            entity.Title = request.Title.Trim();
            entity.Description = request.Description;
            entity.ColorHex = request.ColorHex;
            entity.IconUrl = request.IconUrl;
            entity.ConditionKey = request.ConditionKey;
            entity.TargetValue = request.TargetValue;
            entity.HabitId = request.HabitId;

            await _db.SaveChangesAsync(ct);
            return MapAchievement(entity);
        }

        public async Task DeleteAchievementAsync(int id, CancellationToken ct = default)
        {
            var entity = await _db.Achievements.FirstOrDefaultAsync(a => a.Id == id, ct)
                ?? throw new NotFoundException(nameof(Achievement), id);

            entity.IsArchived = true;
            await _db.SaveChangesAsync(ct);
        }

        // ──────────────────────────── Helpers ────────────────────────────

        private async Task EnsureCategoryExists(int categoryId, CancellationToken ct)
        {
            var exists = await _db.Categories.AnyAsync(c => c.Id == categoryId, ct);
            if (!exists)
                throw new ValidationException($"Category with id '{categoryId}' does not exist or has been archived.");
        }

        private async Task EnsureHabitExists(int habitId, CancellationToken ct)
        {
            var exists = await _db.Habits.AnyAsync(h => h.Id == habitId, ct);
            if (!exists)
                throw new ValidationException($"Habit with id '{habitId}' does not exist or has been archived.");
        }

        private static CategoryDto MapCategory(Category c) => new()
        {
            Id = c.Id,
            Name = c.Name,
            ColorHex = c.ColorHex,
            IconEmoji = c.IconEmoji,
            IsNegative = c.IsNegative
        };

        private static HabitDto MapHabit(Habit h) => new()
        {
            Id = h.Id,
            CategoryId = h.CategoryId,
            Title = h.Title,
            Description = h.Description,
            ColorHex = h.ColorHex,
            IconEmoji = h.IconEmoji,
            IsNegative = h.IsNegative
        };

        private static AchievementDto MapAchievement(Achievement a) => new()
        {
            Id = a.Id,
            Title = a.Title,
            Description = a.Description,
            ColorHex = a.ColorHex,
            IconUrl = a.IconUrl,
            ConditionKey = a.ConditionKey,
            TargetValue = a.TargetValue,
            HabitId = a.HabitId
        };
    }
}