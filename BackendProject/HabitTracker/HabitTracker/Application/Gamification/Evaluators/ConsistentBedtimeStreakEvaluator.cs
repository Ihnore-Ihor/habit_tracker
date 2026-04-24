using HabitTracker.Data;
using HabitTracker.Models;

namespace HabitTracker.Application.Gamification.Evaluators
{
    /// <summary>
    /// Skeleton for <see cref="ConditionKey.CONSISTENT_BEDTIME_STREAK"/> — consecutive days on which
    /// the user's logged <c>SleepStart</c> falls within a tolerance band of their
    /// <c>UserSleepProfile</c>'s recommended bedtime. Tolerance (in minutes) is pending.
    /// </summary>
    public sealed class ConsistentBedtimeStreakEvaluator : IAchievementEvaluator
    {
        private readonly AppDbContext _db;

        public ConsistentBedtimeStreakEvaluator(AppDbContext db)
        {
            _db = db;
        }

        public ConditionKey Key => ConditionKey.CONSISTENT_BEDTIME_STREAK;

        // TODO: Implement once the business formula for CONSISTENT_BEDTIME_STREAK is finalised.
        public Task EvaluateAsync(EvaluationContext context, CancellationToken ct) =>
            throw new NotImplementedException(
                "CONSISTENT_BEDTIME_STREAK evaluator not yet implemented — pending business formula.");
    }
}