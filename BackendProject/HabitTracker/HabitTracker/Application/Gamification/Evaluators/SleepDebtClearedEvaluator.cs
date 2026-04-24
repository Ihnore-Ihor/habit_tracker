using HabitTracker.Data;
using HabitTracker.Models;
using Microsoft.EntityFrameworkCore;

namespace HabitTracker.Application.Gamification.Evaluators
{
    /// <summary>
    /// Evaluates <see cref="ConditionKey.SLEEP_DEBT_CLEARED"/> — boolean award unlocked the moment
    /// the user's accumulated sleep debt drops to zero (or below — over-sleeping a few nights can
    /// push the counter slightly negative, which we treat as "cleared").
    ///
    /// <para><b>Business rule.</b> Returns <c>1</c> if the user has a <c>UserSleepProfile</c> with
    /// <c>SleepDebtMinutes &lt;= 0</c>; otherwise <c>0</c>. Debt is maintained by the sleep-tracking
    /// pipeline (outside gamification) — this evaluator only observes it.</para>
    ///
    /// <para><b>Trigger event.</b> <see cref="Domain.Events.SleepLoggedEvent"/> — the only event
    /// after which the debt counter could have moved.</para>
    /// </summary>
    public sealed class SleepDebtClearedEvaluator : IAchievementEvaluator
    {
        private readonly AppDbContext _db;

        public SleepDebtClearedEvaluator(AppDbContext db)
        {
            _db = db;
        }

        public ConditionKey Key => ConditionKey.SLEEP_DEBT_CLEARED;

        public async Task EvaluateAsync(EvaluationContext context, CancellationToken ct)
        {
            // Boolean condition — TargetValue is null by catalog convention; threshold is hard-wired to 1.
            const int target = 1;

            bool cleared = await _db.UserSleepProfiles
                .AnyAsync(p => p.UserId == context.UserId && p.SleepDebtMinutes <= 0, ct);

            int progress = cleared ? 1 : 0;

            context.Progress.CurrentProgress = Math.Min(progress, target);

            if (progress >= target && !context.Progress.IsUnlocked)
            {
                context.Progress.IsUnlocked = true;
                context.Progress.UnlockedAt = DateTime.UtcNow;
            }
        }
    }
}