using HabitTracker.Data;
using HabitTracker.Models;

namespace HabitTracker.Application.Gamification.Evaluators
{
    /// <summary>
    /// Skeleton for <see cref="ConditionKey.AFFECT_STABILITY"/> — measures how stable the user's
    /// PAD scores have been over a rolling window (low variance of pleasure/arousal/dominance).
    /// Window size and variance threshold are pending.
    /// </summary>
    public sealed class AffectStabilityEvaluator : IAchievementEvaluator
    {
        private readonly AppDbContext _db;

        public AffectStabilityEvaluator(AppDbContext db)
        {
            _db = db;
        }

        public ConditionKey Key => ConditionKey.AFFECT_STABILITY;

        // TODO: Implement once the business formula for AFFECT_STABILITY is finalised.
        public Task EvaluateAsync(EvaluationContext context, CancellationToken ct) =>
            throw new NotImplementedException(
                "AFFECT_STABILITY evaluator not yet implemented — pending business formula.");
    }
}