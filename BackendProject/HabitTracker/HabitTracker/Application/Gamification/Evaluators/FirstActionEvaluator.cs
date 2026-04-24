using HabitTracker.Data;
using HabitTracker.Models;

namespace HabitTracker.Application.Gamification.Evaluators
{
    /// <summary>
    /// Skeleton for <see cref="ConditionKey.FIRST_ACTION"/> — boolean "first ever" onboarding unlocks
    /// (first habit execution, first sleep log, first affect entry). <c>TargetValue</c> is typically null.
    /// </summary>
    public sealed class FirstActionEvaluator : IAchievementEvaluator
    {
        private readonly AppDbContext _db;

        public FirstActionEvaluator(AppDbContext db)
        {
            _db = db;
        }

        public ConditionKey Key => ConditionKey.FIRST_ACTION;

        // TODO: Implement once the business formula for FIRST_ACTION is finalised.
        public Task EvaluateAsync(EvaluationContext context, CancellationToken ct) =>
            throw new NotImplementedException(
                "FIRST_ACTION evaluator not yet implemented — pending business formula.");
    }
}