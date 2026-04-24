using HabitTracker.Data;
using HabitTracker.Domain.Events;
using HabitTracker.Models;
using Microsoft.EntityFrameworkCore;

namespace HabitTracker.Application.Gamification.Evaluators
{
    /// <summary>
    /// Evaluates <see cref="ConditionKey.CONSISTENT_BEDTIME_STREAK"/> — consecutive sleep logs whose
    /// local-clock start time lands within ±45 minutes of the user's ideal bedtime.
    ///
    /// <para><b>Ideal bedtime.</b> The schema has no explicit <c>IdealBedtime</c> column;
    /// it is derived as <c>UserSleepProfile.TargetWakeTime − BaseSleepHours</c> (mod 24h),
    /// which is exactly what the smart-sleep algorithm aims at.</para>
    ///
    /// <para><b>Business rule.</b> On every <see cref="SleepLoggedEvent"/>, convert the UTC
    /// <c>SleepStart</c> to the user's local clock, compute the wrap-around minute distance from the
    /// derived ideal bedtime, and compare to the 45-minute tolerance: within tolerance → increment
    /// progress; outside → reset to 0.</para>
    ///
    /// <para><b>Tolerance.</b> Hard-coded to 45 minutes per the spec. If the catalog ever needs
    /// per-achievement tolerances, repurpose <c>Achievement.HabitId</c> to carry it (similar to
    /// <c>CategoryTotalExecutionsEvaluator</c>).</para>
    /// </summary>
    public sealed class ConsistentBedtimeStreakEvaluator : IAchievementEvaluator
    {
        private const int ToleranceMinutes = 45;
        private const int MinutesPerDay = 24 * 60;

        private readonly AppDbContext _db;

        public ConsistentBedtimeStreakEvaluator(AppDbContext db)
        {
            _db = db;
        }

        public ConditionKey Key => ConditionKey.CONSISTENT_BEDTIME_STREAK;

        public async Task EvaluateAsync(EvaluationContext context, CancellationToken ct)
        {
            if (context.Event is not SleepLoggedEvent slept)
                return;

            var target = context.Achievement.TargetValue;
            if (target is null or <= 0)
                return;

            var profile = await _db.UserSleepProfiles
                .Where(p => p.UserId == context.UserId)
                .Select(p => new
                {
                    p.TargetWakeTime,
                    p.BaseSleepHours,
                    Timezone = p.User.Timezone
                })
                .SingleOrDefaultAsync(ct);

            if (profile is null)
                // No profile = no anchor to score against. Skip without resetting; the user has
                // simply never configured the smart-sleep algorithm yet.
                return;

            var idealBedtime = SubtractHours(profile.TargetWakeTime, profile.BaseSleepHours);
            var actualBedtime = ToLocalTimeOfDay(slept.SleepStart.UtcDateTime, profile.Timezone);

            int diffMinutes = WrapAroundMinuteDistance(actualBedtime, idealBedtime);

            if (diffMinutes <= ToleranceMinutes)
            {
                int newProgress = Math.Min(context.Progress.CurrentProgress + 1, target.Value);
                context.Progress.CurrentProgress = newProgress;

                if (newProgress >= target.Value && !context.Progress.IsUnlocked)
                {
                    context.Progress.IsUnlocked = true;
                    context.Progress.UnlockedAt = DateTime.UtcNow;
                }
            }
            else
            {
                context.Progress.CurrentProgress = 0;
            }
        }

        /// <summary>
        /// Subtracts a fractional-hour duration from a wall-clock <see cref="TimeOnly"/>, wrapping
        /// around midnight as needed. Used to derive ideal bedtime from wake time.
        /// </summary>
        private static TimeOnly SubtractHours(TimeOnly time, decimal hours)
        {
            int totalMinutes = (int)Math.Round((decimal)time.Hour * 60 + time.Minute - hours * 60);
            int wrapped = ((totalMinutes % MinutesPerDay) + MinutesPerDay) % MinutesPerDay;
            return new TimeOnly(wrapped / 60, wrapped % 60);
        }

        /// <summary>
        /// Returns the absolute distance between two times-of-day in minutes, taking the SHORTER
        /// path around the 24h clock — so "23:30 vs 00:30" is 60 min, not 23h.
        /// </summary>
        private static int WrapAroundMinuteDistance(TimeOnly a, TimeOnly b)
        {
            int diff = Math.Abs((a.Hour - b.Hour) * 60 + (a.Minute - b.Minute));
            return Math.Min(diff, MinutesPerDay - diff);
        }

        /// <summary>
        /// Convert a UTC instant to the wall-clock <see cref="TimeOnly"/> in the user's IANA timezone.
        /// Falls back to UTC on configuration errors so a malformed profile never poisons the outbox.
        /// </summary>
        private static TimeOnly ToLocalTimeOfDay(DateTime utc, string ianaTimezone)
        {
            try
            {
                var tz = TimeZoneInfo.FindSystemTimeZoneById(ianaTimezone);
                var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), tz);
                return TimeOnly.FromDateTime(local);
            }
            catch (TimeZoneNotFoundException)
            {
                return TimeOnly.FromDateTime(utc);
            }
            catch (InvalidTimeZoneException)
            {
                return TimeOnly.FromDateTime(utc);
            }
        }
    }
}