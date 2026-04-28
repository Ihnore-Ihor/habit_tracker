using System.ComponentModel.DataAnnotations;

namespace HabitTracker.Application.DTOs.Sleep
{
    public sealed class SleepLogDto
    {
        public Guid Id { get; init; }
        public DateTime SleepStart { get; init; }
        public DateTime SleepEnd { get; init; }
        public int SleepQuality { get; init; }
        public List<string> Tags { get; init; } = new();
    }

    /// <summary>
    /// Inbound payload for <c>POST /api/sleep/logs</c>.
    /// Both bounds are interpreted as UTC; the service forces <c>DateTimeKind.Utc</c> before persisting
    /// because the GiST EXCLUDE constraint operates on the raw timestamps.
    /// </summary>
    public sealed class LogSleepRequest
    {
        [Required]
        public DateTime SleepStart { get; set; }

        [Required]
        public DateTime SleepEnd { get; set; }

        [Required, Range(1, 10)]
        public int SleepQuality { get; set; }

        public List<string>? Tags { get; set; }
    }

    public sealed class SleepProfileDto
    {
        public Guid Id { get; init; }
        public TimeOnly TargetWakeTime { get; init; }
        public decimal BaseSleepHours { get; init; }
        public decimal AbsoluteMinSleepHours { get; init; }
        public int ShiftStepMinutes { get; init; }
        public decimal WeekendDeviationHours { get; init; }
        public TimeOnly? CurrentWakeTime { get; init; }
        public int SleepDebtMinutes { get; init; }
    }

    /// <summary>
    /// Inbound payload for <c>PUT /api/sleep/profile</c>. Acts as an upsert — creates the row
    /// on first call (1:1 with the caller's User), overwrites it thereafter.
    /// </summary>
    public sealed class UpsertSleepProfileRequest
    {
        [Required]
        public TimeOnly TargetWakeTime { get; set; }

        [Required, Range(1.0, 16.0)]
        public decimal BaseSleepHours { get; set; }

        /// <summary>
        /// Absolute floor (hours). Spec disallows a hardcoded 6h floor; only requirement is &gt; 0,
        /// enforced both here (ValidationException) and at the DB level (<c>ck_sleep_profile_min_positive</c>).
        /// </summary>
        [Required, Range(0.5, 12.0)]
        public decimal AbsoluteMinSleepHours { get; set; }

        [Required, Range(5, 120)]
        public int ShiftStepMinutes { get; set; }

        [Required, Range(0.0, 6.0)]
        public decimal WeekendDeviationHours { get; set; }
    }
}