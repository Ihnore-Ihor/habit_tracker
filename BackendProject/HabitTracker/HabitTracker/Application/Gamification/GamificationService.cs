using HabitTracker.Data;
using HabitTracker.Domain.Entities;
using HabitTracker.Domain.Events;
using HabitTracker.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HabitTracker.Application.Gamification
{
    /// <summary>
    /// Central dispatcher for gamification. For a single domain event it:
    /// <list type="number">
    ///   <item>Maps the event type to the set of <see cref="ConditionKey"/>s it can potentially advance.</item>
    ///   <item>Loads the matching catalog <see cref="Achievement"/> rows (excluding archived).</item>
    ///   <item>Loads or lazily creates the user's <see cref="UserAchievement"/> progress rows.</item>
    ///   <item>Skips rows already unlocked (progress is monotonic — never re-evaluates).</item>
    ///   <item>Delegates each remaining row to its <see cref="IAchievementEvaluator"/>.</item>
    ///   <item>Persists mutations in a single <c>SaveChangesAsync</c> call.</item>
    /// </list>
    /// <para>
    /// This service is Scoped — it is resolved from a fresh DI scope per outbox message by the dispatcher,
    /// matching EF Core's unit-of-work expectations.
    /// </para>
    /// </summary>
    public sealed class GamificationService : IGamificationService
    {
        private readonly AppDbContext _db;
        private readonly IReadOnlyDictionary<ConditionKey, IAchievementEvaluator> _evaluators;
        private readonly ILogger<GamificationService> _logger;

        public GamificationService(
            AppDbContext db,
            IEnumerable<IAchievementEvaluator> evaluators,
            ILogger<GamificationService> logger)
        {
            _db = db;
            _logger = logger;

            // Build the routing table once per scope. Duplicate keys indicate a DI misconfiguration
            // and should fail loudly — ToDictionary throws on duplicates, which is the desired behaviour.
            _evaluators = evaluators.ToDictionary(e => e.Key);
        }

        /// <inheritdoc />
        public async Task HandleAsync(IDomainEvent @event, CancellationToken ct)
        {
            ArgumentNullException.ThrowIfNull(@event);

            var userId = ExtractUserId(@event);
            if (userId == Guid.Empty)
            {
                _logger.LogWarning(
                    "Received domain event {EventType} with no resolvable UserId — skipping.",
                    @event.GetType().Name);
                return;
            }

            var relevantKeys = MapEventToConditionKeys(@event);
            if (relevantKeys.Count == 0)
                return;

            // Load catalog rows that this event type can advance. The query filter on Achievement
            // already excludes archived rows — no extra predicate needed.
            var achievements = await _db.Achievements
                .Where(a => relevantKeys.Contains(a.ConditionKey))
                .ToListAsync(ct);

            if (achievements.Count == 0)
                return;

            // Load existing progress rows for this (user, achievement) set in one round trip.
            var achievementIds = achievements.Select(a => a.Id).ToList();
            var existingProgress = await _db.UserAchievements
                .Where(ua => ua.UserId == userId && achievementIds.Contains(ua.AchievementId))
                .ToListAsync(ct);

            var progressByAchievementId = existingProgress.ToDictionary(ua => ua.AchievementId);

            foreach (var achievement in achievements)
            {
                if (!_evaluators.TryGetValue(achievement.ConditionKey, out var evaluator))
                {
                    _logger.LogError(
                        "No evaluator registered for ConditionKey {ConditionKey} — achievement {AchievementId} skipped.",
                        achievement.ConditionKey, achievement.Id);
                    continue;
                }

                // Materialise a zero-progress row on first encounter so evaluators never null-check.
                if (!progressByAchievementId.TryGetValue(achievement.Id, out var progress))
                {
                    progress = new UserAchievement
                    {
                        UserId = userId,
                        AchievementId = achievement.Id,
                        CurrentProgress = 0,
                        IsUnlocked = false
                    };
                    _db.UserAchievements.Add(progress);
                    progressByAchievementId[achievement.Id] = progress;
                }

                // Monotonic: once unlocked, never re-evaluate.
                if (progress.IsUnlocked)
                    continue;

                var ctx = new EvaluationContext(@event, userId, achievement, progress);

                try
                {
                    await evaluator.EvaluateAsync(ctx, ct);
                }
                catch (Exception ex)
                {
                    // One failing evaluator must not poison the whole batch. Log and move on;
                    // the outbox row will still be marked processed because the business event was
                    // delivered — individual evaluator failures are an application-layer concern.
                    _logger.LogError(ex,
                        "Evaluator {Evaluator} threw while processing achievement {AchievementId} for user {UserId}.",
                        evaluator.GetType().Name, achievement.Id, userId);
                }
            }

            await _db.SaveChangesAsync(ct);
        }

        /// <summary>
        /// Maps each <see cref="IDomainEvent"/> to the <see cref="ConditionKey"/>s it might affect.
        /// Over-approximation is fine — each evaluator is expected to short-circuit on irrelevant payloads.
        /// Kept as a single switch so the mapping is reviewable in one place.
        /// </summary>
        private static IReadOnlySet<ConditionKey> MapEventToConditionKeys(IDomainEvent @event) => @event switch
        {
            HabitExecutedEvent => new HashSet<ConditionKey>
            {
                ConditionKey.TOTAL_METRIC_VOLUME,
                ConditionKey.POSITIVE_STREAK,
                ConditionKey.FIRST_ACTION,
                ConditionKey.SYNERGY_COMBO,
                ConditionKey.CATEGORY_TOTAL_EXECUTIONS,
                ConditionKey.TIME_SLOT_STREAK,
                ConditionKey.ANY_X_HABITS_STREAK
            },
            SleepLoggedEvent => new HashSet<ConditionKey>
            {
                ConditionKey.FIRST_ACTION,
                ConditionKey.CONSISTENT_BEDTIME_STREAK,
                ConditionKey.SLEEP_DEBT_CLEARED
            },
            AffectEntryRecordedEvent => new HashSet<ConditionKey>
            {
                ConditionKey.FIRST_ACTION,
                ConditionKey.AFFECT_STABILITY,
                ConditionKey.AFFECT_HIGH_DOMINANCE
            },
            // Nightly sweep closes the "day passed without executing" side of the streak calculus.
            StreakMaintenanceCompletedEvent => new HashSet<ConditionKey>
            {
                ConditionKey.NEGATIVE_STREAK,
                ConditionKey.PERFECT_DAY_STREAK,
                ConditionKey.ANY_X_HABITS_STREAK,
                ConditionKey.TIME_SLOT_STREAK
            },
            _ => new HashSet<ConditionKey>()
        };

        /// <summary>
        /// Extracts <c>UserId</c> from known domain events. Kept as a dedicated helper so
        /// <see cref="HandleAsync"/> stays type-agnostic and adding a new event type requires editing
        /// only this method and <see cref="MapEventToConditionKeys"/>.
        /// </summary>
        private static Guid ExtractUserId(IDomainEvent @event) => @event switch
        {
            HabitExecutedEvent e => e.UserId,
            SleepLoggedEvent e => e.UserId,
            AffectEntryRecordedEvent e => e.UserId,
            StreakMaintenanceCompletedEvent e => e.UserId,
            _ => Guid.Empty
        };
    }
}
