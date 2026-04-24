using HabitTracker.Data;
using HabitTracker.Domain.Events;
using HabitTracker.Models;
using Microsoft.EntityFrameworkCore;

namespace HabitTracker.Application.Gamification.Evaluators
{
    /// <summary>
    /// Evaluates <see cref="ConditionKey.POSITIVE_STREAK"/> — "maintain a streak of <c>TargetValue</c>
    /// consecutive successes on a positive (Yang) habit".
    ///
    /// <para><b>Business rule.</b></para>
    /// <list type="bullet">
    ///   <item>Achievement unlocks when <c>UserHabit.CurrentStreak &gt;= Achievement.TargetValue</c>.</item>
    ///   <item>
    ///     If <c>Achievement.HabitId</c> is set → the user's subscription to that catalog habit is the
    ///     one that must reach the target. If <c>HabitId</c> is null (habit-agnostic award) → the
    ///     longest current positive streak across ANY of the user's non-archived positive subscriptions wins.
    ///   </item>
    ///   <item>
    ///     Only non-negative subscriptions count (<c>is_negative = false</c>). Yin habits are covered
    ///     by <see cref="ConditionKey.NEGATIVE_STREAK"/>.
    ///   </item>
    /// </list>
    ///
    /// <para><b>Data source.</b> <see cref="Domain.Entities.UserHabit.CurrentStreak"/> is maintained
    /// by the database triggers <c>trg_on_habit_execution</c> and <c>sp_daily_streak_maintenance</c>
    /// — this evaluator simply reads it, keeping gamification and streak mechanics decoupled.</para>
    ///
    /// <para><b>Trigger event.</b> <see cref="HabitExecutedEvent"/> — a streak can only extend on
    /// the turn of an execution. The nightly sweep is irrelevant to positive streaks (a missed day
    /// resets the streak to 0, which can't unlock anything).</para>
    /// </summary>
    public sealed class PositiveStreakEvaluator : IAchievementEvaluator
    {
        private readonly AppDbContext _db;

        public PositiveStreakEvaluator(AppDbContext db)
        {
            _db = db;
        }

        public ConditionKey Key => ConditionKey.POSITIVE_STREAK;

        public async Task EvaluateAsync(EvaluationContext context, CancellationToken ct)
        {
            // Hard guard — only makes sense on execution events; the mapping in GamificationService
            // already filters, but belt-and-braces against future wiring changes.
            if (context.Event is not HabitExecutedEvent executed)
                return;

            var target = context.Achievement.TargetValue;
            if (target is null or <= 0)
                // Malformed catalog row — no-op rather than throw; the content-manager should fix it.
                return;

            int streak = context.Achievement.HabitId is { } catalogHabitId
                ? await GetScopedStreakAsync(context.UserId, catalogHabitId, ct)
                : await GetBestPositiveStreakAsync(context.UserId, executed.UserHabitId, ct);

            // Progress displays as "max streak achieved so far", capped at the target so the UI
            // never shows > 100%.
            context.Progress.CurrentProgress = Math.Min(streak, target.Value);

            if (streak >= target.Value && !context.Progress.IsUnlocked)
            {
                context.Progress.IsUnlocked = true;
                context.Progress.UnlockedAt = DateTime.UtcNow;
            }
        }

        /// <summary>
        /// HabitId-scoped: streak of THIS specific catalog habit within THIS user's subscriptions.
        /// Aggregated as MAX in case a user holds multiple subscriptions to the same template (rare edge).
        /// </summary>
        private Task<int> GetScopedStreakAsync(Guid userId, int catalogHabitId, CancellationToken ct) =>
            _db.UserHabits
                .Where(uh => uh.UserId == userId
                          && uh.HabitId == catalogHabitId
                          && !uh.IsNegative)
                .Select(uh => (int?)uh.CurrentStreak)
                .MaxAsync(ct)
                .ContinueWith(t => t.Result ?? 0, ct, TaskContinuationOptions.OnlyOnRanToCompletion, TaskScheduler.Default);

        /// <summary>
        /// Habit-agnostic: the freshly-executed subscription is the only one that could have advanced
        /// on this event, so we only need its own <c>CurrentStreak</c>. Still guards against wrong polarity
        /// (a Yin habit must not contribute to a Yang positive-streak award).
        /// </summary>
        private async Task<int> GetBestPositiveStreakAsync(Guid userId, Guid userHabitId, CancellationToken ct)
        {
            var subscription = await _db.UserHabits
                .Where(uh => uh.Id == userHabitId && uh.UserId == userId && !uh.IsNegative)
                .Select(uh => new { uh.CurrentStreak })
                .SingleOrDefaultAsync(ct);

            return subscription?.CurrentStreak ?? 0;
        }
    }
}