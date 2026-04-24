using HabitTracker.Domain.Entities;
using HabitTracker.Domain.Events;

namespace HabitTracker.Application.Gamification
{
    /// <summary>
    /// Immutable payload handed to an <see cref="IAchievementEvaluator"/> for a single
    /// (Event × Achievement × User) triple. The evaluator mutates <see cref="Progress"/> in place —
    /// the surrounding <see cref="GamificationService"/> commits the changes after the evaluator returns.
    /// </summary>
    /// <param name="Event">The raw domain event dequeued from the outbox.</param>
    /// <param name="UserId">Convenience — always equals the UserId carried by <paramref name="Event"/>.</param>
    /// <param name="Achievement">Catalog row describing the unlock rule (ConditionKey, TargetValue, HabitId, …).</param>
    /// <param name="Progress">
    /// Per-user progress row. Guaranteed non-null: <see cref="GamificationService"/> materialises a
    /// zeroed row on first encounter so evaluators never need to null-check.
    /// </param>
    public sealed record EvaluationContext(
        IDomainEvent Event,
        Guid UserId,
        Achievement Achievement,
        UserAchievement Progress);
}