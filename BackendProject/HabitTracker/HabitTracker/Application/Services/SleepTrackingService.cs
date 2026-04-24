using HabitTracker.Application.Abstractions;
using HabitTracker.Data;
using HabitTracker.Domain.Entities;
using HabitTracker.Domain.Events;

namespace HabitTracker.Application.Services;

public sealed class SleepTrackingService : ISleepTrackingService
{
    private readonly AppDbContext _db;
    private readonly IOutboxWriter _outbox;

    public SleepTrackingService(AppDbContext db, IOutboxWriter outbox)
    {
        _db = db;
        _outbox = outbox;
    }

    public async Task<Guid> LogSleepAsync(
        Guid userId, 
        DateTime sleepStart, 
        DateTime sleepEnd, 
        int sleepQuality, 
        List<string>? tags, 
        CancellationToken ct = default)
    {
        // 1. Валідація бізнес-правил (захист від поганих даних)
        if (sleepEnd <= sleepStart) 
            throw new ArgumentException("Sleep end time must be strictly after sleep start time.");
            
        if (sleepQuality is < 1 or > 10) 
            throw new ArgumentException("Sleep quality must be between 1 and 10.");

        // 2. Створюємо сутність для бази даних
        // Переконуємось, що дати точно в UTC, як того вимагає Postgres
        var sleepLog = new SleepLog
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            SleepStart = DateTime.SpecifyKind(sleepStart, DateTimeKind.Utc),
            SleepEnd = DateTime.SpecifyKind(sleepEnd, DateTimeKind.Utc),
            SleepQuality = sleepQuality,
            Tags = tags ?? new List<string>()
        };

        _db.SleepLogs.Add(sleepLog);

        // 3. Формуємо доменну подію для гейміфікації (CONSISTENT_BEDTIME_STREAK)
        var domainEvent = new SleepLoggedEvent(
            UserId: userId,
            SleepLogId: sleepLog.Id,
            SleepStart: sleepLog.SleepStart,
            SleepEnd: sleepLog.SleepEnd,
            SleepQuality: sleepQuality,
            Tags: sleepLog.Tags
        );

        // 4. Записуємо подію в Outbox
        await _outbox.EnqueueAsync(domainEvent, ct);

        // 5. Фіксуємо транзакцію (запис сну + подія)
        await _db.SaveChangesAsync(ct);

        return sleepLog.Id;
    }
}