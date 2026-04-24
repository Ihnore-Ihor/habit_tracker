using HabitTracker.Data;
using HabitTracker.Domain.Events;
using HabitTracker.Models;
using Microsoft.EntityFrameworkCore;

namespace HabitTracker.Application.Gamification.Evaluators
{
    /// <summary>
    /// Evaluates <see cref="ConditionKey.TIME_SLOT_STREAK"/> — consecutive executions of a habit
    /// that fall inside its declared <see cref="TimeSlot"/> bucket.
    ///
    /// <para><b>Business rule.</b> When a <see cref="HabitExecutedEvent"/> arrives:
    /// look up the executed subscription's <c>ScheduleRule.TimeSlot</c>, convert the (UTC)
    /// <c>ExecutionTime</c> to the user's local clock, and check whether the local hour falls inside
    /// the slot's bounds. If yes — increment <c>CurrentProgress</c>. If no — reset to 0 (the streak
    /// is broken). Subscriptions with <c>TimeSlot = Anytime</c> or no slot at all always increment.</para>
    ///
    /// <para><b>Slot bounds (local clock).</b>
    /// Morning [06:00, 12:00) · Afternoon [12:00, 18:00) · Evening [18:00, 24:00) · Night [00:00, 06:00).</para>
    ///
    /// <para><b>Idempotency caveat.</b> Like <c>SynergyComboEvaluator</c>, this is increment-on-event;
    /// a replayed event would double-credit. Acceptable until <c>UserAchievement.LastCreditedExecutionId</c>
    /// (or similar) lands.</para>
    /// </summary>
    public sealed class TimeSlotStreakEvaluator : IAchievementEvaluator
    {
        private readonly AppDbContext _db;

        public TimeSlotStreakEvaluator(AppDbContext db)
        {
            _db = db;
        }

        public ConditionKey Key => ConditionKey.TIME_SLOT_STREAK;

        public async Task EvaluateAsync(EvaluationContext context, CancellationToken ct)
        {
            if (context.Event is not HabitExecutedEvent executed)
                return;

            var target = context.Achievement.TargetValue;
            if (target is null or <= 0)
                return;

            // Single round-trip: pull both the slot (from the JSONB ScheduleRule) and the user's
            // timezone needed to interpret it.
            var info = await _db.UserHabits
                .Where(uh => uh.Id == executed.UserHabitId && uh.UserId == context.UserId)
                .Select(uh => new
                {
                    Slot = uh.ScheduleRule != null ? uh.ScheduleRule.TimeSlot : null,
                    Timezone = uh.User.Timezone
                })
                .SingleOrDefaultAsync(ct);

            if (info is null)
                return;

            // ExecutionTime is the actual moment the habit was performed (can be retroactive
            // up to 30 days), not when this event happened to be raised. The user's spec is explicit
            // about using ExecutionTime here.
            var localHour = ToLocalTimeOfDay(executed.ExecutionTime, info.Timezone).Hour;
            bool inSlot = IsInSlot(info.Slot, localHour);

            if (inSlot)
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
        /// Returns true when <paramref name="localHour"/> sits inside the half-open interval owned
        /// by <paramref name="slot"/>. Null and <see cref="TimeSlot.Anytime"/> always pass.
        /// </summary>
        private static bool IsInSlot(TimeSlot? slot, int localHour) => slot switch
        {
            null or TimeSlot.Anytime => true,
            TimeSlot.Morning   => localHour >= 6  && localHour < 12,
            TimeSlot.Afternoon => localHour >= 12 && localHour < 18,
            TimeSlot.Evening   => localHour >= 18 && localHour < 24,
            TimeSlot.Night     => localHour >= 0  && localHour < 6,
            _ => true
        };

        /// <summary>
        /// Convert a UTC instant to the wall-clock <see cref="TimeOnly"/> in the user's IANA timezone.
        /// Falls back to UTC if the timezone string is unknown — better to credit/penalise on UTC than
        /// to throw and poison an outbox row over a malformed profile field.
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
