namespace HabitTracker.Application.Services;

public interface ISleepTrackingService
{
    Task<Guid> LogSleepAsync(
        Guid userId, 
        DateTime sleepStart, 
        DateTime sleepEnd, 
        int sleepQuality, 
        List<string>? tags, 
        CancellationToken ct = default);
}