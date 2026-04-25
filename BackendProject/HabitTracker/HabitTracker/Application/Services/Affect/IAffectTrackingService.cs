using HabitTracker.Application.DTOs.Affect;

namespace HabitTracker.Application.Services.Affect
{
    /// <summary>
    /// User-scoped PAD (Pleasure-Arousal-Dominance) operations. Logging both persists the entry
    /// and enqueues an <c>AffectEntryRecordedEvent</c> in the same transaction so the affect-stability
    /// achievement evaluator sees every reading exactly once.
    /// </summary>
    public interface IAffectTrackingService
    {
        Task<AffectEntryDto> LogAffectAsync(
            Guid userId,
            LogAffectRequest request,
            CancellationToken ct = default);

        Task<IReadOnlyList<AffectEntryDto>> GetRecentEntriesAsync(
            Guid userId,
            int take,
            CancellationToken ct = default);
    }
}
