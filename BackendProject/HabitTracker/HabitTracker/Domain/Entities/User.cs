using System.ComponentModel.DataAnnotations;

namespace HabitTracker.Domain.Entities
{
    /// <summary>
    /// Account holder of the Harmony habit-tracker. Aggregate root for all transactional data
    /// (habits, executions, affect entries, sleep logs, recommendations, achievements, proposals).
    /// Deletion cascades to every transactional child table for GDPR compliance.
    /// </summary>
    public class User
    {
        /// <summary>UUID primary key. Chosen over SERIAL to support future horizontal sharding of the write-heavy tables.</summary>
        [Key]
        public Guid Id { get; set; }

        /// <summary>FK to <see cref="Role"/>. Drives authorisation for every downstream controller.</summary>
        public int RoleId { get; set; }

        /// <summary>Publicly displayed name. Not unique — users may choose any nickname.</summary>
        [Required, MaxLength(100)]
        public string Nickname { get; set; } = string.Empty;

        /// <summary>Unique login address. Normalised lowercase on write.</summary>
        [Required, EmailAddress, MaxLength(255)]
        public string Email { get; set; } = string.Empty;

        /// <summary>Hashed credential (BCrypt/Argon2). Never exposed via API responses.</summary>
        [Required, MaxLength(255)]
        public string PasswordHash { get; set; } = string.Empty;

        /// <summary>
        /// IANA timezone string (e.g. "Europe/Kyiv"). All stored timestamps are UTC — this value is applied
        /// by the streak-maintenance job and analytics views to determine "the user's calendar day".
        /// </summary>
        [Required, MaxLength(64)]
        public string Timezone { get; set; } = "UTC";

        /// <summary>
        /// Last-modified timestamp maintained by the Postgres trigger <c>trg_users_updated_at</c>.
        /// Do NOT write this from application code — EF Core configuration marks it database-generated.
        /// </summary>
        public DateTime UpdatedAt { get; set; }

        /// <summary>Role navigation.</summary>
        public Role Role { get; set; } = null!;

        /// <summary>1-to-1 companion profile holding the smart-sleep algorithm parameters.</summary>
        public UserSleepProfile? SleepProfile { get; set; }

        /// <summary>All habits (both template-derived and custom) the user has subscribed to.</summary>
        public ICollection<UserHabit> UserHabits { get; set; } = new List<UserHabit>();

        /// <summary>PAD affect readings recorded throughout the day.</summary>
        public ICollection<AffectEntry> AffectEntries { get; set; } = new List<AffectEntry>();

        /// <summary>Manually logged sleep intervals (start / end / quality).</summary>
        public ICollection<SleepLog> SleepLogs { get; set; } = new List<SleepLog>();

        /// <summary>Algorithm-generated multi-day sleep plans.</summary>
        public ICollection<SleepRecommendation> SleepRecommendations { get; set; } = new List<SleepRecommendation>();

        /// <summary>Gamification progress rows — one per unlocked or in-progress achievement.</summary>
        public ICollection<UserAchievement> UserAchievements { get; set; } = new List<UserAchievement>();

        /// <summary>Proposals authored by this user when acting in the Analyst role.</summary>
        public ICollection<AnalystProposal> AnalystProposals { get; set; } = new List<AnalystProposal>();
    }
}
