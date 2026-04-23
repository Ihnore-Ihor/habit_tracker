using HabitTracker.Models;

namespace HabitTracker.Domain.ValueObjects
{
    /// <summary>
    /// Polymorphic habit schedule persisted as a JSONB column on <c>UserHabit.ScheduleRule</c>.
    /// Every field is nullable by design; which combination is authoritative is determined by
    /// <c>UserHabit.FrequencyType</c> (Daily / Weekly / Monthly / Once).
    /// Interpreted against the owning user's local timezone, not UTC.
    /// </summary>
    public class ScheduleRule
    {
        /// <summary>
        /// Coarse time-of-day bucket (Morning / Afternoon / Evening / Night / Anytime).
        /// Used when the user doesn't pin an exact clock time.
        /// </summary>
        public TimeSlot? TimeSlot { get; set; }

        /// <summary>
        /// Exact local wall-clock time the reminder/target fires at, when set.
        /// Combine with the user's timezone to produce absolute moments.
        /// </summary>
        public TimeOnly? ExactTime { get; set; }

        /// <summary>
        /// Active weekdays for a Weekly schedule (e.g., [Tuesday, Thursday]).
        /// Ignored for other frequencies.
        /// </summary>
        public List<DayOfWeek>? DaysOfWeek { get; set; }

        /// <summary>
        /// Calendar day-of-month (1–31) for a Monthly schedule.
        /// If the target month is shorter than the value, the last day of that month is used.
        /// </summary>
        public int? DayOfMonth { get; set; }

        /// <summary>
        /// Single-shot target date for a <c>FrequencyType.Once</c> habit.
        /// </summary>
        public DateOnly? OneTimeDate { get; set; }

        /// <summary>
        /// Target count for "N times per period" rules (e.g., "3 times a week" = 3 when paired with Weekly).
        /// Allows looser cadence habits that don't pin specific weekdays.
        /// </summary>
        public int? TimesPerPeriod { get; set; }
    }
}
