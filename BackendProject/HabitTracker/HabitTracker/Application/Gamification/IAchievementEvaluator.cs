using HabitTracker.Models;

namespace HabitTracker.Application.Gamification
{
    /// <summary>
    /// Strategy contract for evaluating a single <see cref="ConditionKey"/>. Exactly one implementation
    /// is registered per key; the <see cref="GamificationService"/> routes events by <see cref="Key"/>
    /// using a dictionary built at startup. Stateless between invocations — may be injected as Scoped
    /// so evaluators can take <c>AppDbContext</c> and other scoped dependencies.
    /// </summary>
    public interface IAchievementEvaluator
    {
        /// <summary>The condition this evaluator owns. Must be unique across registered implementations.</summary>
        ConditionKey Key { get; }

        /// <summary>
        /// Apply the business rule against the supplied context. Implementations update
        /// <c>context.Progress.CurrentProgress</c> / <c>IsUnlocked</c> / <c>UnlockedAt</c> in place.
        /// Evaluators MUST be idempotent — the outbox guarantees at-least-once delivery, so the same
        /// event may be replayed after a crash.
        /// </summary>
        Task EvaluateAsync(EvaluationContext context, CancellationToken ct);
    }
}