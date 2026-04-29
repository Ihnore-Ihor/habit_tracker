using HabitTracker.Application.Common.Exceptions;
using HabitTracker.Application.DTOs.ContentManager;
using HabitTracker.Data;
using HabitTracker.Domain.Entities;
using HabitTracker.Models;
using Microsoft.EntityFrameworkCore;

namespace HabitTracker.Application.Services.ContentManager
{
    public sealed class ContentManagerService : IContentManagerService
    {
        private readonly AppDbContext _db;

        public ContentManagerService(AppDbContext db) => _db = db;

        // ── Proposals ──────────────────────────────────────────────────────────────

        public async Task<IReadOnlyList<ProposalManagerDto>> GetProposalsAsync(CancellationToken ct = default)
        {
            return await (
                from p in _db.AnalystProposals
                join h in _db.Habits.IgnoreQueryFilters()
                    on p.HabitId equals h.Id into hGroup
                from h in hGroup.DefaultIfEmpty()
                join u in _db.Users on p.AnalystId equals u.Id
                orderby p.CreatedAt descending
                select new ProposalManagerDto
                {
                    Id             = p.Id,
                    HabitTitle     = h != null ? h.Title : null,
                    AnalystName    = u.Nickname,
                    ProposedChange = p.Title,
                    Argumentation  = p.Description,
                    Status         = (int)p.Status,
                    CreatedAt      = p.CreatedAt,
                }
            ).AsNoTracking().ToListAsync(ct);
        }

        public async Task UpdateProposalStatusAsync(Guid id, int status, CancellationToken ct = default)
        {
            if (!Enum.IsDefined(typeof(ProposalStatus), status))
                throw new ValidationException(
                    $"Invalid proposal status '{status}'. Valid values: 0=Pending, 1=Implemented, 2=Rejected.");

            var proposal = await _db.AnalystProposals
                .FirstOrDefaultAsync(p => p.Id == id, ct)
                ?? throw new NotFoundException(nameof(AnalystProposal), id);

            proposal.Status = (ProposalStatus)status;
            await _db.SaveChangesAsync(ct);
        }

        // ── Categories ─────────────────────────────────────────────────────────────

        public async Task<IReadOnlyList<CategoryManagerDto>> GetCategoriesAsync(CancellationToken ct = default)
        {
            return await _db.Categories
                .AsNoTracking()
                .OrderBy(c => c.Name)
                .Select(c => new CategoryManagerDto
                {
                    Id          = c.Id,
                    Name        = c.Name,
                    Description = c.Description,
                    IconEmoji   = c.IconEmoji,
                    ColorHex    = c.ColorHex,
                    IsNegative  = c.IsNegative,
                    HabitCount  = c.Habits.Count(),
                })
                .ToListAsync(ct);
        }

        public async Task<CategoryManagerDto> CreateCategoryAsync(
            CreateCategoryRequest request,
            CancellationToken ct = default)
        {
            var category = new Category
            {
                Name        = request.Name.Trim(),
                Description = request.Description?.Trim(),
                ColorHex    = request.ColorHex,
                IconEmoji   = request.IconEmoji,
                IsNegative  = request.IsNegative,
                IsArchived  = false,
            };

            _db.Categories.Add(category);
            await _db.SaveChangesAsync(ct);

            return new CategoryManagerDto
            {
                Id          = category.Id,
                Name        = category.Name,
                Description = category.Description,
                IconEmoji   = category.IconEmoji,
                ColorHex    = category.ColorHex,
                IsNegative  = category.IsNegative,
                HabitCount  = 0,
            };
        }

        public async Task UpdateCategoryAsync(int id, UpdateCategoryRequest request, CancellationToken ct = default)
        {
            var category = await _db.Categories
                .FirstOrDefaultAsync(c => c.Id == id, ct)
                ?? throw new NotFoundException(nameof(Category), id);

            category.Name        = request.Name.Trim();
            category.Description = request.Description?.Trim();
            category.ColorHex    = request.ColorHex;
            category.IconEmoji   = request.IconEmoji;
            category.IsNegative  = request.IsNegative;

            await _db.SaveChangesAsync(ct);
        }

        public async Task DeleteCategoryAsync(int id, CancellationToken ct = default)
        {
            var category = await _db.Categories
                .FirstOrDefaultAsync(c => c.Id == id, ct)
                ?? throw new NotFoundException(nameof(Category), id);

            category.IsArchived = true;
            await _db.SaveChangesAsync(ct);
        }

        // ── Habits ─────────────────────────────────────────────────────────────────

        public async Task<IReadOnlyList<HabitCatalogDto>> GetHabitsAsync(CancellationToken ct = default)
        {
            return await _db.Habits
                .AsNoTracking()
                .OrderBy(h => h.Title)
                .Select(h => new HabitCatalogDto
                {
                    Id           = h.Id,
                    Title        = h.Title,
                    Description  = h.Description,
                    CategoryId   = h.CategoryId,
                    CategoryName = h.Category.Name,
                    ColorHex     = h.ColorHex,
                    IconEmoji    = h.IconEmoji,
                    IsNegative   = h.IsNegative,
                })
                .ToListAsync(ct);
        }

        public async Task<HabitCatalogDto> CreateHabitAsync(
            CreateHabitRequest request,
            CancellationToken ct = default)
        {
            var category = await _db.Categories
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == request.CategoryId, ct)
                ?? throw new ValidationException(
                    $"Category with id '{request.CategoryId}' was not found.");

            var habit = new Habit
            {
                CategoryId  = request.CategoryId,
                Title       = request.Title.Trim(),
                Description = request.Description?.Trim(),
                ColorHex    = request.ColorHex,
                IconEmoji   = request.IconEmoji,
                IsNegative  = request.IsNegative,
                IsArchived  = false,
            };

            _db.Habits.Add(habit);
            await _db.SaveChangesAsync(ct);

            return new HabitCatalogDto
            {
                Id           = habit.Id,
                Title        = habit.Title,
                Description  = habit.Description,
                CategoryId   = habit.CategoryId,
                CategoryName = category.Name,
                ColorHex     = habit.ColorHex,
                IconEmoji    = habit.IconEmoji,
                IsNegative   = habit.IsNegative,
            };
        }

        public async Task UpdateHabitAsync(int id, UpdateHabitRequest request, CancellationToken ct = default)
        {
            var habit = await _db.Habits
                .FirstOrDefaultAsync(h => h.Id == id, ct)
                ?? throw new NotFoundException(nameof(Habit), id);

            if (habit.CategoryId != request.CategoryId)
            {
                var categoryExists = await _db.Categories.AnyAsync(c => c.Id == request.CategoryId, ct);
                if (!categoryExists)
                    throw new ValidationException(
                        $"Category with id '{request.CategoryId}' was not found.");
            }

            habit.Title       = request.Title.Trim();
            habit.CategoryId  = request.CategoryId;
            habit.Description = request.Description?.Trim();
            habit.ColorHex    = request.ColorHex;
            habit.IconEmoji   = request.IconEmoji;
            habit.IsNegative  = request.IsNegative;

            await _db.SaveChangesAsync(ct);
        }

        public async Task DeleteHabitAsync(int id, CancellationToken ct = default)
        {
            var habit = await _db.Habits
                .FirstOrDefaultAsync(h => h.Id == id, ct)
                ?? throw new NotFoundException(nameof(Habit), id);

            habit.IsArchived = true;
            await _db.SaveChangesAsync(ct);
        }

        // ── Achievements ───────────────────────────────────────────────────────────

        public async Task<IReadOnlyList<AchievementManagerDto>> GetAchievementsAsync(CancellationToken ct = default)
        {
            var entities = await _db.Achievements
                .AsNoTracking()
                .OrderBy(a => a.Title)
                .ToListAsync(ct);

            return entities
                .Select(a => new AchievementManagerDto
                {
                    Id           = a.Id,
                    Title        = a.Title,
                    Description  = a.Description,
                    TargetValue  = a.TargetValue,
                    ConditionKey = a.ConditionKey.ToString(),
                    IconUrl      = a.IconUrl,
                })
                .ToList();
        }

        public async Task<AchievementManagerDto> CreateAchievementAsync(
            CreateAchievementRequest request,
            CancellationToken ct = default)
        {
            var achievement = new Achievement
            {
                Title        = request.Title.Trim(),
                Description  = request.Description,
                ColorHex     = request.ColorHex,
                IconUrl      = request.IconUrl,
                ConditionKey = request.ConditionKey,
                TargetValue  = request.TargetValue,
                IsArchived   = false,
            };

            _db.Achievements.Add(achievement);
            await _db.SaveChangesAsync(ct);

            return new AchievementManagerDto
            {
                Id           = achievement.Id,
                Title        = achievement.Title,
                Description  = achievement.Description,
                TargetValue  = achievement.TargetValue,
                ConditionKey = achievement.ConditionKey.ToString(),
                IconUrl      = achievement.IconUrl,
            };
        }

        public async Task<AchievementManagerDto> UpdateAchievementAsync(
            int id,
            UpdateAchievementRequest request,
            CancellationToken ct = default)
        {
            var achievement = await _db.Achievements
                .IgnoreQueryFilters()           // bypass IsArchived filter so we can unarchive if needed
                .FirstOrDefaultAsync(a => a.Id == id, ct)
                ?? throw new NotFoundException(nameof(Achievement), id);

            achievement.Title        = request.Title.Trim();
            achievement.Description  = request.Description;
            achievement.ColorHex     = request.ColorHex;
            achievement.IconUrl      = request.IconUrl;
            achievement.ConditionKey = request.ConditionKey;
            achievement.TargetValue  = request.TargetValue;

            await _db.SaveChangesAsync(ct);

            return new AchievementManagerDto
            {
                Id           = achievement.Id,
                Title        = achievement.Title,
                Description  = achievement.Description,
                TargetValue  = achievement.TargetValue,
                ConditionKey = achievement.ConditionKey.ToString(),
                IconUrl      = achievement.IconUrl,
            };
        }

        public async Task DeleteAchievementAsync(int id, CancellationToken ct = default)
        {
            // Soft-delete: related user_achievements have Restrict FK, so we cannot hard-delete
            // while user progress rows exist. Setting IsArchived hides the achievement from all
            // queries that use the global query filter without violating constraints.
            var achievement = await _db.Achievements
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(a => a.Id == id, ct)
                ?? throw new NotFoundException(nameof(Achievement), id);

            achievement.IsArchived = true;
            await _db.SaveChangesAsync(ct);
        }
    }
}
