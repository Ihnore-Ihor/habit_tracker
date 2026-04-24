using HabitTracker.Data;
using HabitTracker.Models;

namespace HabitTracker.Application.Gamification.Evaluators
{
    /// <summary>
    /// Skeleton for <see cref="ConditionKey.TOTAL_METRIC_VOLUME"/> — cumulative metric sum
    /// (e.g. "drink 5000 ml of water in total"). Awaiting the exact aggregation formula.
    /// </summary>
    public sealed class TotalMetricVolumeEvaluator : IAchievementEvaluator
    {
        private readonly AppDbContext _db;

        public TotalMetricVolumeEvaluator(AppDbContext db)
        {
            _db = db;
        }

        public ConditionKey Key => ConditionKey.TOTAL_METRIC_VOLUME;

        // TODO: Implement once the business formula for TOTAL_METRIC_VOLUME is finalised.
        public Task EvaluateAsync(EvaluationContext context, CancellationToken ct) =>
            throw new NotImplementedException(
                "TOTAL_METRIC_VOLUME evaluator not yet implemented — pending business formula.");
    }
}