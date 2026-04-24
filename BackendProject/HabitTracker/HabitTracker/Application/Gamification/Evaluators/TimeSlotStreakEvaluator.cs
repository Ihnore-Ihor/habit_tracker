using HabitTracker.Data;
using HabitTracker.Models;

namespace HabitTracker.Application.Gamification.Evaluators
{
    /// <summary>
    /// Skeleton for <see cref="ConditionKey.TIME_SLOT_STREAK"/> — consecutive days of executing a
    /// specific habit within its declared <c>TimeSlot</c> (Morning/Afternoon/Evening/Night).
    /// Requires parsing the JSONB <c>schedule_rule</c> to determine the slot.
    /// </summary>
    public sealed class TimeSlotStreakEvaluator : IAchievementEvaluator
    {
        private readonly AppDbContext _db;

        public TimeSlotStreakEvaluator(AppDbContext db)
        {
            _db = db;
        }

        public ConditionKey Key => ConditionKey.TIME_SLOT_STREAK;

        // TODO: Implement once the business formula for TIME_SLOT_STREAK is finalised.
        public Task EvaluateAsync(EvaluationContext context, CancellationToken ct) =>
            throw new NotImplementedException(
                "TIME_SLOT_STREAK evaluator not yet implemented — pending business formula.");
    }
}