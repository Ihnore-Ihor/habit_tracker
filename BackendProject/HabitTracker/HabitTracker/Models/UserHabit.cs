namespace HabitTracker.Models
{
    using System.ComponentModel.DataAnnotations;
    using System.ComponentModel.DataAnnotations.Schema;
    using System.Text.Json;

    public class UserHabit
    {
        [Key]
        public Guid Id { get; set; }

        public Guid UserId { get; set; }
        public int? HabitId { get; set; }

        public FrequencyType FrequencyType { get; set; }

        [Column(TypeName = "jsonb")]
        public string? ScheduleRule { get; set; } // Зберігаємо як JSON рядок
    }
}
