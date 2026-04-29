using HabitTracker.Application.DTOs.Analyst;
using HabitTracker.Data;
using HabitTracker.Domain.Entities;
using HabitTracker.Models;
using Microsoft.EntityFrameworkCore;

namespace HabitTracker.Application.Services.Analyst
{
    public sealed class AnalystDashboardService : IAnalystDashboardService
    {
        private readonly AppDbContext _db;

        public AnalystDashboardService(AppDbContext db) => _db = db;

        // ── 1. Habit needs-attention ──────────────────────────────────────────────

        public async Task<IReadOnlyList<HabitNeedsAttentionDto>> GetHabitsNeedingAttentionAsync(
            CancellationToken ct = default)
        {
            return await _db.GlobalHabitStatsViews
                .AsNoTracking()
                .OrderByDescending(v => v.DropoffRatePct)
                .Select(v => new HabitNeedsAttentionDto
                {
                    HabitId           = v.HabitId,
                    Title             = v.Title,
                    SubscribersActive  = v.SubscribersActive,
                    AvgExecutions     = v.AvgExecutionsPerActiveUser,
                    DropoffRatePct    = v.DropoffRatePct,
                })
                .ToListAsync(ct);
        }

        // ── 2. Sleep AI effectiveness ─────────────────────────────────────────────

        public async Task<SleepEffectivenessDto> GetSleepEffectivenessAsync(
            CancellationToken ct = default)
        {
            var rows = await _db.SleepEffectivenessViews.AsNoTracking().ToListAsync(ct);

            var adherent    = rows.FirstOrDefault(r => r.Cohort == "adherent");
            var nonAdherent = rows.FirstOrDefault(r => r.Cohort == "non_adherent");

            var totalUsers = (adherent?.NUsers ?? 0L) + (nonAdherent?.NUsers ?? 0L);

            var adherenceRatePct = totalUsers > 0
                ? Math.Round((decimal)(adherent?.NUsers ?? 0L) / totalUsers * 100m, 1)
                : 0m;

            // Delta = adherent mean − non-adherent mean, expressed as % of the 10-point PAD range.
            var moodDelta             = (adherent?.MeanP ?? 0m) - (nonAdherent?.MeanP ?? 0m);
            var arousalDelta          = (adherent?.MeanA ?? 0m) - (nonAdherent?.MeanA ?? 0m);
            var dominanceDelta        = (adherent?.MeanD ?? 0m) - (nonAdherent?.MeanD ?? 0m);

            var morningMoodDeltaPct       = Math.Round(moodDelta      / 10m * 100m, 1);
            var sleepQualityDeltaPct      = Math.Round(arousalDelta   / 10m * 100m, 1);
            var nextDayCompletionDeltaPct = Math.Round(dominanceDelta / 10m * 100m, 1);

            return new SleepEffectivenessDto
            {
                AdherenceRatePct          = adherenceRatePct,
                MorningMoodDeltaPct       = morningMoodDeltaPct,
                SleepQualityDeltaPct      = sleepQualityDeltaPct,
                NextDayCompletionDeltaPct = nextDayCompletionDeltaPct,
                KeyInsight                = BuildKeyInsight(adherenceRatePct, morningMoodDeltaPct, sleepQualityDeltaPct),
            };
        }

        // ── 3. Habit trends ───────────────────────────────────────────────────────

        public async Task<IReadOnlyList<HabitTrendDto>> GetHabitTrendsAsync(
            CancellationToken ct = default)
        {
            // Fetch the impact view rows first.
            var impacts = await _db.ProposalImpactViews
                .AsNoTracking()
                .ToListAsync(ct);

            if (impacts.Count == 0)
                return Array.Empty<HabitTrendDto>();

            // Resolve habit names in one round-trip; bypass soft-delete filter so archived habits
            // that still have impact data remain visible on the dashboard.
            var habitIds = impacts
                .Where(p => p.HabitId.HasValue)
                .Select(p => p.HabitId!.Value)
                .Distinct()
                .ToList();

            var habitNames = await _db.Habits
                .IgnoreQueryFilters()
                .Where(h => habitIds.Contains(h.Id))
                .AsNoTracking()
                .Select(h => new { h.Id, h.Title })
                .ToListAsync(ct);

            var nameMap = habitNames.ToDictionary(h => h.Id, h => h.Title);

            return impacts
                .OrderByDescending(p => Math.Abs(p.MomChangePct ?? 0m))
                .Select(p => new HabitTrendDto
                {
                    HabitId              = p.HabitId ?? 0,
                    HabitName            = p.HabitId.HasValue
                                              ? nameMap.GetValueOrDefault(p.HabitId.Value, "Unknown Habit")
                                              : "General",
                    TrendDirection       = (p.MomChangePct ?? 0m) >= 0m ? "Up" : "Down",
                    CompletionRateDeltaPct = p.MomChangePct ?? 0m,
                    // AvgUserMoodDelta: no per-habit mood data yet in this sprint — returns 0 as a
                    // stable placeholder; the affect correlation pipeline will supply real values.
                    AvgUserMoodDelta     = 0m,
                })
                .ToList();
        }

        // ── 4. Proposals ─────────────────────────────────────────────────────────

        public async Task<AnalystProposalDto> CreateProposalAsync(
            Guid analystId,
            CreateProposalRequest request,
            CancellationToken ct = default)
        {
            var proposal = new AnalystProposal
            {
                Id          = Guid.NewGuid(),
                AnalystId   = analystId,
                HabitId     = request.HabitId,
                Title       = request.ProposedChange,
                Description = request.Argumentation,
                CreatedAt   = DateTime.UtcNow,
                Status      = ProposalStatus.Pending,
            };

            _db.AnalystProposals.Add(proposal);
            await _db.SaveChangesAsync(ct);

            // Resolve habit name for the response (if any) — single-row lookup is fine here.
            string? habitName = null;
            if (proposal.HabitId.HasValue)
            {
                habitName = await _db.Habits
                    .IgnoreQueryFilters()
                    .Where(h => h.Id == proposal.HabitId.Value)
                    .Select(h => h.Title)
                    .FirstOrDefaultAsync(ct);
            }

            return MapProposal(proposal, habitName, analystName: null);
        }

        public async Task<IReadOnlyList<AnalystProposalDto>> GetMyProposalsAsync(
            Guid analystId,
            CancellationToken ct = default)
        {
            return await (
                from p in _db.AnalystProposals
                join h in _db.Habits.IgnoreQueryFilters()
                    on p.HabitId equals h.Id into hGroup
                from h in hGroup.DefaultIfEmpty()
                where p.AnalystId == analystId
                orderby p.CreatedAt descending
                select new AnalystProposalDto
                {
                    Id             = p.Id,
                    HabitId        = p.HabitId,
                    HabitName      = h != null ? h.Title : null,
                    AnalystId      = p.AnalystId,
                    AnalystName    = null,
                    ProposedChange = p.Title,
                    Argumentation  = p.Description,
                    Status         = (int)p.Status,
                    CreatedAt      = p.CreatedAt,
                }
            ).AsNoTracking().ToListAsync(ct);
        }

        public async Task<IReadOnlyList<AnalystProposalDto>> GetOthersProposalsAsync(
            Guid analystId,
            CancellationToken ct = default)
        {
            return await (
                from p in _db.AnalystProposals
                join h in _db.Habits.IgnoreQueryFilters()
                    on p.HabitId equals h.Id into hGroup
                from h in hGroup.DefaultIfEmpty()
                join u in _db.Users on p.AnalystId equals u.Id
                where p.AnalystId != analystId
                orderby p.CreatedAt descending
                select new AnalystProposalDto
                {
                    Id             = p.Id,
                    HabitId        = p.HabitId,
                    HabitName      = h != null ? h.Title : null,
                    AnalystId      = p.AnalystId,
                    AnalystName    = u.Nickname,
                    ProposedChange = p.Title,
                    Argumentation  = p.Description,
                    Status         = (int)p.Status,
                    CreatedAt      = p.CreatedAt,
                }
            ).AsNoTracking().ToListAsync(ct);
        }

        // ── Helpers ───────────────────────────────────────────────────────────────

        private static AnalystProposalDto MapProposal(
            AnalystProposal p,
            string? habitName,
            string? analystName) => new()
        {
            Id             = p.Id,
            HabitId        = p.HabitId,
            HabitName      = habitName,
            AnalystId      = p.AnalystId,
            AnalystName    = analystName,
            ProposedChange = p.Title,
            Argumentation  = p.Description,
            Status         = (int)p.Status,
            CreatedAt      = p.CreatedAt,
        };

        private static string BuildKeyInsight(
            decimal adherenceRatePct,
            decimal moodDeltaPct,
            decimal sleepQualityDeltaPct)
        {
            if (adherenceRatePct >= 70m && moodDeltaPct > 5m)
                return "Strong signal: high plan adherence correlates with significantly better morning mood — consider surfacing the recommendation more prominently.";
            if (adherenceRatePct < 30m)
                return "Low adherence rate — the recommended schedule may be too aggressive. Consider increasing ShiftStepMinutes tolerance or adding in-app reminders.";
            if (moodDeltaPct > 0m && sleepQualityDeltaPct > 0m)
                return "Adherent users consistently report better mood and sleep quality; nudge campaigns targeting non-adherent users could improve overall outcomes.";
            if (moodDeltaPct <= 0m)
                return "No mood advantage detected for adherent cohort; algorithm parameters may need recalibration against recent user data.";
            return "Moderate adherence benefit detected. Monitor cohort sizes — low sample count may limit statistical reliability.";
        }
    }
}
