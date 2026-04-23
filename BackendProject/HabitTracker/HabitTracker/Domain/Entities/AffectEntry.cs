using System.ComponentModel.DataAnnotations;

namespace HabitTracker.Domain.Entities
{
    /// <summary>
    /// One PAD (Pleasure–Arousal–Dominance) affect reading recorded by the user.
    /// Replaces a naive 1-10 mood slider with three physiologically meaningful axes, each in the
    /// signed range [-5, +5]. Multiple entries per day feed <c>fn_calculate_daily_affect_centroid</c>
    /// (Trapezoidal AUC + Peak-End) and the Pearson-correlation view.
    /// </summary>
    public class AffectEntry
    {
        /// <summary>UUID primary key.</summary>
        [Key]
        public Guid Id { get; set; }

        /// <summary>Owning user (cascade-deleted with the user).</summary>
        public Guid UserId { get; set; }

        /// <summary>
        /// Pleasure / comfort axis. -5 = pain / strong aversion, 0 = neutral, +5 = deep contentment.
        /// DB CHECK constraint enforces the range in addition to this attribute.
        /// </summary>
        [Range(-5, 5)]
        public int PleasureScore { get; set; }

        /// <summary>
        /// Arousal / energy axis. -5 = lethargic / sedated, 0 = neutral, +5 = highly activated / wired.
        /// </summary>
        [Range(-5, 5)]
        public int ArousalScore { get; set; }

        /// <summary>
        /// Dominance / control axis. -5 = helpless / overwhelmed, 0 = neutral, +5 = fully in control.
        /// </summary>
        [Range(-5, 5)]
        public int DominanceScore { get; set; }

        /// <summary>
        /// Free-form situational context tags (e.g. ["work", "sleep_deprivation"]). Stored as native
        /// PostgreSQL TEXT[] and mapped natively to <c>List&lt;string&gt;</c>; indexed by <c>idx_affect_tags</c> (GIN).
        /// </summary>
        public List<string> ContextTags { get; set; } = new();

        /// <summary>Optional long-form note explaining the state.</summary>
        public string? Note { get; set; }

        /// <summary>Instant the state was felt (UTC). Indexed jointly with <see cref="UserId"/> by <c>idx_affect_user_time</c>.</summary>
        public DateTime RecordedAt { get; set; }

        /// <summary>Owning user.</summary>
        public User User { get; set; } = null!;
    }
}
