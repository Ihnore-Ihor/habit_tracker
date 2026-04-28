using HabitTracker.Application.Common.Exceptions;
using HabitTracker.Data;
using HabitTracker.Domain.Entities;
using HabitTracker.Domain.ValueObjects;
using Microsoft.EntityFrameworkCore;

namespace HabitTracker.Application.Services.Sleep
{
    /// <summary>
    /// "Sleep Router" — generates an iterative, debt-aware, GPS-corrected night-by-night sleep plan.
    ///
    /// Algorithm summary (three interlocking steps):
    ///   Step 1 (Morning Planning)  — next wake time, planned sleep need, ideal bedtime.
    ///   Step 2 (Evening Rollback)  — prevent less than AbsoluteMinSleepHours by forcing wake later.
    ///   Step 3 (GPS / Penalties)   — replay past logs to update sleep-debt and hard-reset wake anchor.
    /// </summary>
    public sealed class SleepRecommendationService : ISleepRecommendationService
    {
        private readonly AppDbContext _db;

        public SleepRecommendationService(AppDbContext db) => _db = db;

        // ── Public API ────────────────────────────────────────────────────────────────

        public async Task<SleepPlan> GeneratePlanForNextDaysAsync(
            Guid userId,
            int days = 7,
            CancellationToken ct = default)
        {
            if (days is < 1 or > 30)
                throw new ValidationException("days must be between 1 and 30.");

            var profile = await _db.UserSleepProfiles.AsNoTracking()
                .FirstOrDefaultAsync(p => p.UserId == userId, ct)
                ?? throw new ValidationException(
                    "No sleep profile found. Create one via PUT /api/sleep/profile before generating a plan.");

            var today = DateTime.UtcNow.Date;

            // Load past 14 days of logs chronologically for state reconstruction (Step 3).
            var pastLogs = await _db.SleepLogs.AsNoTracking()
                .Where(s => s.UserId == userId
                         && s.SleepEnd > today.AddDays(-14)
                         && s.SleepEnd <= today)
                .OrderBy(s => s.SleepEnd)
                .ToListAsync(ct);

            // ── Initialise algorithm state from the persisted profile ─────────────────
            var currentWake = profile.CurrentWakeTime ?? profile.TargetWakeTime;
            var debtMinutes = profile.SleepDebtMinutes;

            // ── Phase 1: Replay past logs to arrive at accurate current state (Step 3) ─
            // "PlannedSleep" for debt accounting purposes is always BaseSleepHours (the baseline);
            // sleeping more than baseline reduces debt, sleeping less increases it.
            foreach (var log in pastLogs)
            {
                var baseSleepMinutes   = (int)(profile.BaseSleepHours * 60);
                var actualSleepMinutes = (int)(log.SleepEnd - log.SleepStart).TotalMinutes;

                bool hasPenaltyTag = log.Tags.Any(t =>
                    string.Equals(t, "Alcohol", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(t, "Stress",  StringComparison.OrdinalIgnoreCase));

                // Penalty: alcohol / stress cancel any debt payoff — only accumulate, never reduce.
                if (hasPenaltyTag)
                    debtMinutes += Math.Max(0, baseSleepMinutes - actualSleepMinutes);
                else
                    debtMinutes = Math.Max(0, debtMinutes + baseSleepMinutes - actualSleepMinutes);

                // GPS Reroute: if actual wake deviates from expected by > 1.5 h, hard-reset the anchor.
                var actualWake = TimeOnly.FromDateTime(log.SleepEnd);
                if (CircularHourDiff(actualWake, currentWake) > 1.5)
                    currentWake = actualWake;
            }

            // ── Phase 2: Generate the forward plan (Step 1 + Step 2 per day) ──────────
            var plan = new SleepPlan();
            var freezeShift = false;

            for (int i = 0; i < days; i++)
            {
                var wakeDate = today.AddDays(i + 1);
                var isWeekend = wakeDate.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;

                // ── Step 1: Next Wake Time ────────────────────────────────────────────
                TimeOnly nextWake;
                if (isWeekend)
                {
                    // Weekend: fixed at TargetWakeTime + allowed deviation; shift does not apply.
                    nextWake = profile.TargetWakeTime.AddMinutes((int)(profile.WeekendDeviationHours * 60));
                }
                else if (freezeShift)
                {
                    // Rollback protection from previous iteration holds the current anchor.
                    nextWake = currentWake;
                }
                else
                {
                    // Weekday: advance toward TargetWakeTime by one ShiftStep, floored at target.
                    var targetMins  = profile.TargetWakeTime.Hour * 60 + profile.TargetWakeTime.Minute;
                    var currentMins = currentWake.Hour * 60 + currentWake.Minute;
                    var nextMins    = Math.Max(targetMins, currentMins - profile.ShiftStepMinutes);
                    nextWake        = new TimeOnly(nextMins / 60, nextMins % 60);
                }

                // ── Step 1: Planned Sleep Need ────────────────────────────────────────
                // ≥90 min of debt triggers a 1.5-hour recovery night.
                var plannedSleepHours = debtMinutes >= 90
                    ? profile.BaseSleepHours + 1.5m
                    : profile.BaseSleepHours;
                // Never plan below the hard floor.
                plannedSleepHours = Math.Max(plannedSleepHours, profile.AbsoluteMinSleepHours);

                // ── Step 1: Ideal Bedtime ─────────────────────────────────────────────
                // 15-minute buffer accounts for sleep-onset latency.
                var bedOffsetMinutes = (int)(plannedSleepHours * 60) + 15;
                var idealBedtime     = nextWake.AddMinutes(-bedOffsetMinutes);

                // ── Step 2: Evening Rollback Protection (simulated) ───────────────────
                // If the forward gap from bedtime to wake is less than the hard floor,
                // push the wake time later and freeze further shifting.
                var forwardGapHours = ForwardHours(idealBedtime, nextWake);
                if (forwardGapHours < (double)profile.AbsoluteMinSleepHours)
                {
                    nextWake    = idealBedtime.AddMinutes((int)(profile.AbsoluteMinSleepHours * 60));
                    freezeShift = true;
                }
                else
                {
                    freezeShift = false;
                }

                plan.Days.Add(new SleepPlanDay
                {
                    Date              = DateOnly.FromDateTime(wakeDate),
                    IdealBedtime      = idealBedtime,
                    PlannedWake       = nextWake,
                    PlannedSleepHours = plannedSleepHours,
                    Zeitgebers = new Zeitgebers
                    {
                        LastCaffeine = idealBedtime.AddMinutes(-600),  // 10 h before bed
                        LastMeal     = idealBedtime.AddMinutes(-180),  //  3 h before bed
                        ScreensOff   = idealBedtime.AddMinutes(-60)    //  1 h before bed
                    }
                });

                // ── Simulate state for next iteration (assume perfect adherence) ───────
                if (!isWeekend && !freezeShift)
                    currentWake = nextWake;

                // Simulated debt payoff: each debt-recovery night removes 90 min.
                if (debtMinutes >= 90)
                    debtMinutes = Math.Max(0, debtMinutes - 90);
            }

            _db.SleepRecommendations.Add(new SleepRecommendation
            {
                Id          = Guid.NewGuid(),
                UserId      = userId,
                GeneratedAt = DateTime.UtcNow,
                SleepPlan   = plan
            });

            await _db.SaveChangesAsync(ct);
            return plan;
        }

        public async Task<SleepPlan?> GetLatestRecommendationAsync(
            Guid userId,
            CancellationToken ct = default)
        {
            var latest = await _db.SleepRecommendations.AsNoTracking()
                .Where(r => r.UserId == userId)
                .OrderByDescending(r => r.GeneratedAt)
                .FirstOrDefaultAsync(ct);

            return latest?.SleepPlan;
        }

        // ── Private helpers ───────────────────────────────────────────────────────────

        /// <summary>Shortest circular distance between two clock times (result in [0, 12] hours).</summary>
        private static double CircularHourDiff(TimeOnly a, TimeOnly b)
        {
            var diff = Math.Abs((a.ToTimeSpan() - b.ToTimeSpan()).TotalHours);
            return diff > 12.0 ? 24.0 - diff : diff;
        }

        /// <summary>
        /// Forward (clockwise) time from <paramref name="from"/> to <paramref name="to"/>, in hours.
        /// Result is in [0, 24).
        /// </summary>
        private static double ForwardHours(TimeOnly from, TimeOnly to)
        {
            var diff = to.ToTimeSpan() - from.ToTimeSpan();
            if (diff < TimeSpan.Zero) diff += TimeSpan.FromDays(1);
            return diff.TotalHours;
        }
    }
}
