using System.Text.Json;
using HabitTracker.Application.Gamification;
using HabitTracker.Data;
using HabitTracker.Domain.Events;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HabitTracker.Infrastructure.Outbox
{
    /// <summary>
    /// Background drainer for the transactional outbox. Uses .NET's built-in
    /// <see cref="PeriodicTimer"/> — no Hangfire / Quartz / other third-party scheduler.
    /// Each tick opens a fresh DI scope, fetches up to <see cref="OutboxDispatcherOptions.BatchSize"/>
    /// unprocessed rows in creation order, hands each to <see cref="IGamificationService"/>, and stamps
    /// <c>ProcessedAtUtc</c> on success or increments <c>Attempts</c> + records <c>LastError</c> on failure.
    /// </summary>
    /// <remarks>
    /// Single-instance deployment assumption: the current implementation relies on a simple
    /// <c>WHERE ProcessedAtUtc IS NULL</c> query. Under horizontal scaling, switch the SELECT to
    /// <c>FOR UPDATE SKIP LOCKED</c> (Npgsql raw SQL) so competing dispatchers partition the queue
    /// safely — left as a documented extension point.
    /// </remarks>
    public sealed class OutboxDispatcherService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IOptionsMonitor<OutboxDispatcherOptions> _options;
        private readonly ILogger<OutboxDispatcherService> _logger;

        public OutboxDispatcherService(
            IServiceScopeFactory scopeFactory,
            IOptionsMonitor<OutboxDispatcherOptions> options,
            ILogger<OutboxDispatcherService> logger)
        {
            _scopeFactory = scopeFactory;
            _options = options;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var interval = _options.CurrentValue.PollInterval;
            using var timer = new PeriodicTimer(interval);

            _logger.LogInformation("OutboxDispatcherService started — polling every {Interval}.", interval);

            // First tick runs immediately; subsequent ticks are spaced by PollInterval.
            do
            {
                try
                {
                    await DrainOnceAsync(stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    // Normal shutdown — fall through to the while-check.
                }
                catch (Exception ex)
                {
                    // Never let the loop die; a transient DB blip must not sideline gamification forever.
                    _logger.LogError(ex, "OutboxDispatcherService tick failed — will retry next interval.");
                }
            }
            while (await timer.WaitForNextTickAsync(stoppingToken));

            _logger.LogInformation("OutboxDispatcherService stopped.");
        }

        private async Task DrainOnceAsync(CancellationToken ct)
        {
            var options = _options.CurrentValue;

            await using var scope = _scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var registry = scope.ServiceProvider.GetRequiredService<DomainEventRegistry>();
            var gamification = scope.ServiceProvider.GetRequiredService<IGamificationService>();

            var batch = await db.OutboxMessages
                .Where(m => m.ProcessedAtUtc == null && m.Attempts < options.MaxAttempts)
                .OrderBy(m => m.CreatedAtUtc)
                .Take(options.BatchSize)
                .ToListAsync(ct);

            if (batch.Count == 0)
                return;

            foreach (var message in batch)
            {
                ct.ThrowIfCancellationRequested();

                try
                {
                    var clrType = registry.Resolve(message.EventType);
                    if (clrType is null)
                    {
                        // Unknown type = structural poison. Max out attempts so we stop touching it.
                        message.Attempts = options.MaxAttempts;
                        message.LastError = $"Unknown event type '{message.EventType}'.";
                        _logger.LogError(
                            "Outbox message {MessageId} references unknown event type {EventType} — marked poison.",
                            message.Id, message.EventType);
                        continue;
                    }

                    if (JsonSerializer.Deserialize(message.Payload, clrType) is not IDomainEvent @event)
                    {
                        message.Attempts = options.MaxAttempts;
                        message.LastError = "Deserialisation returned null or non-IDomainEvent.";
                        _logger.LogError(
                            "Outbox message {MessageId} failed to deserialise into {ClrType} — marked poison.",
                            message.Id, clrType.FullName);
                        continue;
                    }

                    await gamification.HandleAsync(@event, ct);

                    message.ProcessedAtUtc = DateTime.UtcNow;
                    message.Attempts++;
                    message.LastError = null;
                }
                catch (Exception ex)
                {
                    message.Attempts++;
                    message.LastError = Truncate(ex.Message, 2000);
                    _logger.LogWarning(ex,
                        "Outbox message {MessageId} ({EventType}) failed — attempt {Attempts}/{Max}.",
                        message.Id, message.EventType, message.Attempts, options.MaxAttempts);
                }
            }

            // Persist both the ProcessedAtUtc updates and any evaluator-originated progress in one call.
            await db.SaveChangesAsync(ct);
        }

        private static string Truncate(string value, int max) =>
            value.Length <= max ? value : value[..max];
    }
}