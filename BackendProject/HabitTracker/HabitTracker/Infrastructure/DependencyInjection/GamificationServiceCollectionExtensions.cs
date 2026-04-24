using HabitTracker.Application.Abstractions;
using HabitTracker.Application.Gamification;
using HabitTracker.Application.Gamification.Evaluators;
using HabitTracker.Infrastructure.Outbox;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace HabitTracker.Infrastructure.DependencyInjection
{
    /// <summary>
    /// One-stop DI wiring for the Outbox + Gamification stack. Call from <c>Program.cs</c>:
    /// <code>builder.Services.AddGamification(builder.Configuration);</code>
    /// </summary>
    public static class GamificationServiceCollectionExtensions
    {
        /// <summary>
        /// Registers:
        /// <list type="bullet">
        ///   <item><see cref="IOutboxWriter"/> (Scoped) — for producers.</item>
        ///   <item><see cref="DomainEventRegistry"/> (Singleton) — type whitelist.</item>
        ///   <item><see cref="OutboxDispatcherOptions"/> — bound from <c>"Outbox"</c> section.</item>
        ///   <item><see cref="OutboxDispatcherService"/> (HostedService) — the drain loop.</item>
        ///   <item><see cref="IGamificationService"/> (Scoped) — the fan-out service.</item>
        ///   <item>All 13 <see cref="IAchievementEvaluator"/> implementations (Scoped).</item>
        /// </list>
        /// </summary>
        public static IServiceCollection AddGamification(
            this IServiceCollection services,
            IConfiguration configuration)
        {
            // Outbox plumbing.
            services.Configure<OutboxDispatcherOptions>(
                configuration.GetSection(OutboxDispatcherOptions.SectionName));
            services.AddSingleton<DomainEventRegistry>();
            services.AddScoped<IOutboxWriter, OutboxWriter>();
            services.AddHostedService<OutboxDispatcherService>();

            // Gamification fan-out.
            services.AddScoped<IGamificationService, GamificationService>();

            // Strategy registrations — one per ConditionKey. GamificationService builds its routing
            // dictionary by collecting every IAchievementEvaluator, so all 13 must be registered here.
            services.AddScoped<IAchievementEvaluator, PositiveStreakEvaluator>();
            services.AddScoped<IAchievementEvaluator, TotalMetricVolumeEvaluator>();
            services.AddScoped<IAchievementEvaluator, NegativeStreakEvaluator>();
            services.AddScoped<IAchievementEvaluator, PerfectDayStreakEvaluator>();
            services.AddScoped<IAchievementEvaluator, AnyXHabitsStreakEvaluator>();
            services.AddScoped<IAchievementEvaluator, FirstActionEvaluator>();
            services.AddScoped<IAchievementEvaluator, SynergyComboEvaluator>();
            services.AddScoped<IAchievementEvaluator, CategoryTotalExecutionsEvaluator>();
            services.AddScoped<IAchievementEvaluator, TimeSlotStreakEvaluator>();
            services.AddScoped<IAchievementEvaluator, ConsistentBedtimeStreakEvaluator>();
            services.AddScoped<IAchievementEvaluator, SleepDebtClearedEvaluator>();
            services.AddScoped<IAchievementEvaluator, AffectStabilityEvaluator>();
            services.AddScoped<IAchievementEvaluator, AffectHighDominanceEvaluator>();

            return services;
        }
    }
}