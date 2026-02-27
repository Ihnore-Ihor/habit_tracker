namespace HabitTracker.Models
{
    using System.ComponentModel.DataAnnotations;
    using System.ComponentModel.DataAnnotations.Schema;

    public class User
    {
        [Key]
        public Guid Id { get; set; }

        public int RoleId { get; set; }
        public string Nickname { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;

        // Кешовані стріки (будуть оновлюватися тригером)
        public int CurrentGoodStreak { get; set; }
        public int LongestGoodStreak { get; set; }

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    }
}
