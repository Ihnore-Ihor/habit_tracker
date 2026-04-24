using HabitTracker.Data;
using HabitTracker.Models;

namespace HabitTracker.Application.Gamification.Evaluators
{
    /// <summary>
    /// Skeleton for <see cref="ConditionKey.SLEEP_DEBT_CLEARED"/> — "reduce your accumulated sleep debt
    /// to zero". Reads <c>UserSleepProfile.SleepDebtMinutes</c> (debt is maintained elsewhere) and
    /// fires when it crosses the zero threshold from above.
    /// </summary>
    public sealed class SleepDebtClearedEvaluator : IAchievementEvaluator
    {
        private readonly AppDbContext _db;

        public SleepDebtClearedEvaluator(AppDbContext db)
        {
            _db = db;
        }

        public ConditionKey Key => ConditionKey.SLEEP_DEBT_CLEARED;

        // TODO: Implement once the business formula for SLEEP_DEBT_CLEARED is finalised.
        public Task EvaluateAsync(EvaluationContext context, CancellationToken ct) =>
            throw new NotImplementedException(
                "SLEEP_DEBT_CLEARED evaluator not yet implemented — pending business formula.");
    }
}