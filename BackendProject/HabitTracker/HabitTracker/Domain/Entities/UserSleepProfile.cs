using System.ComponentModel.DataAnnotations;

namespace HabitTracker.Domain.Entities
{
    /// <summary>
    /// Per-user parameterisation of the smart-sleep algorithm. One-to-one with <see cref="User"/>.
    /// Stores target rhythm, tolerance bands, and the rolling sleep-debt accumulator.
    /// </summary>
    public class UserSleepProfile
    {
        /// <summary>UUID primary key (independent of <see cref="UserId"/>).</summary>
        [Key]
        public Guid Id { get; set; }

        /// <summary>FK to <see cref="User"/>. Unique — enforces the 1-to-1 relationship.</summary>
        public Guid UserId { get; set; }

        /// <summary>Local wake time the algorithm anchors everything around (<c>Target_Wake</c>).</summary>
        public TimeOnly TargetWakeTime { get; set; }

        /// <summary>Preferred sleep duration in hours (<c>Base_Sleep</c>). Decimal to allow values like 7.5.</summary>
        public decimal BaseSleepHours { get; set; }

        /// <summary>
        /// Floor the algorithm must never plan below (<c>Absolute_Min_Sleep</c>).
        /// The system deliberately does NOT enforce a hardcoded 6-hour floor; users may set as low as 2h
        /// during strict deadlines. Enforced <c>&gt; 0</c> only, via DB CHECK (configured in Step 3).
        /// </summary>
        public decimal AbsoluteMinSleepHours { get; set; }

        /// <summary>Granularity at which the algorithm may shift bedtime (typically 15 or 30 minutes).</summary>
        public int ShiftStepMinutes { get; set; }

        /// <summary>Extra slack (in hours) permitted on weekends vs. weekdays — e.g. 1.5 allows a later wake.</summary>
        public decimal WeekendDeviationHours { get; set; }

        /// <summary>Actual local wake time recorded for the current day; compared against <see cref="TargetWakeTime"/> to update debt.</summary>
        public TimeOnly? CurrentWakeTime { get; set; }

        /// <summary>Running sleep-debt balance in minutes (<c>Sleep_Debt</c>). Positive = under-slept; non-negative is normal.</summary>
        public int SleepDebtMinutes { get; set; }

        /// <summary>Owning user.</summary>
        public User User { get; set; } = null!;
    }
}
