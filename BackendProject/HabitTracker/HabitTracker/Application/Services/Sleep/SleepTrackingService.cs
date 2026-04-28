using HabitTracker.Application.Abstractions;
using HabitTracker.Application.Common.Exceptions;
using HabitTracker.Application.DTOs.Sleep;
using HabitTracker.Data;
using HabitTracker.Domain.Entities;
using HabitTracker.Domain.Events;
using Microsoft.EntityFrameworkCore;

namespace HabitTracker.Application.Services.Sleep
{
    /// <summary>
    /// Default <see cref="ISleepTrackingService"/>. Wraps log+event in a single SaveChanges,
    /// and exposes a profile upsert that strictly distinguishes user-owned parameters from
    /// algorithm-owned counters (<c>SleepDebtMinutes</c>, <c>CurrentWakeTime</c>).
    /// </summary>
    public sealed class SleepTrackingService : ISleepTrackingService
    {
        private readonly AppDbContext _db;
        private readonly IOutboxWriter _outbox;

        public SleepTrackingService(AppDbContext db, IOutboxWriter outbox)
        {
            _db = db;
            _outbox = outbox;
        }

        public async Task<SleepLogDto> LogSleepAsync(
            Guid userId,
            LogSleepRequest request,
            CancellationToken ct = default)
        {
            // Defensive validation — duplicates the [Range] / DB CHECK so the service stays usable
            // outside the controller pipeline.
            if (request.SleepEnd <= request.SleepStart)
                throw new ValidationException("Sleep end time must be strictly after sleep start time.");
            if (request.SleepQuality is < 1 or > 10)
                throw new ValidationException("Sleep quality must be between 1 and 10.");

            var sleepLog = new SleepLog
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                SleepStart = DateTime.SpecifyKind(request.SleepStart, DateTimeKind.Utc),
                SleepEnd = DateTime.SpecifyKind(request.SleepEnd, DateTimeKind.Utc),
                SleepQuality = request.SleepQuality,
                Tags = request.Tags ?? new List<string>()
            };

            _db.SleepLogs.Add(sleepLog);

            await _outbox.EnqueueAsync(new SleepLoggedEvent(
                UserId: userId,
                SleepLogId: sleepLog.Id,
                SleepStart: sleepLog.SleepStart,
                SleepEnd: sleepLog.SleepEnd,
                SleepQuality: sleepLog.SleepQuality,
                Tags: sleepLog.Tags
            ), ct);

            await _db.SaveChangesAsync(ct);

            return MapLog(sleepLog);
        }

        public async Task<IReadOnlyList<SleepLogDto>> GetRecentSleepLogsAsync(
            Guid userId,
            int take,
            CancellationToken ct = default)
        {
            if (take <= 0) take = 30;
            if (take > 365) take = 365;

            return await _db.SleepLogs.AsNoTracking()
                .Where(s => s.UserId == userId)
                .OrderByDescending(s => s.SleepStart)
                .Take(take)
                .Select(s => new SleepLogDto
                {
                    Id = s.Id,
                    SleepStart = s.SleepStart,
                    SleepEnd = s.SleepEnd,
                    SleepQuality = s.SleepQuality,
                    Tags = s.Tags
                })
                .ToListAsync(ct);
        }

        public async Task<IReadOnlyList<SleepLogDto>> GetSleepLogsAsync(
            Guid userId,
            DateTime? from,
            DateTime? to,
            CancellationToken ct = default)
        {
            var startDate = from.HasValue ? DateTime.SpecifyKind(from.Value, DateTimeKind.Utc) : DateTime.UtcNow.AddDays(-7);
            var endDate = to.HasValue ? DateTime.SpecifyKind(to.Value, DateTimeKind.Utc) : DateTime.UtcNow;

            return await _db.SleepLogs.AsNoTracking()
                .Where(s => s.UserId == userId && s.SleepStart >= startDate && s.SleepStart <= endDate)
                .OrderBy(s => s.SleepStart)
                .Select(s => new SleepLogDto
                {
                    Id = s.Id,
                    SleepStart = s.SleepStart,
                    SleepEnd = s.SleepEnd,
                    SleepQuality = s.SleepQuality,
                    Tags = s.Tags
                })
                .ToListAsync(ct);
        }

        public async Task<SleepProfileDto?> GetSleepProfileAsync(
            Guid userId,
            CancellationToken ct = default)
        {
            var profile = await _db.UserSleepProfiles.AsNoTracking()
                .FirstOrDefaultAsync(p => p.UserId == userId, ct);

            return profile is null ? null : MapProfile(profile);
        }

        public async Task<SleepProfileDto> UpsertSleepProfileAsync(
            Guid userId,
            UpsertSleepProfileRequest request,
            CancellationToken ct = default)
        {
            if (request.AbsoluteMinSleepHours <= 0)
                throw new ValidationException("AbsoluteMinSleepHours must be greater than zero.");
            if (request.AbsoluteMinSleepHours > request.BaseSleepHours)
                throw new ValidationException("AbsoluteMinSleepHours cannot exceed BaseSleepHours.");

            var profile = await _db.UserSleepProfiles.FirstOrDefaultAsync(p => p.UserId == userId, ct);

            if (profile is null)
            {
                profile = new UserSleepProfile
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    TargetWakeTime = request.TargetWakeTime,
                    BaseSleepHours = request.BaseSleepHours,
                    AbsoluteMinSleepHours = request.AbsoluteMinSleepHours,
                    ShiftStepMinutes = request.ShiftStepMinutes,
                    WeekendDeviationHours = request.WeekendDeviationHours,
                    CurrentWakeTime = null,
                    SleepDebtMinutes = 0
                };
                _db.UserSleepProfiles.Add(profile);
            }
            else
            {
                profile.TargetWakeTime = request.TargetWakeTime;
                profile.BaseSleepHours = request.BaseSleepHours;
                profile.AbsoluteMinSleepHours = request.AbsoluteMinSleepHours;
                profile.ShiftStepMinutes = request.ShiftStepMinutes;
                profile.WeekendDeviationHours = request.WeekendDeviationHours;
                // CurrentWakeTime / SleepDebtMinutes are owned by the maintenance job — do NOT touch.
            }

            await _db.SaveChangesAsync(ct);
            return MapProfile(profile);
        }

        // ──────────────────────────── Mapping ────────────────────────────

        private static SleepLogDto MapLog(SleepLog s) => new()
        {
            Id = s.Id,
            SleepStart = s.SleepStart,
            SleepEnd = s.SleepEnd,
            SleepQuality = s.SleepQuality,
            Tags = s.Tags
        };

        private static SleepProfileDto MapProfile(UserSleepProfile p) => new()
        {
            Id = p.Id,
            TargetWakeTime = p.TargetWakeTime,
            BaseSleepHours = p.BaseSleepHours,
            AbsoluteMinSleepHours = p.AbsoluteMinSleepHours,
            ShiftStepMinutes = p.ShiftStepMinutes,
            WeekendDeviationHours = p.WeekendDeviationHours,
            CurrentWakeTime = p.CurrentWakeTime,
            SleepDebtMinutes = p.SleepDebtMinutes
        };
    }
}