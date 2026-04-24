using System.Globalization;
using HabitTracker.Data;
using HabitTracker.Domain.Events;
using HabitTracker.Models;
using Microsoft.EntityFrameworkCore;

namespace HabitTracker.Application.Gamification.Evaluators
{
    /// <summary>
    /// Evaluates <see cref="ConditionKey.SYNERGY_COMBO"/> — "execute the two habits paired in this
    /// achievement on the same calendar day, <c>TargetValue</c> times in total".
    ///
    /// <para><b>Catalog convention.</b> The two paired catalog HabitIds are encoded in
    /// <c>Achievement.Description</c> as a comma-separated string, e.g. <c>"14,42"</c>. Whitespace
    /// is tolerated. Surface this clearly in the admin UI; misformed strings are skipped silently.</para>
    ///
    /// <para><b>Business rule.</b> When a <see cref="HabitExecutedEvent"/> arrives, look up the
    /// distinct count of paired-habit executions for the user on the event day; if both habits have
    /// at least one execution that day, increment <c>CurrentProgress</c> by 1.</para>
    ///
    /// <para><b>Idempotency caveat.</b> The increment-on-event design means multiple executions of
    /// the same combo on the same day will each trigger a credit. Mitigate with a follow-up column
    /// (e.g. <c>UserAchievement.LastCreditedDayUtc</c>) once that field exists; until then, content
    /// managers should be aware that "combo days" can over-count under enthusiastic logging.</para>
    /// </summary>
    public sealed class SynergyComboEvaluator : IAchievementEvaluator
    {
        private readonly AppDbContext _db;

        public SynergyComboEvaluator(AppDbContext db)
        {
            _db = db;
        }

        public ConditionKey Key => ConditionKey.SYNERGY_COMBO;

        public async Task EvaluateAsync(EvaluationContext context, CancellationToken ct)
        {
            if (context.Event is not HabitExecutedEvent executed)
                return;

            var target = context.Achievement.TargetValue;
            if (target is null or <= 0)
                return;

            if (!TryParsePair(context.Achievement.Description, out var idA, out var idB))
                return;

            // Day window — UTC date of the triggering event. Local-day correction is deliberately
            // omitted here for simplicity (matches the spec's "// simplified" comment); upgrade to a
            // user-timezone window when the per-user day boundary becomes relevant.
            var dayStart = executed.OccurredAtUtc.Date;
            var dayEnd = dayStart.AddDays(1);

            // Count DISTINCT paired-HabitIds executed today — using Distinct so two executions of the
            // same habit don't fool the >= 2 check.
            int distinctDoneToday = await _db.HabitExecutions
                .Where(e => e.UserHabit.UserId == context.UserId
                         && e.UserHabit.HabitId != null
                         && (e.UserHabit.HabitId == idA || e.UserHabit.HabitId == idB)
                         && e.ExecutionTime >= dayStart
                         && e.ExecutionTime < dayEnd)
                .Select(e => e.UserHabit.HabitId)
                .Distinct()
                .CountAsync(ct);

            bool bothDone = distinctDoneToday >= 2;
            if (!bothDone)
                return;

            int newProgress = Math.Min(context.Progress.CurrentProgress + 1, target.Value);
            context.Progress.CurrentProgress = newProgress;

            if (newProgress >= target.Value && !context.Progress.IsUnlocked)
            {
                context.Progress.IsUnlocked = true;
                context.Progress.UnlockedAt = DateTime.UtcNow;
            }
        }

        /// <summary>
        /// Parses <c>"A,B"</c> (with optional whitespace) into two distinct catalog HabitIds.
        /// Returns <c>false</c> on any structural problem so the caller can skip a malformed row.
        /// </summary>
        private static bool TryParsePair(string description, out int idA, out int idB)
        {
            idA = idB = 0;
            if (string.IsNullOrWhiteSpace(description))
                return false;

            var parts = description.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (parts.Length != 2)
                return false;

            return int.TryParse(parts[0], NumberStyles.Integer, CultureInfo.InvariantCulture, out idA)
                && int.TryParse(parts[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out idB)
                && idA != idB;
        }
    }
}
