using HabitTracker.Data;
using HabitTracker.Models;
using Microsoft.EntityFrameworkCore;

namespace HabitTracker.Application.Gamification.Evaluators
{
    /// <summary>
    /// Evaluates <see cref="ConditionKey.TOTAL_METRIC_VOLUME"/> — cumulative metric tally for a single
    /// catalog habit (e.g. "drink 5000 ml of water in total", "read 1000 pages").
    ///
    /// <para><b>Business rule.</b> Sum <see cref="Domain.Entities.HabitExecution.LoggedValue"/> across
    /// every execution of every subscription this user holds against the catalog habit referenced by
    /// <c>Achievement.HabitId</c>. A null <c>LoggedValue</c> represents a checkbox-only execution and
    /// counts as <c>1</c>. The integer floor of the sum is the user's progress.</para>
    ///
    /// <para><b>Trigger event.</b> <see cref="Domain.Events.HabitExecutedEvent"/>.</para>
    /// </summary>
    public sealed class TotalMetricVolumeEvaluator : IAchievementEvaluator
    {
        private readonly AppDbContext _db;

        public TotalMetricVolumeEvaluator(AppDbContext db)
        {
            _db = db;
        }

        public ConditionKey Key => ConditionKey.TOTAL_METRIC_VOLUME;

        public async Task EvaluateAsync(EvaluationContext context, CancellationToken ct)
        {
            var target = context.Achievement.TargetValue;
            if (target is null or <= 0)
                return;

            var sum = await _db.HabitExecutions
                .Where(e => e.UserHabit.UserId == context.UserId
                         && e.UserHabit.HabitId == context.Achievement.HabitId)
                .SumAsync(e => e.LoggedValue ?? 1m, ct);

            int progress = (int)Math.Floor(sum);

            context.Progress.CurrentProgress = Math.Min(progress, target.Value);

            if (progress >= target.Value && !context.Progress.IsUnlocked)
            {
                context.Progress.IsUnlocked = true;
                context.Progress.UnlockedAt = DateTime.UtcNow;
            }
        }
    }
}