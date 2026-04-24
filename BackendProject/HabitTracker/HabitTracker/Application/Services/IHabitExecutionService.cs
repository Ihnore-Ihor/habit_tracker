namespace HabitTracker.Application.Services;

public interface IHabitExecutionService
{
    /// <summary>
    /// Records a new habit execution and queues the corresponding domain event.
    /// </summary>
    Task<Guid> RecordExecutionAsync(
        Guid userId, 
        Guid userHabitId, 
        DateTime executionTime, 
        decimal? loggedValue, 
        CancellationToken ct = default);
}