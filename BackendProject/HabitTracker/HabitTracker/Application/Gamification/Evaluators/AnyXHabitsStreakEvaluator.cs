using HabitTracker.Data;
using HabitTracker.Models;

namespace HabitTracker.Application.Gamification.Evaluators
{
    /// <summary>
    /// Evaluates <see cref="ConditionKey.ANY_X_HABITS_STREAK"/> — "execute at least
    /// <c>Achievement.TargetValue</c> habits per day for N consecutive days".
    ///
    /// <para><b>Status: deferred stub.</b> A correct implementation needs a per-day execution-count
    /// roll-up across the user's full history; running that on every nightly tick × every catalog row
    /// is N+1 + quadratic. Until a rolling-window query (or, preferably, a dedicated
    /// <c>vw_daily_execution_counts</c> view / counter table maintained by
    /// <c>sp_daily_streak_maintenance</c>) is in place, this evaluator is a no-op.</para>
    ///
    /// <para><b>TODO:</b> Replace with a single indexed read once the optimised view / counter table
    /// lands. Suggested approach mirrors the one for <c>PerfectDayStreakEvaluator</c>: persist the
    /// running streak length on the user row and just compare it to the target here.</para>
    /// </summary>
    public sealed class AnyXHabitsStreakEvaluator : IAchievementEvaluator
    {
        private readonly AppDbContext _db;

        public AnyXHabitsStreakEvaluator(AppDbContext db)
        {
            _db = db;
        }

        public ConditionKey Key => ConditionKey.ANY_X_HABITS_STREAK;

        public Task EvaluateAsync(EvaluationContext context, CancellationToken ct)
        {
            // Intentional no-op — see class XML doc.
            return Task.CompletedTask;
        }
    }
}