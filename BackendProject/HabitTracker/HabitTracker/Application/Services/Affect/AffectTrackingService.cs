using HabitTracker.Application.Abstractions;
using HabitTracker.Application.Common.Exceptions;
using HabitTracker.Application.DTOs.Affect;
using HabitTracker.Data;
using HabitTracker.Domain.Entities;
using HabitTracker.Domain.Events;
using Microsoft.EntityFrameworkCore;

namespace HabitTracker.Application.Services.Affect
{
    public sealed class AffectTrackingService : IAffectTrackingService
    {
        private readonly AppDbContext _db;
        private readonly IOutboxWriter _outbox;

        public AffectTrackingService(AppDbContext db, IOutboxWriter outbox)
        {
            _db = db;
            _outbox = outbox;
        }

        public async Task<AffectEntryDto> LogAffectAsync(
            Guid userId,
            LogAffectRequest request,
            CancellationToken ct = default)
        {
            // Defensive bounds — match the DB CHECK constraints (ck_affect_*_range).
            if (request.PleasureScore is < -5 or > 5
                || request.ArousalScore is < -5 or > 5
                || request.DominanceScore is < -5 or > 5)
                throw new ValidationException("PAD scores must be between -5 and 5.");

            var nowUtc = DateTime.UtcNow;
            var recordedAt = (request.RecordedAt ?? nowUtc).ToUniversalTime();
            if (recordedAt > nowUtc.AddMinutes(5))
                throw new ValidationException("RecordedAt cannot be in the future.");

            var entry = new AffectEntry
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                PleasureScore = request.PleasureScore,
                ArousalScore = request.ArousalScore,
                DominanceScore = request.DominanceScore,
                ContextTags = request.ContextTags ?? new List<string>(),
                Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
                RecordedAt = DateTime.SpecifyKind(recordedAt, DateTimeKind.Utc)
            };

            _db.AffectEntries.Add(entry);

            await _outbox.EnqueueAsync(new AffectEntryRecordedEvent(
                UserId: userId,
                AffectEntryId: entry.Id,
                PleasureScore: entry.PleasureScore,
                ArousalScore: entry.ArousalScore,
                DominanceScore: entry.DominanceScore,
                ContextTags: entry.ContextTags
            ), ct);

            await _db.SaveChangesAsync(ct);

            return Map(entry);
        }

        public async Task<IReadOnlyList<AffectEntryDto>> GetRecentEntriesAsync(
            Guid userId,
            int take,
            CancellationToken ct = default)
        {
            if (take <= 0) take = 50;
            if (take > 500) take = 500;

            return await _db.AffectEntries.AsNoTracking()
                .Where(a => a.UserId == userId)
                .OrderByDescending(a => a.RecordedAt)
                .Take(take)
                .Select(a => new AffectEntryDto
                {
                    Id = a.Id,
                    PleasureScore = a.PleasureScore,
                    ArousalScore = a.ArousalScore,
                    DominanceScore = a.DominanceScore,
                    ContextTags = a.ContextTags,
                    Note = a.Note,
                    RecordedAt = a.RecordedAt
                })
                .ToListAsync(ct);
        }

        public async Task<IReadOnlyList<AffectEntryDto>> GetDailyAffectAsync(
            Guid userId,
            DateTime? date,
            CancellationToken ct = default)
        {
            var targetDate = date.HasValue 
                ? DateTime.SpecifyKind(date.Value.Date, DateTimeKind.Utc) 
                : DateTime.UtcNow.Date;
            var nextDate = targetDate.AddDays(1);

            return await _db.AffectEntries.AsNoTracking()
                .Where(a => a.UserId == userId && a.RecordedAt >= targetDate && a.RecordedAt < nextDate)
                .OrderBy(a => a.RecordedAt)
                .Select(a => new AffectEntryDto
                {
                    Id = a.Id,
                    PleasureScore = a.PleasureScore,
                    ArousalScore = a.ArousalScore,
                    DominanceScore = a.DominanceScore,
                    ContextTags = a.ContextTags,
                    Note = a.Note,
                    RecordedAt = a.RecordedAt
                })
                .ToListAsync(ct);
        }

        public async Task<AffectSummaryDto?> GetDailySummaryAsync(
            Guid userId,
            DateTime? date,
            CancellationToken ct = default)
        {
            var targetDate = date.HasValue 
                ? DateTime.SpecifyKind(date.Value.Date, DateTimeKind.Utc) 
                : DateTime.UtcNow.Date;
            var nextDate = targetDate.AddDays(1);

            var dailyLogs = await _db.AffectEntries.AsNoTracking()
                .Where(ae => ae.UserId == userId && ae.RecordedAt >= targetDate && ae.RecordedAt < nextDate)
                .ToListAsync(ct);

            if (!dailyLogs.Any())
            {
                return null;
            }

            return new AffectSummaryDto
            {
                p_centroid = Math.Round(dailyLogs.Average(x => x.PleasureScore), 1),
                a_centroid = Math.Round(dailyLogs.Average(x => x.ArousalScore), 1),
                d_centroid = Math.Round(dailyLogs.Average(x => x.DominanceScore), 1)
            };
        }

        private static AffectEntryDto Map(AffectEntry a) => new()
        {
            Id = a.Id,
            PleasureScore = a.PleasureScore,
            ArousalScore = a.ArousalScore,
            DominanceScore = a.DominanceScore,
            ContextTags = a.ContextTags,
            Note = a.Note,
            RecordedAt = a.RecordedAt
        };
    }
}
