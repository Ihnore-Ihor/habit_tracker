using HabitTracker.Application.Abstractions;
using HabitTracker.Data;
using HabitTracker.Domain.Entities;
using HabitTracker.Domain.Events;
using Microsoft.EntityFrameworkCore;

namespace HabitTracker.Application.Services;

public sealed class HabitExecutionService : IHabitExecutionService
{
    private readonly AppDbContext _db;
    private readonly IOutboxWriter _outbox;

    public HabitExecutionService(AppDbContext db, IOutboxWriter outbox)
    {
        _db = db;
        _outbox = outbox;
    }

    public async Task<Guid> RecordExecutionAsync(
        Guid userId, 
        Guid userHabitId, 
        DateTime executionTime, 
        decimal? loggedValue, 
        CancellationToken ct = default)
    {
        // 1. Перевіряємо, чи існує звичка і чи належить вона цьому юзеру
        var userHabit = await _db.UserHabits
            .FirstOrDefaultAsync(h => h.Id == userHabitId && h.UserId == userId, ct);

        if (userHabit == null)
        {
            throw new ArgumentException("User habit not found or does not belong to the user.");
        }

        // 2. Створюємо запис про виконання
        var execution = new HabitExecution
        {
            Id = Guid.NewGuid(),
            UserHabitId = userHabitId,
            ExecutionTime = executionTime,
            LoggedValue = loggedValue
            // Note: CreatedAt is usually handled by DB default or EF interceptor
        };

        _db.HabitExecutions.Add(execution);

        // 3. Створюємо подію для нашої Гейміфікації (те, що ми робили на Кроці 5)
        var domainEvent = new HabitExecutedEvent(
            UserId: userId,
            UserHabitId: userHabitId,
            ExecutionTime: executionTime,
            LoggedValue: loggedValue
        );

        // 4. Кладемо подію в Outbox
        await _outbox.EnqueueAsync(domainEvent, ct);

        // 5. ЗБЕРІГАЄМО ВСЕ В ОДНІЙ ТРАНЗАКЦІЇ
        // Це гарантує, що запис у БД і подія для ачівок ніколи не розсинхронізуються
        await _db.SaveChangesAsync(ct);

        return execution.Id;
    }
}