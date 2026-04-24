using HabitTracker.Data;
using HabitTracker.Models;
using Microsoft.EntityFrameworkCore;

namespace HabitTracker.Application.Gamification.Evaluators
{
    /// <summary>
    /// Evaluates <see cref="ConditionKey.AFFECT_HIGH_DOMINANCE"/> — lifetime count of PAD entries
    /// the user logged while feeling highly in control (<c>DominanceScore &gt;= 3</c> on the
    /// −5..+5 scale). Unlocks when that count reaches <c>Achievement.TargetValue</c>.
    ///
    /// <para><b>Trigger event.</b> <see cref="Domain.Events.AffectEntryRecordedEvent"/>.</para>
    /// </summary>
    public sealed class AffectHighDominanceEvaluator : IAchievementEvaluator
    {
        private readonly AppDbContext _db;

        public AffectHighDominanceEvaluator(AppDbContext db)
        {
            _db = db;
        }

        public ConditionKey Key => ConditionKey.AFFECT_HIGH_DOMINANCE;

        public async Task EvaluateAsync(EvaluationContext context, CancellationToken ct)
        {
            var target = context.Achievement.TargetValue;
            if (target is null or <= 0)
                return;

            int count = await _db.AffectEntries
                .CountAsync(a => a.UserId == context.UserId && a.DominanceScore >= 3, ct);

            context.Progress.CurrentProgress = Math.Min(count, target.Value);

            if (count >= target.Value && !context.Progress.IsUnlocked)
            {
                context.Progress.IsUnlocked = true;
                context.Progress.UnlockedAt = DateTime.UtcNow;
            }
        }
    }
}