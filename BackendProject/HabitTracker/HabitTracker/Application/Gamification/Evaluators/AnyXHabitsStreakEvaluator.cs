using HabitTracker.Data;
using HabitTracker.Models;

namespace HabitTracker.Application.Gamification.Evaluators
{
    /// <summary>
    /// Skeleton for <see cref="ConditionKey.ANY_X_HABITS_STREAK"/> — "execute ANY X habits on N
    /// consecutive days", i.e. a lenient variant of PERFECT_DAY_STREAK that tolerates missed scheduled items
    /// as long as some quota is met. Awaiting exact quota semantics.
    /// </summary>
    public sealed class AnyXHabitsStreakEvaluator : IAchievementEvaluator
    {
        private readonly AppDbContext _db;

        public AnyXHabitsStreakEvaluator(AppDbContext db)
        {
            _db = db;
        }

        public ConditionKey Key => ConditionKey.ANY_X_HABITS_STREAK;

        // TODO: Implement once the business formula for ANY_X_HABITS_STREAK is finalised.
        public Task EvaluateAsync(EvaluationContext context, CancellationToken ct) =>
            throw new NotImplementedException(
                "ANY_X_HABITS_STREAK evaluator not yet implemented — pending business formula.");
    }
}