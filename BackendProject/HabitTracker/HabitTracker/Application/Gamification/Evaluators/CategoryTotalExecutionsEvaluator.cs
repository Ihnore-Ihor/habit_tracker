using HabitTracker.Data;
using HabitTracker.Models;
using Microsoft.EntityFrameworkCore;

namespace HabitTracker.Application.Gamification.Evaluators
{
    /// <summary>
    /// Evaluates <see cref="ConditionKey.CATEGORY_TOTAL_EXECUTIONS"/> — "execute any habit belonging
    /// to category C a total of N times".
    ///
    /// <para><b>Catalog convention.</b> For this condition the <c>Achievement.HabitId</c> column is
    /// repurposed to carry a <c>CategoryId</c>. Achievements of this kind have no link to a specific
    /// catalog habit; the field is reused so we don't need a parallel column. Document this clearly
    /// in the catalog seed/UI to avoid content-manager confusion.</para>
    ///
    /// <para><b>Business rule.</b> Count every <c>HabitExecution</c> whose owning subscription
    /// belongs to the user AND whose <c>UserHabit.CategoryId</c> equals the achievement's repurposed
    /// <c>HabitId</c>.</para>
    ///
    /// <para><b>Trigger event.</b> <see cref="Domain.Events.HabitExecutedEvent"/>.</para>
    /// </summary>
    public sealed class CategoryTotalExecutionsEvaluator : IAchievementEvaluator
    {
        private readonly AppDbContext _db;

        public CategoryTotalExecutionsEvaluator(AppDbContext db)
        {
            _db = db;
        }

        public ConditionKey Key => ConditionKey.CATEGORY_TOTAL_EXECUTIONS;

        public async Task EvaluateAsync(EvaluationContext context, CancellationToken ct)
        {
            var target = context.Achievement.TargetValue;
            if (target is null or <= 0)
                return;

            int count = await _db.HabitExecutions
                .CountAsync(e => e.UserHabit.UserId == context.UserId
                              && e.UserHabit.CategoryId == context.Achievement.HabitId, ct);

            context.Progress.CurrentProgress = Math.Min(count, target.Value);

            if (count >= target.Value && !context.Progress.IsUnlocked)
            {
                context.Progress.IsUnlocked = true;
                context.Progress.UnlockedAt = DateTime.UtcNow;
            }
        }
    }
}