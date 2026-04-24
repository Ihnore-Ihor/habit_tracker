using HabitTracker.Data;
using HabitTracker.Models;

namespace HabitTracker.Application.Gamification.Evaluators
{
    /// <summary>
    /// Evaluates <see cref="ConditionKey.PERFECT_DAY_STREAK"/> — consecutive calendar days on which
    /// the user completed every scheduled positive (Yang) habit AND triggered no negative (Yin) one.
    ///
    /// <para><b>Status: deferred stub.</b> The naive query — for each user × each ConfirmedPerfectDay
    /// candidate, intersect "all scheduled habits today" against "all executed today" against
    /// "no negative executions today" — is quadratic over a user's lifetime when run on every nightly
    /// sweep. Until a backing SQL view (e.g. <c>vw_perfect_days</c>) or a maintained running counter
    /// exists, this evaluator is a no-op so achievements with this key remain catalog-valid but
    /// can never unlock by accident.</para>
    ///
    /// <para><b>TODO:</b> Replace with a single indexed read once the optimised view / counter table
    /// lands. Suggested approach: <c>sp_daily_streak_maintenance</c> writes a per-user
    /// <c>perfect_day_run_length</c> column on the same row it already updates each night.</para>
    /// </summary>
    public sealed class PerfectDayStreakEvaluator : IAchievementEvaluator
    {
        private readonly AppDbContext _db;

        public PerfectDayStreakEvaluator(AppDbContext db)
        {
            _db = db;
        }

        public ConditionKey Key => ConditionKey.PERFECT_DAY_STREAK;

        public Task EvaluateAsync(EvaluationContext context, CancellationToken ct)
        {
            // Intentional no-op — see class XML doc. Keeps progress at 0; never unlocks.
            return Task.CompletedTask;
        }
    }
}
