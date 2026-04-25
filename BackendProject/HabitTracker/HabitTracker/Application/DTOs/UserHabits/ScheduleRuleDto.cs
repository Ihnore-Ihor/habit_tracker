using HabitTracker.Models;

namespace HabitTracker.Application.DTOs.UserHabits
{
    /// <summary>
    /// Wire format for <see cref="HabitTracker.Domain.ValueObjects.ScheduleRule"/>.
    /// Every field is nullable; the authoritative subset depends on the parent's
    /// <see cref="FrequencyType"/> (Daily / Weekly / Monthly / Once).
    /// </summary>
    public sealed class ScheduleRuleDto
    {
        public TimeSlot? TimeSlot { get; set; }
        public TimeOnly? ExactTime { get; set; }
        public List<DayOfWeek>? DaysOfWeek { get; set; }
        public int? DayOfMonth { get; set; }
        public DateOnly? OneTimeDate { get; set; }
        public int? TimesPerPeriod { get; set; }
    }
}
