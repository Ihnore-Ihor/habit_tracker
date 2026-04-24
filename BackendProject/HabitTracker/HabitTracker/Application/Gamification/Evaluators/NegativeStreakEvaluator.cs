using HabitTracker.Data;
using HabitTracker.Models;

namespace HabitTracker.Application.Gamification.Evaluators
{
    /// <summary>
    /// Skeleton for <see cref="ConditionKey.NEGATIVE_STREAK"/> — consecutive days without performing
    /// a harmful (Yin) habit. Fires primarily off <c>StreakMaintenanceCompletedEvent</c>.
    /// </summary>
    public sealed class NegativeStreakEvaluator : IAchievementEvaluator
    {
        private readonly AppDbContext _db;

        public NegativeStreakEvaluator(AppDbContext db)
        {
            _db = db;
        }

        public ConditionKey Key => ConditionKey.NEGATIVE_STREAK;

        // TODO: Implement once the business formula for NEGATIVE_STREAK is finalised.
        public Task EvaluateAsync(EvaluationContext context, CancellationToken ct) =>
            throw new NotImplementedException(
                "NEGATIVE_STREAK evaluator not yet implemented — pending business formula.");
    }
}