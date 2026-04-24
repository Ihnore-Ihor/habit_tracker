using HabitTracker.Data;
using HabitTracker.Domain.Events;
using HabitTracker.Models;
using Microsoft.EntityFrameworkCore;

namespace HabitTracker.Application.Gamification.Evaluators
{
    /// <summary>
    /// Evaluates <see cref="ConditionKey.AFFECT_STABILITY"/> — counts consecutive
    /// <see cref="AffectEntryRecordedEvent"/>s where the user's last 7 days of PAD scores show
    /// population standard deviation &lt; 1.5 on every axis (Pleasure, Arousal, Dominance).
    ///
    /// <para><b>Business rule.</b> On each PAD entry: pull all entries with
    /// <c>RecordedAt &gt;= event.OccurredAtUtc - 7d</c>; compute std dev for P / A / D; if all three
    /// are below 1.5, increment <c>CurrentProgress</c>. If any axis is at or above 1.5 — or there
    /// aren't enough entries to compute a meaningful variance (n &lt; 2) — reset to 0.</para>
    ///
    /// <para><b>Statistical choice.</b> Population std dev (divisor <c>N</c>) over sample std dev
    /// (divisor <c>N − 1</c>): the entries IN the window ARE the population we're scoring, not a
    /// sample of a larger one.</para>
    /// </summary>
    public sealed class AffectStabilityEvaluator : IAchievementEvaluator
    {
        private const double StabilityThreshold = 1.5;
        private const int WindowDays = 7;

        private readonly AppDbContext _db;

        public AffectStabilityEvaluator(AppDbContext db)
        {
            _db = db;
        }

        public ConditionKey Key => ConditionKey.AFFECT_STABILITY;

        public async Task EvaluateAsync(EvaluationContext context, CancellationToken ct)
        {
            if (context.Event is not AffectEntryRecordedEvent affect)
                return;

            var target = context.Achievement.TargetValue;
            if (target is null or <= 0)
                return;

            var windowStart = affect.OccurredAtUtc.AddDays(-WindowDays);

            var scores = await _db.AffectEntries
                .Where(a => a.UserId == context.UserId && a.RecordedAt >= windowStart)
                .Select(a => new
                {
                    P = a.PleasureScore,
                    A = a.ArousalScore,
                    D = a.DominanceScore
                })
                .ToListAsync(ct);

            // n < 2 → variance is undefined / trivially 0; treat as "not enough data to call stable".
            bool stable =
                scores.Count >= 2 &&
                StandardDeviation(scores.Select(s => (double)s.P)) < StabilityThreshold &&
                StandardDeviation(scores.Select(s => (double)s.A)) < StabilityThreshold &&
                StandardDeviation(scores.Select(s => (double)s.D)) < StabilityThreshold;

            if (stable)
            {
                int newProgress = Math.Min(context.Progress.CurrentProgress + 1, target.Value);
                context.Progress.CurrentProgress = newProgress;

                if (newProgress >= target.Value && !context.Progress.IsUnlocked)
                {
                    context.Progress.IsUnlocked = true;
                    context.Progress.UnlockedAt = DateTime.UtcNow;
                }
            }
            else
            {
                context.Progress.CurrentProgress = 0;
            }
        }

        /// <summary>
        /// Population standard deviation (divisor <c>N</c>). Returns 0 for empty / single-element
        /// inputs — callers are responsible for treating those as "insufficient data" upstream
        /// (see the <c>n &lt; 2</c> guard in <see cref="EvaluateAsync"/>).
        /// </summary>
        private static double StandardDeviation(IEnumerable<double> values)
        {
            var arr = values as double[] ?? values.ToArray();
            if (arr.Length < 2)
                return 0d;

            double mean = arr.Sum() / arr.Length;
            double sumSq = 0d;
            foreach (var v in arr)
            {
                var d = v - mean;
                sumSq += d * d;
            }
            return Math.Sqrt(sumSq / arr.Length);
        }
    }
}