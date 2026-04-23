using System.ComponentModel.DataAnnotations;

namespace HabitTracker.Domain.Entities
{
    /// <summary>
    /// One manually logged sleep interval. Supports retroactive entry for any past day — the smart-sleep
    /// algorithm reconstructs sleep debt and future recommendations purely from these rows.
    /// Non-overlap is enforced at the database level by the GiST EXCLUDE constraint <c>no_overlapping_sleep</c>.
    /// </summary>
    public class SleepLog
    {
        /// <summary>UUID primary key.</summary>
        [Key]
        public Guid Id { get; set; }

        /// <summary>Owning user (cascade-deleted with the user).</summary>
        public Guid UserId { get; set; }

        /// <summary>Fell-asleep moment (UTC). May be retroactive.</summary>
        public DateTime SleepStart { get; set; }

        /// <summary>Woke-up moment (UTC). DB CHECK enforces <c>SleepEnd &gt; SleepStart</c>.</summary>
        public DateTime SleepEnd { get; set; }

        /// <summary>Subjective quality rating, 1 (terrible) – 10 (perfect). DB CHECK mirrors this attribute.</summary>
        [Range(1, 10)]
        public int SleepQuality { get; set; }

        /// <summary>
        /// Situational tags (e.g. "alcohol", "stress", "late_meal"). TEXT[] mapped to <c>List&lt;string&gt;</c>;
        /// used by the sleep-recommendation effectiveness MV.
        /// </summary>
        public List<string> Tags { get; set; } = new();

        /// <summary>Owning user.</summary>
        public User User { get; set; } = null!;
    }
}
