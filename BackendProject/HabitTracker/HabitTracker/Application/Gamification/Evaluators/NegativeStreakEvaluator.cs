using HabitTracker.Data;
using HabitTracker.Models;
using Microsoft.EntityFrameworkCore;

namespace HabitTracker.Application.Gamification.Evaluators
{
    /// <summary>
    /// Evaluates <see cref="ConditionKey.NEGATIVE_STREAK"/> — consecutive days the user has gone
    /// WITHOUT performing a harmful (Yin) habit. Mirrors <see cref="PositiveStreakEvaluator"/> but
    /// only over subscriptions with <c>IsNegative = true</c>.
    ///
    /// <para><b>Data source.</b> <see cref="Domain.Entities.UserHabit.CurrentStreak"/> is maintained
    /// for negative habits by <c>sp_daily_streak_maintenance</c> (++ for every clean day) and reset
    /// to 0 by <c>trg_on_habit_execution</c> when an execution is logged. This evaluator only reads it.</para>
    ///
    /// <para><b>Trigger event.</b> Primarily <c>StreakMaintenanceCompletedEvent</c> — a negative
    /// streak only ADVANCES on the turn of a day, never on an execution.</para>
    ///
    /// <para><b>Scope.</b> If <c>Achievement.HabitId</c> is set the streak is restricted to the
    /// matching catalog habit; otherwise the longest current Yin streak across all the user's
    /// negative subscriptions wins.</para>
    /// </summary>
    public sealed class NegativeStreakEvaluator : IAchievementEvaluator
    {
        private readonly AppDbContext _db;

        public NegativeStreakEvaluator(AppDbContext db)
        {
            _db = db;
        }

        public ConditionKey Key => ConditionKey.NEGATIVE_STREAK;

        public async Task EvaluateAsync(EvaluationContext context, CancellationToken ct)
        {
            var target = context.Achievement.TargetValue;
            if (target is null or <= 0)
                return;

            int streak = await _db.UserHabits
                .Where(h => h.UserId == context.UserId
                         && h.IsNegative
                         && (context.Achievement.HabitId == null || h.HabitId == context.Achievement.HabitId))
                .MaxAsync(h => (int?)h.CurrentStreak, ct) ?? 0;

            context.Progress.CurrentProgress = Math.Min(streak, target.Value);

            if (streak >= target.Value && !context.Progress.IsUnlocked)
            {
                context.Progress.IsUnlocked = true;
                context.Progress.UnlockedAt = DateTime.UtcNow;
            }
        }
    }
}