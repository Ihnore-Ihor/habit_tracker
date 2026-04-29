using System.Text;
using HabitTracker.Domain.Entities;
using HabitTracker.Domain.ReadModels;
using HabitTracker.Infrastructure.Outbox;
using HabitTracker.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace HabitTracker.Data
{
    /// <summary>
    /// EF Core 9 DbContext for the Harmony habit-tracker backend.
    /// <para>
    /// Configures all 13 entity tables, three native PostgreSQL enums (<c>frequency_type</c>,
    /// <c>proposal_status</c>, <c>condition_key</c>), owned-JSONB mappings for polymorphic schedule
    /// rules and multi-day sleep plans, native <c>TEXT[]</c> arrays for contextual tags,
    /// CHECK / UNIQUE / partial / B-Tree / GIN indexes, FK cascade behaviour, global soft-delete
    /// query filters, and fixed Role seed data.
    /// </para>
    /// <para>
    /// The 18 bespoke PostgreSQL objects from §2.4 of the spec (triggers, virtual/materialized views,
    /// stored procedures, <c>fn_calculate_daily_affect_centroid</c>, the GiST EXCLUDE constraint
    /// <c>no_overlapping_sleep</c>, the <c>trg_users_updated_at</c> trigger) are NOT expressible via
    /// Fluent API and must be added as raw SQL inside a dedicated follow-up migration.
    /// </para>
    /// </summary>
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<Role> Roles => Set<Role>();
        public DbSet<User> Users => Set<User>();
        public DbSet<UserSleepProfile> UserSleepProfiles => Set<UserSleepProfile>();
        public DbSet<Category> Categories => Set<Category>();
        public DbSet<Habit> Habits => Set<Habit>();
        public DbSet<UserHabit> UserHabits => Set<UserHabit>();
        public DbSet<HabitExecution> HabitExecutions => Set<HabitExecution>();
        public DbSet<AffectEntry> AffectEntries => Set<AffectEntry>();
        public DbSet<SleepLog> SleepLogs => Set<SleepLog>();
        public DbSet<SleepRecommendation> SleepRecommendations => Set<SleepRecommendation>();
        public DbSet<Achievement> Achievements => Set<Achievement>();
        public DbSet<UserAchievement> UserAchievements => Set<UserAchievement>();
        public DbSet<AnalystProposal> AnalystProposals => Set<AnalystProposal>();

        /// <summary>Transactional outbox — populated by <c>IOutboxWriter</c>, drained by <c>OutboxDispatcherService</c>.</summary>
        public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();

        /// <summary>Read-only projection of <c>mvw_achievement_rarity</c>. Keyless — do not add migrations for this set.</summary>
        public DbSet<AchievementRarityView> AchievementRarityViews => Set<AchievementRarityView>();

        /// <summary>Read-only projection of <c>mvw_global_habit_stats</c>. Keyless.</summary>
        public DbSet<GlobalHabitStatsView> GlobalHabitStatsViews => Set<GlobalHabitStatsView>();

        /// <summary>Read-only projection of <c>mvw_sleep_recommendation_effectiveness</c>. Keyless.</summary>
        public DbSet<SleepEffectivenessView> SleepEffectivenessViews => Set<SleepEffectivenessView>();

        /// <summary>Read-only projection of <c>mvw_analyst_proposal_impact</c>. Keyless.</summary>
        public DbSet<ProposalImpactView> ProposalImpactViews => Set<ProposalImpactView>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // 1. Register native PostgreSQL enums. The <c>condition_key</c> type relies on Npgsql's
            //    default snake_case translator, which correctly maps each UPPER_SNAKE_CASE CLR member
            //    to the matching lowercase label (e.g. TOTAL_METRIC_VOLUME → "total_metric_volume").
            modelBuilder.HasPostgresEnum<FrequencyType>();
            modelBuilder.HasPostgresEnum<ProposalStatus>();
            modelBuilder.HasPostgresEnum<ConditionKey>();

            // 2. Per-entity configuration.
            ConfigureRole(modelBuilder);
            ConfigureUser(modelBuilder);
            ConfigureUserSleepProfile(modelBuilder);
            ConfigureCategory(modelBuilder);
            ConfigureHabit(modelBuilder);
            ConfigureUserHabit(modelBuilder);
            ConfigureHabitExecution(modelBuilder);
            ConfigureAffectEntry(modelBuilder);
            ConfigureSleepLog(modelBuilder);
            ConfigureSleepRecommendation(modelBuilder);
            ConfigureAchievement(modelBuilder);
            ConfigureUserAchievement(modelBuilder);
            ConfigureAnalystProposal(modelBuilder);

            // 3. Infrastructure tables (non-domain) — use IEntityTypeConfiguration to keep
            //    infra concerns out of the domain-centric DbContext body.
            modelBuilder.ApplyConfiguration(new OutboxMessageConfiguration());

            // 4. Keyless read models (database views / materialized views).
            //    HasNoKey() tells EF Core not to generate migrations for these sets.
            modelBuilder.Entity<AchievementRarityView>(e =>
            {
                e.HasNoKey();
                e.ToView("mvw_achievement_rarity");
                e.Property(v => v.AchievementId).HasColumnName("achievement_id");
                e.Property(v => v.UnlockRatePct).HasColumnName("unlock_rate_pct");
            });

            modelBuilder.Entity<GlobalHabitStatsView>(e =>
            {
                e.HasNoKey();
                e.ToView("mvw_global_habit_stats");
            });

            modelBuilder.Entity<SleepEffectivenessView>(e =>
            {
                e.HasNoKey();
                e.ToView("mvw_sleep_recommendation_effectiveness");
            });

            modelBuilder.Entity<ProposalImpactView>(e =>
            {
                e.HasNoKey();
                e.ToView("mvw_analyst_proposal_impact");
            });

            // 5. Cross-cutting conventions — must run LAST so explicit per-entity names and types win.
            ApplyDatabaseConventions(modelBuilder);
        }

        // ─────────────────────────── Per-entity configuration ───────────────────────────

        private static void ConfigureRole(ModelBuilder b) => b.Entity<Role>(e =>
        {
            e.HasKey(r => r.Id);
            e.Property(r => r.Name).IsRequired().HasMaxLength(50);
            e.HasIndex(r => r.Name).IsUnique();

            // A12: fixed authorisation seed. Re-apply sequence value in a raw-SQL follow-up if
            // Postgres IDENTITY starts returning collisions after HasData-inserted rows.
            e.HasData(
                new Role { Id = 1, Name = "User" },
                new Role { Id = 2, Name = "ContentManager" },
                new Role { Id = 3, Name = "Analyst" }
            );
        });

        private static void ConfigureUser(ModelBuilder b) => b.Entity<User>(e =>
        {
            e.HasKey(u => u.Id);
            e.Property(u => u.Nickname).IsRequired().HasMaxLength(100);
            e.Property(u => u.Email).IsRequired().HasMaxLength(255);
            e.Property(u => u.PasswordHash).IsRequired().HasMaxLength(255);
            e.Property(u => u.Timezone).IsRequired().HasMaxLength(64).HasDefaultValue("UTC");
            e.HasIndex(u => u.Email).IsUnique();

            // A5: UpdatedAt is trigger-managed (`trg_users_updated_at`). DEFAULT NOW() covers INSERTs;
            // EF Core must neither write nor assume it owns the value.
            e.Property(u => u.UpdatedAt)
                .HasDefaultValueSql("NOW()")
                .ValueGeneratedOnAddOrUpdate();
            e.Property(u => u.UpdatedAt).Metadata.SetBeforeSaveBehavior(PropertySaveBehavior.Ignore);
            e.Property(u => u.UpdatedAt).Metadata.SetAfterSaveBehavior(PropertySaveBehavior.Ignore);

            // Role is a 3-row dictionary — Restrict prevents accidental removal of an in-use role.
            e.HasOne(u => u.Role)
                .WithMany(r => r.Users)
                .HasForeignKey(u => u.RoleId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        private static void ConfigureUserSleepProfile(ModelBuilder b) => b.Entity<UserSleepProfile>(e =>
        {
            e.HasKey(p => p.Id);
            e.HasIndex(p => p.UserId).IsUnique();

            e.Property(p => p.BaseSleepHours).HasPrecision(5, 2);
            e.Property(p => p.AbsoluteMinSleepHours).HasPrecision(5, 2);
            e.Property(p => p.WeekendDeviationHours).HasPrecision(4, 2);
            e.Property(p => p.SleepDebtMinutes).HasDefaultValue(0);

            e.HasOne(p => p.User)
                .WithOne(u => u.SleepProfile)
                .HasForeignKey<UserSleepProfile>(p => p.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // A11: minimum sleep must be > 0; no hardcoded 6-hour floor.
            e.ToTable(t => t.HasCheckConstraint(
                "ck_sleep_profile_min_positive",
                "absolute_min_sleep_hours > 0"));
        });

        private static void ConfigureCategory(ModelBuilder b) => b.Entity<Category>(e =>
        {
            e.HasKey(c => c.Id);
            e.Property(c => c.Name).IsRequired().HasMaxLength(100);
            e.Property(c => c.ColorHex).IsRequired().HasMaxLength(7);
            e.Property(c => c.IconEmoji).IsRequired().HasMaxLength(16);
            e.Property(c => c.IsNegative).HasDefaultValue(false);
            e.Property(c => c.IsArchived).HasDefaultValue(false);

            // Soft-delete filter — bypass with IgnoreQueryFilters() in analytics paths.
            e.HasQueryFilter(c => !c.IsArchived);
        });

        private static void ConfigureHabit(ModelBuilder b) => b.Entity<Habit>(e =>
        {
            e.HasKey(h => h.Id);
            e.Property(h => h.Title).IsRequired().HasMaxLength(150);
            e.Property(h => h.ColorHex).HasMaxLength(7);
            e.Property(h => h.IconEmoji).HasMaxLength(16);
            e.Property(h => h.IsNegative).HasDefaultValue(false);
            e.Property(h => h.IsArchived).HasDefaultValue(false);
            e.HasQueryFilter(h => !h.IsArchived);

            e.HasOne(h => h.Category)
                .WithMany(c => c.Habits)
                .HasForeignKey(h => h.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        private static void ConfigureUserHabit(ModelBuilder b) => b.Entity<UserHabit>(e =>
        {
            e.HasKey(uh => uh.Id);
            e.Property(uh => uh.CustomName).HasMaxLength(150);
            e.Property(uh => uh.ColorHex).HasMaxLength(7);
            e.Property(uh => uh.IconEmoji).HasMaxLength(16);
            e.Property(uh => uh.MetricUnit).HasMaxLength(32);
            e.Property(uh => uh.TargetValue).HasPrecision(18, 4);
            e.Property(uh => uh.IsNegative).HasDefaultValue(false);
            e.Property(uh => uh.CurrentStreak).HasDefaultValue(0);
            e.Property(uh => uh.LongestStreak).HasDefaultValue(0);
            e.Property(uh => uh.IsArchived).HasDefaultValue(false);

            // Polymorphic schedule persisted as a single JSONB sub-document.
            e.OwnsOne(uh => uh.ScheduleRule, sr => sr.ToJson("schedule_rule"));

            e.HasQueryFilter(uh => !uh.IsArchived);

            // A6: User deletion cascades to subscriptions (GDPR).
            e.HasOne(uh => uh.User)
                .WithMany(u => u.UserHabits)
                .HasForeignKey(uh => uh.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // A6: catalog habit removed → subscription becomes fully custom (HabitId nulled).
            e.HasOne(uh => uh.Habit)
                .WithMany(h => h.UserHabits)
                .HasForeignKey(uh => uh.HabitId)
                .OnDelete(DeleteBehavior.SetNull);

            // Category is soft-deleted in practice; Restrict is a safety net against hard delete.
            e.HasOne(uh => uh.Category)
                .WithMany(c => c.UserHabits)
                .HasForeignKey(uh => uh.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);

            // idx_user_habits_user_archived — Partial Index (active subscriptions only).
            e.HasIndex(uh => uh.UserId)
                .HasDatabaseName("idx_user_habits_user_archived")
                .HasFilter("is_archived = false");
        });

        private static void ConfigureHabitExecution(ModelBuilder b) => b.Entity<HabitExecution>(e =>
        {
            e.HasKey(h => h.Id);
            e.Property(h => h.CreatedAt).HasDefaultValueSql("NOW()");
            e.Property(h => h.LoggedValue).HasPrecision(18, 4);
            e.Property(h => h.Note).HasMaxLength(500);

            // A6: Habit_Executions must NEVER be cascade-deleted from UserHabit. Restrict protects
            // the history. GDPR user-deletion must purge executions via an explicit service-layer
            // SQL step BEFORE the User row is removed (otherwise the cascade to UserHabits blocks).
            e.HasOne(h => h.UserHabit)
                .WithMany(uh => uh.Executions)
                .HasForeignKey(h => h.UserHabitId)
                .OnDelete(DeleteBehavior.Restrict);

            // idx_executions_userhabit_time.
            e.HasIndex(h => new { h.UserHabitId, h.ExecutionTime })
                .HasDatabaseName("idx_executions_userhabit_time");
        });

        private static void ConfigureAffectEntry(ModelBuilder b) => b.Entity<AffectEntry>(e =>
        {
            e.HasKey(a => a.Id);
            e.Property(a => a.RecordedAt).HasDefaultValueSql("NOW()");
            e.Property(a => a.ContextTags)
                .HasColumnType("text[]")
                .HasDefaultValueSql("'{}'::text[]");

            e.HasOne(a => a.User)
                .WithMany(u => u.AffectEntries)
                .HasForeignKey(a => a.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // idx_affect_user_time — chronological fetches for dashboards.
            e.HasIndex(a => new { a.UserId, a.RecordedAt })
                .HasDatabaseName("idx_affect_user_time");

            // idx_affect_tags — GIN on the TEXT[] column for contextual search.
            e.HasIndex(a => a.ContextTags)
                .HasDatabaseName("idx_affect_tags")
                .HasMethod("gin");

            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_affect_pleasure_range", "pleasure_score BETWEEN -5 AND 5");
                t.HasCheckConstraint("ck_affect_arousal_range",  "arousal_score  BETWEEN -5 AND 5");
                t.HasCheckConstraint("ck_affect_dominance_range","dominance_score BETWEEN -5 AND 5");
            });
        });

        private static void ConfigureSleepLog(ModelBuilder b) => b.Entity<SleepLog>(e =>
        {
            e.HasKey(s => s.Id);
            e.Property(s => s.Tags)
                .HasColumnType("text[]")
                .HasDefaultValueSql("'{}'::text[]");

            e.HasOne(s => s.User)
                .WithMany(u => u.SleepLogs)
                .HasForeignKey(s => s.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // idx_sleep_logs_user_time.
            e.HasIndex(s => new { s.UserId, s.SleepStart })
                .HasDatabaseName("idx_sleep_logs_user_time");

            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_sleep_quality_range",   "sleep_quality BETWEEN 1 AND 10");
                t.HasCheckConstraint("ck_sleep_end_after_start", "sleep_end > sleep_start");
                // GiST EXCLUDE constraint `no_overlapping_sleep` is NOT expressible here —
                // add it via raw SQL in the follow-up migration.
            });
        });

        private static void ConfigureSleepRecommendation(ModelBuilder b) => b.Entity<SleepRecommendation>(e =>
        {
            e.HasKey(s => s.Id);

            // A9: multi-day plan stored as a single JSONB document with nested Days[] and Zeitgebers.
            e.OwnsOne(s => s.SleepPlan, sp =>
            {
                sp.ToJson("sleep_plan");
                sp.OwnsMany(p => p.Days, d =>
                {
                    d.OwnsOne(day => day.Zeitgebers);
                });
            });

            e.HasOne(s => s.User)
                .WithMany(u => u.SleepRecommendations)
                .HasForeignKey(s => s.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        private static void ConfigureAchievement(ModelBuilder b) => b.Entity<Achievement>(e =>
        {
            e.HasKey(a => a.Id);
            e.Property(a => a.Title).IsRequired().HasMaxLength(150);
            e.Property(a => a.Description).IsRequired();
            e.Property(a => a.ColorHex).IsRequired().HasMaxLength(7);
            e.Property(a => a.IconUrl).IsRequired().HasMaxLength(500);
            e.Property(a => a.IsArchived).HasDefaultValue(false);
            e.HasQueryFilter(a => !a.IsArchived);

            e.HasOne(a => a.Habit)
                .WithMany(h => h.Achievements)
                .HasForeignKey(a => a.HabitId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        private static void ConfigureUserAchievement(ModelBuilder b) => b.Entity<UserAchievement>(e =>
        {
            // Composite PK (user_id, achievement_id).
            e.HasKey(ua => new { ua.UserId, ua.AchievementId });
            e.Property(ua => ua.CurrentProgress).HasDefaultValue(0);
            e.Property(ua => ua.IsUnlocked).HasDefaultValue(false);

            e.HasOne(ua => ua.User)
                .WithMany(u => u.UserAchievements)
                .HasForeignKey(ua => ua.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // Achievement is soft-deleted in practice; Restrict blocks accidental hard delete that
            // would orphan progress rows.
            e.HasOne(ua => ua.Achievement)
                .WithMany(a => a.UserAchievements)
                .HasForeignKey(ua => ua.AchievementId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        private static void ConfigureAnalystProposal(ModelBuilder b) => b.Entity<AnalystProposal>(e =>
        {
            e.HasKey(p => p.Id);
            e.Property(p => p.CreatedAt).HasDefaultValueSql("NOW()");
            e.Property(p => p.Title).IsRequired().HasMaxLength(200);
            e.Property(p => p.Description).IsRequired();

            e.HasOne(p => p.Analyst)
                .WithMany(u => u.AnalystProposals)
                .HasForeignKey(p => p.AnalystId)
                .OnDelete(DeleteBehavior.Cascade);

            // A6: habit deleted → keep the proposal, null out the reference.
            e.HasOne(p => p.Habit)
                .WithMany(h => h.Proposals)
                .HasForeignKey(p => p.HabitId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // ─────────────────────────── Cross-cutting conventions ───────────────────────────

        /// <summary>
        /// Applies two repository-wide conventions over every non-owned entity in the model:
        ///  <list type="bullet">
        ///   <item>snake_case physical names for tables, columns, primary keys, foreign keys and indexes;</item>
        ///   <item><c>timestamp with time zone</c> (<c>timestamptz</c>) for every <c>DateTime</c> /
        ///         <c>DateTime?</c> column (A2 — UTC storage; local wall-time computed per user timezone).</item>
        ///  </list>
        /// Owned types (ToJson sub-documents) are skipped so their explicit JSONB column names stay intact.
        /// </summary>
        private static void ApplyDatabaseConventions(ModelBuilder builder)
        {
            foreach (var entity in builder.Model.GetEntityTypes())
            {
                if (entity.IsOwned())
                    continue;

                var tableName = entity.GetTableName();
                if (!string.IsNullOrEmpty(tableName))
                    entity.SetTableName(ToSnakeCase(tableName));

                foreach (var prop in entity.GetProperties())
                {
                    prop.SetColumnName(ToSnakeCase(prop.GetColumnName()));

                    if (prop.ClrType == typeof(DateTime) || prop.ClrType == typeof(DateTime?))
                        prop.SetColumnType("timestamp with time zone");
                }

                foreach (var key in entity.GetKeys())
                {
                    var keyName = key.GetName();
                    if (!string.IsNullOrEmpty(keyName))
                        key.SetName(ToSnakeCase(keyName));
                }

                foreach (var fk in entity.GetForeignKeys())
                {
                    var fkName = fk.GetConstraintName();
                    if (!string.IsNullOrEmpty(fkName))
                        fk.SetConstraintName(ToSnakeCase(fkName));
                }

                foreach (var idx in entity.GetIndexes())
                {
                    var idxName = idx.GetDatabaseName();
                    if (!string.IsNullOrEmpty(idxName))
                        idx.SetDatabaseName(ToSnakeCase(idxName));
                }
            }
        }

        /// <summary>
        /// Converts a CLR identifier (<c>UserHabits</c>, <c>IX_Users_Email</c>, <c>TOTAL_METRIC_VOLUME</c>)
        /// to snake_case. Underscores that are already present are preserved; no double-underscore is introduced.
        /// </summary>
        private static string ToSnakeCase(string? input)
        {
            if (string.IsNullOrEmpty(input))
                return string.Empty;

            var sb = new StringBuilder(input.Length + 8);
            for (int i = 0; i < input.Length; i++)
            {
                var c = input[i];
                var prev = i > 0 ? input[i - 1] : '\0';
                var next = i + 1 < input.Length ? input[i + 1] : '\0';

                var needsUnderscore =
                    i > 0 &&
                    char.IsUpper(c) &&
                    prev != '_' &&
                    (char.IsLower(prev) || (char.IsUpper(prev) && char.IsLower(next)));

                if (needsUnderscore)
                    sb.Append('_');

                sb.Append(char.ToLowerInvariant(c));
            }
            return sb.ToString();
        }
    }
}
