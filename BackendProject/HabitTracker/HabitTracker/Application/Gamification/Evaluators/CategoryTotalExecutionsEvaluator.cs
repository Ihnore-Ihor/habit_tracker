using HabitTracker.Data;
using HabitTracker.Models;

namespace HabitTracker.Application.Gamification.Evaluators
{
    /// <summary>
    /// Skeleton for <see cref="ConditionKey.CATEGORY_TOTAL_EXECUTIONS"/> — "execute any habit in
    /// category C a total of N times". Needs the category selector and whether archived category
    /// subscriptions still count toward the tally.
    /// </summary>
    public sealed class CategoryTotalExecutionsEvaluator : IAchievementEvaluator
    {
        private readonly AppDbContext _db;

        public CategoryTotalExecutionsEvaluator(AppDbContext db)
        {
            _db = db;
        }

        public ConditionKey Key => ConditionKey.CATEGORY_TOTAL_EXECUTIONS;

        // TODO: Implement once the business formula for CATEGORY_TOTAL_EXECUTIONS is finalised.
        public Task EvaluateAsync(EvaluationContext context, CancellationToken ct) =>
            throw new NotImplementedException(
                "CATEGORY_TOTAL_EXECUTIONS evaluator not yet implemented — pending business formula.");
    }
}