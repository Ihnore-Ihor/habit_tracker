using HabitTracker.Domain.ValueObjects;

namespace HabitTracker.Application.Services.Sleep
{
    /// <summary>
    /// Generates and retrieves day-by-day sleep plans ("Sleep Router") for a user.
    /// Decoupled from <see cref="ISleepTrackingService"/> so the algorithm can evolve independently.
    /// </summary>
    public interface ISleepRecommendationService
    {
        /// <summary>
        /// Runs the Sleep Router algorithm for the next <paramref name="days"/> nights, persists the result,
        /// and returns the generated <see cref="SleepPlan"/>.
        /// Throws <see cref="HabitTracker.Application.Common.Exceptions.ValidationException"/> when no sleep profile exists.
        /// </summary>
        Task<SleepPlan> GeneratePlanForNextDaysAsync(Guid userId, int days = 7, CancellationToken ct = default);

        /// <summary>Returns the most recently generated plan, or <c>null</c> if none exists.</summary>
        Task<SleepPlan?> GetLatestRecommendationAsync(Guid userId, CancellationToken ct = default);
    }
}
