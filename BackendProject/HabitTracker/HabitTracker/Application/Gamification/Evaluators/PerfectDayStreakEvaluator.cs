using HabitTracker.Data;
using HabitTracker.Models;

namespace HabitTracker.Application.Gamification.Evaluators
{
    /// <summary>
    /// Skeleton for <see cref="ConditionKey.PERFECT_DAY_STREAK"/> — consecutive calendar days on which
    /// every scheduled positive habit was executed AND no negative habit was triggered.
    /// Evaluation is time-based — driven by <c>StreakMaintenanceCompletedEvent</c>.
    /// </summary>
    public sealed class PerfectDayStreakEvaluator : IAchievementEvaluator
    {
        private readonly AppDbContext _db;

        public PerfectDayStreakEvaluator(AppDbContext db)
        {
            _db = db;
        }

        public ConditionKey Key => ConditionKey.PERFECT_DAY_STREAK;

        // TODO: Implement once the business formula for PERFECT_DAY_STREAK is finalised.
        public Task EvaluateAsync(EvaluationContext context, CancellationToken ct) =>
            throw new NotImplementedException(
                "PERFECT_DAY_STREAK evaluator not yet implemented — pending business formula.");
    }
}