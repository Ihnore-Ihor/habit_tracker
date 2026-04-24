using HabitTracker.Data;
using HabitTracker.Models;
using Microsoft.EntityFrameworkCore;

namespace HabitTracker.Application.Gamification.Evaluators
{
    /// <summary>
    /// Evaluates <see cref="ConditionKey.FIRST_ACTION"/> — boolean onboarding unlock awarded the
    /// first time a user produces ANY tracked record (habit execution, sleep log, or affect entry).
    ///
    /// <para><b>Business rule.</b> Returns <c>1</c> if the user has at least one row in any of
    /// <c>habit_executions</c>, <c>sleep_logs</c>, or <c>affect_entries</c>; otherwise <c>0</c>.
    /// The threshold is hard-wired to <c>1</c> regardless of <c>Achievement.TargetValue</c> — by
    /// catalog convention <c>TargetValue</c> is null for boolean conditions.</para>
    ///
    /// <para><b>Trigger events.</b> Any of <see cref="Domain.Events.HabitExecutedEvent"/>,
    /// <see cref="Domain.Events.SleepLoggedEvent"/>, <see cref="Domain.Events.AffectEntryRecordedEvent"/>.</para>
    /// </summary>
    public sealed class FirstActionEvaluator : IAchievementEvaluator
    {
        private readonly AppDbContext _db;

        public FirstActionEvaluator(AppDbContext db)
        {
            _db = db;
        }

        public ConditionKey Key => ConditionKey.FIRST_ACTION;

        public async Task EvaluateAsync(EvaluationContext context, CancellationToken ct)
        {
            // Boolean conditions ignore TargetValue (which is null by catalog design) — threshold is 1.
            const int target = 1;

            // Order the OR-chain by likelihood of an early hit so we short-circuit on the cheapest check.
            // The triggering event itself proves at least one row exists; any of these three queries
            // will return true for a non-empty user, so the round-trips remain bounded by the three
            // separate AnyAsync calls only on the very first event ever (when none have hit yet).
            bool hasAny =
                await _db.HabitExecutions.AnyAsync(e => e.UserHabit.UserId == context.UserId, ct) ||
                await _db.SleepLogs.AnyAsync(s => s.UserId == context.UserId, ct) ||
                await _db.AffectEntries.AnyAsync(a => a.UserId == context.UserId, ct);

            int progress = hasAny ? 1 : 0;

            context.Progress.CurrentProgress = Math.Min(progress, target);

            if (progress >= target && !context.Progress.IsUnlocked)
            {
                context.Progress.IsUnlocked = true;
                context.Progress.UnlockedAt = DateTime.UtcNow;
            }
        }
    }
}