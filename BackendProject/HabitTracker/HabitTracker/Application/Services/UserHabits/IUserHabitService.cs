using HabitTracker.Application.DTOs.UserHabits;

namespace HabitTracker.Application.Services.UserHabits
{
    /// <summary>
    /// User-facing operations on habit subscriptions. Replaces the legacy
    /// <c>IHabitExecutionService</c> — every method takes the owning <c>userId</c>
    /// (extracted from the JWT by the controller) so the service layer does not have to
    /// trust anything coming from the request body.
    /// </summary>
    public interface IUserHabitService
    {
        /// <summary>Creates a new <c>UserHabit</c> subscription for the given user.</summary>
        Task<UserHabitDto> SubscribeToHabitAsync(
            Guid userId,
            SubscribeToHabitRequest request,
            CancellationToken ct = default);

        /// <summary>Returns the user's active (non-archived) subscriptions.</summary>
        Task<IReadOnlyList<UserHabitDto>> GetActiveUserHabitsAsync(
            Guid userId,
            CancellationToken ct = default);

        /// <summary>
        /// Records a <c>HabitExecution</c> and enqueues a <c>HabitExecutedEvent</c> in the SAME
        /// transaction (transactional outbox). Caller may not pass another user's habit — the service
        /// verifies the subscription belongs to <paramref name="userId"/>.
        /// </summary>
        Task<HabitExecutionDto> LogExecutionAsync(
            Guid userId,
            Guid userHabitId,
            LogExecutionRequest request,
            CancellationToken ct = default);

        /// <summary>Returns the most recent executions across all of the user's subscriptions.</summary>
        Task<IReadOnlyList<HabitExecutionDto>> GetRecentExecutionsAsync(
            Guid userId,
            int take,
            CancellationToken ct = default);

        /// <summary>Returns executions within a specific date range (UTC).</summary>
        Task<IReadOnlyList<HabitExecutionDto>> GetExecutionsAsync(
            Guid userId,
            DateTime from,
            DateTime to,
            CancellationToken ct = default);

        /// <summary>Updates an existing user habit subscription.</summary>
        Task UpdateUserHabitAsync(
            Guid userId,
            Guid id,
            UserHabitDto dto,
            CancellationToken ct = default);

        /// <summary>Soft-deletes (archives) a user habit subscription.</summary>
        Task ArchiveUserHabitAsync(
            Guid userId,
            Guid id,
            CancellationToken ct = default);
    }
}