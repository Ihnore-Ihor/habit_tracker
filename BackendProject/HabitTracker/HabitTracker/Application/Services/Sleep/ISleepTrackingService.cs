using HabitTracker.Application.DTOs.Sleep;
using HabitTracker.Domain.ValueObjects;


namespace HabitTracker.Application.Services.Sleep
{
    /// <summary>
    /// User-scoped sleep operations: logging intervals (which feed gamification + the smart-sleep MV)
    /// and managing the per-user algorithm profile.
    /// </summary>
    public interface ISleepTrackingService
    {
        /// <summary>
        /// Persists a <c>SleepLog</c> and enqueues a <c>SleepLoggedEvent</c> in the same transaction.
        /// Both timestamps are forced to UTC before the GiST EXCLUDE constraint is evaluated.
        /// </summary>
        Task<SleepLogDto> LogSleepAsync(
            Guid userId,
            LogSleepRequest request,
            CancellationToken ct = default);

        /// <summary>Most recent sleep logs for the caller, ordered by SleepStart desc.</summary>
        Task<IReadOnlyList<SleepLogDto>> GetRecentSleepLogsAsync(
            Guid userId,
            int take,
            CancellationToken ct = default);

        /// <summary>Sleep logs for the caller within a specific date range, ordered by SleepStart asc.</summary>
        Task<IReadOnlyList<SleepLogDto>> GetSleepLogsAsync(
            Guid userId,
            DateTime? from,
            DateTime? to,
            CancellationToken ct = default);

        /// <summary>Returns the caller's sleep profile, or <c>null</c> if it has never been created.</summary>
        Task<SleepProfileDto?> GetSleepProfileAsync(
            Guid userId,
            CancellationToken ct = default);

        /// <summary>
        /// Upsert: creates the 1:1 <c>UserSleepProfile</c> on first call, otherwise overwrites the parameters.
        /// Read-only fields (<c>SleepDebtMinutes</c>, <c>CurrentWakeTime</c>) are never touched here — they
        /// belong to the smart-sleep maintenance job.
        /// </summary>
        Task<SleepProfileDto> UpsertSleepProfileAsync(
            Guid userId,
            UpsertSleepProfileRequest request,
            CancellationToken ct = default);

        /// <summary>Generates a 7-day sleep plan based on the user's profile.</summary>
        Task<SleepPlan> GenerateSleepPlanAsync(
            Guid userId,
            CancellationToken ct = default);

        /// <summary>Returns the latest generated sleep plan.</summary>
        Task<SleepPlan?> GetLatestRecommendationAsync(
            Guid userId,
            CancellationToken ct = default);

        /// <summary>Updates an existing sleep log.</summary>
        Task<SleepLogDto> UpdateSleepLogAsync(
            Guid userId,
            Guid logId,
            LogSleepRequest request,
            CancellationToken ct = default);

        /// <summary>Deletes a sleep log.</summary>
        Task DeleteSleepLogAsync(
            Guid userId,
            Guid logId,
            CancellationToken ct = default);
    }
}