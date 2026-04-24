using HabitTracker.Data;
using HabitTracker.Models;

namespace HabitTracker.Application.Gamification.Evaluators
{
    /// <summary>
    /// Skeleton for <see cref="ConditionKey.AFFECT_HIGH_DOMINANCE"/> — count of PAD entries whose
    /// <c>DominanceScore</c> exceeds a threshold over a given horizon. Threshold + horizon pending.
    /// </summary>
    public sealed class AffectHighDominanceEvaluator : IAchievementEvaluator
    {
        private readonly AppDbContext _db;

        public AffectHighDominanceEvaluator(AppDbContext db)
        {
            _db = db;
        }

        public ConditionKey Key => ConditionKey.AFFECT_HIGH_DOMINANCE;

        // TODO: Implement once the business formula for AFFECT_HIGH_DOMINANCE is finalised.
        public Task EvaluateAsync(EvaluationContext context, CancellationToken ct) =>
            throw new NotImplementedException(
                "AFFECT_HIGH_DOMINANCE evaluator not yet implemented — pending business formula.");
    }
}