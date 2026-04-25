using HabitTracker.Application.Abstractions;
using HabitTracker.Application.Common.Exceptions;
using HabitTracker.Application.DTOs.UserHabits;
using HabitTracker.Data;
using HabitTracker.Domain.Entities;
using HabitTracker.Domain.Events;
using HabitTracker.Domain.ValueObjects;
using Microsoft.EntityFrameworkCore;

namespace HabitTracker.Application.Services.UserHabits
{
    /// <summary>
    /// Default <see cref="IUserHabitService"/>. Subscription writes the new <c>UserHabit</c>;
    /// execution logging writes a <c>HabitExecution</c> and enqueues a <c>HabitExecutedEvent</c>
    /// inside a single <c>SaveChangesAsync</c> so the gamification dispatch can never be lost.
    /// </summary>
    public sealed class UserHabitService : IUserHabitService
    {
        /// <summary>Retro-log window: A2 spec — users may log up to 30 days back, anything older is rejected.</summary>
        private static readonly TimeSpan MaxBackdate = TimeSpan.FromDays(30);

        private readonly AppDbContext _db;
        private readonly IOutboxWriter _outbox;

        public UserHabitService(AppDbContext db, IOutboxWriter outbox)
        {
            _db = db;
            _outbox = outbox;
        }

        public async Task<UserHabitDto> SubscribeToHabitAsync(
            Guid userId,
            SubscribeToHabitRequest request,
            CancellationToken ct = default)
        {
            // Either a catalog template OR a custom name — never neither, never both blank.
            var hasTemplate = request.HabitId.HasValue;
            var hasCustomName = !string.IsNullOrWhiteSpace(request.CustomName);
            if (!hasTemplate && !hasCustomName)
                throw new ValidationException("Either HabitId (catalog template) or CustomName (custom habit) must be provided.");

            var categoryExists = await _db.Categories.AnyAsync(c => c.Id == request.CategoryId, ct);
            if (!categoryExists)
                throw new ValidationException($"Category with id '{request.CategoryId}' does not exist or has been archived.");

            string? resolvedTitle = null;
            if (hasTemplate)
            {
                var template = await _db.Habits.AsNoTracking()
                    .FirstOrDefaultAsync(h => h.Id == request.HabitId!.Value, ct)
                    ?? throw new ValidationException($"Habit with id '{request.HabitId}' does not exist or has been archived.");
                resolvedTitle = template.Title;
            }

            var subscription = new UserHabit
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                HabitId = request.HabitId,
                CategoryId = request.CategoryId,
                CustomName = hasCustomName ? request.CustomName!.Trim() : null,
                IsNegative = request.IsNegative,
                TargetValue = request.TargetValue,
                MetricUnit = request.MetricUnit,
                FrequencyType = request.FrequencyType,
                ScheduleRule = MapScheduleRule(request.ScheduleRule),
                ColorHex = request.ColorHex,
                IconEmoji = request.IconEmoji,
                CurrentStreak = 0,
                LongestStreak = 0,
                IsArchived = false
            };

            _db.UserHabits.Add(subscription);
            await _db.SaveChangesAsync(ct);

            return MapUserHabit(subscription, resolvedTitle);
        }

        public async Task<IReadOnlyList<UserHabitDto>> GetActiveUserHabitsAsync(
            Guid userId,
            CancellationToken ct = default)
        {
            // Project Habit.Title alongside so the read model can fall back template → custom for DisplayTitle
            // without forcing the caller to do a second round trip.
            var rows = await _db.UserHabits.AsNoTracking()
                .Where(uh => uh.UserId == userId)
                .OrderByDescending(uh => uh.CurrentStreak)
                .Select(uh => new { Subscription = uh, TemplateTitle = uh.Habit != null ? uh.Habit.Title : null })
                .ToListAsync(ct);

            return rows.Select(r => MapUserHabit(r.Subscription, r.TemplateTitle)).ToList();
        }

        public async Task<HabitExecutionDto> LogExecutionAsync(
            Guid userId,
            Guid userHabitId,
            LogExecutionRequest request,
            CancellationToken ct = default)
        {
            var subscription = await _db.UserHabits
                .FirstOrDefaultAsync(uh => uh.Id == userHabitId && uh.UserId == userId, ct)
                ?? throw new NotFoundException(nameof(UserHabit), userHabitId);

            var nowUtc = DateTime.UtcNow;
            var executionTime = (request.ExecutionTime ?? nowUtc).ToUniversalTime();

            if (executionTime > nowUtc.AddMinutes(5))
                throw new ValidationException("ExecutionTime cannot be in the future.");
            if (nowUtc - executionTime > MaxBackdate)
                throw new ValidationException($"Executions can only be back-dated up to {MaxBackdate.TotalDays:F0} days.");

            var execution = new HabitExecution
            {
                Id = Guid.NewGuid(),
                UserHabitId = subscription.Id,
                ExecutionTime = DateTime.SpecifyKind(executionTime, DateTimeKind.Utc),
                LoggedValue = request.LoggedValue,
                Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim()
                // CreatedAt is server-generated via DEFAULT NOW().
            };

            _db.HabitExecutions.Add(execution);

            await _outbox.EnqueueAsync(new HabitExecutedEvent(
                UserId: userId,
                UserHabitId: subscription.Id,
                ExecutionTime: execution.ExecutionTime,
                LoggedValue: execution.LoggedValue
            ), ct);

            // Single transaction — the execution row and the outbox row commit together or not at all.
            await _db.SaveChangesAsync(ct);

            return MapExecution(execution);
        }

        public async Task<IReadOnlyList<HabitExecutionDto>> GetRecentExecutionsAsync(
            Guid userId,
            int take,
            CancellationToken ct = default)
        {
            if (take <= 0) take = 50;
            if (take > 500) take = 500;

            return await _db.HabitExecutions.AsNoTracking()
                .Where(e => e.UserHabit.UserId == userId)
                .OrderByDescending(e => e.ExecutionTime)
                .Take(take)
                .Select(e => new HabitExecutionDto
                {
                    Id = e.Id,
                    UserHabitId = e.UserHabitId,
                    ExecutionTime = e.ExecutionTime,
                    CreatedAt = e.CreatedAt,
                    LoggedValue = e.LoggedValue,
                    Note = e.Note
                })
                .ToListAsync(ct);
        }

        // ──────────────────────────── Mapping ────────────────────────────

        private static ScheduleRule? MapScheduleRule(ScheduleRuleDto? dto)
        {
            if (dto is null) return null;
            return new ScheduleRule
            {
                TimeSlot = dto.TimeSlot,
                ExactTime = dto.ExactTime,
                DaysOfWeek = dto.DaysOfWeek,
                DayOfMonth = dto.DayOfMonth,
                OneTimeDate = dto.OneTimeDate,
                TimesPerPeriod = dto.TimesPerPeriod
            };
        }

        private static ScheduleRuleDto? MapScheduleRule(ScheduleRule? rule)
        {
            if (rule is null) return null;
            return new ScheduleRuleDto
            {
                TimeSlot = rule.TimeSlot,
                ExactTime = rule.ExactTime,
                DaysOfWeek = rule.DaysOfWeek,
                DayOfMonth = rule.DayOfMonth,
                OneTimeDate = rule.OneTimeDate,
                TimesPerPeriod = rule.TimesPerPeriod
            };
        }

        private static UserHabitDto MapUserHabit(UserHabit uh, string? templateTitle) => new()
        {
            Id = uh.Id,
            HabitId = uh.HabitId,
            CategoryId = uh.CategoryId,
            CustomName = uh.CustomName,
            DisplayTitle = uh.CustomName ?? templateTitle ?? "Untitled habit",
            IsNegative = uh.IsNegative,
            TargetValue = uh.TargetValue,
            MetricUnit = uh.MetricUnit,
            FrequencyType = uh.FrequencyType,
            ScheduleRule = MapScheduleRule(uh.ScheduleRule),
            ColorHex = uh.ColorHex,
            IconEmoji = uh.IconEmoji,
            CurrentStreak = uh.CurrentStreak,
            LongestStreak = uh.LongestStreak
        };

        private static HabitExecutionDto MapExecution(HabitExecution e) => new()
        {
            Id = e.Id,
            UserHabitId = e.UserHabitId,
            ExecutionTime = e.ExecutionTime,
            CreatedAt = e.CreatedAt,
            LoggedValue = e.LoggedValue,
            Note = e.Note
        };
    }
}