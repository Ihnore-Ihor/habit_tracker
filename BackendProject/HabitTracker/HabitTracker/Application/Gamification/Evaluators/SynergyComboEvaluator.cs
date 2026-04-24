using HabitTracker.Data;
using HabitTracker.Models;

namespace HabitTracker.Application.Gamification.Evaluators
{
    /// <summary>
    /// Skeleton for <see cref="ConditionKey.SYNERGY_COMBO"/> — "execute habits A &amp; B within the
    /// same window N times". Definition of the combo (pair of HabitIds) and the window duration
    /// are pending content-management decisions.
    /// </summary>
    public sealed class SynergyComboEvaluator : IAchievementEvaluator
    {
        private readonly AppDbContext _db;

        public SynergyComboEvaluator(AppDbContext db)
        {
            _db = db;
        }

        public ConditionKey Key => ConditionKey.SYNERGY_COMBO;

        // TODO: Implement once the business formula for SYNERGY_COMBO is finalised.
        public Task EvaluateAsync(EvaluationContext context, CancellationToken ct) =>
            throw new NotImplementedException(
                "SYNERGY_COMBO evaluator not yet implemented — pending business formula.");
    }
}