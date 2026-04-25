using System.ComponentModel.DataAnnotations;
using HabitTracker.Models;

namespace HabitTracker.Application.DTOs.UserHabits
{
    /// <summary>Read model for an active subscription returned by GET endpoints.</summary>
    public sealed class UserHabitDto
    {
        public Guid Id { get; init; }
        public int? HabitId { get; init; }
        public int CategoryId { get; init; }
        public string? CustomName { get; init; }
        public string DisplayTitle { get; init; } = string.Empty;
        public bool IsNegative { get; init; }
        public decimal? TargetValue { get; init; }
        public string? MetricUnit { get; init; }
        public FrequencyType FrequencyType { get; init; }
        public ScheduleRuleDto? ScheduleRule { get; init; }
        public string? ColorHex { get; init; }
        public string? IconEmoji { get; init; }
        public int CurrentStreak { get; init; }
        public int LongestStreak { get; init; }
    }

    /// <summary>
    /// Inbound payload for <c>POST /api/user-habits</c>.
    /// Either <see cref="HabitId"/> (catalog template) or <see cref="CustomName"/> (fully custom) must be supplied —
    /// validated at the service layer.
    /// </summary>
    public sealed class SubscribeToHabitRequest
    {
        /// <summary>Optional FK to a catalog <see cref="HabitTracker.Domain.Entities.Habit"/>.</summary>
        public int? HabitId { get; set; }

        /// <summary>FK to <see cref="HabitTracker.Domain.Entities.Category"/>. Always required (analytics grouping).</summary>
        [Required]
        public int CategoryId { get; set; }

        /// <summary>Display name for fully custom habits (HabitId = null).</summary>
        [MaxLength(150)]
        public string? CustomName { get; set; }

        public bool IsNegative { get; set; }

        public decimal? TargetValue { get; set; }

        [MaxLength(32)]
        public string? MetricUnit { get; set; }

        [Required]
        public FrequencyType FrequencyType { get; set; }

        [Required]
        public ScheduleRuleDto ScheduleRule { get; set; } = new();

        [MaxLength(7), RegularExpression("^#[0-9A-Fa-f]{6}$")]
        public string? ColorHex { get; set; }

        [MaxLength(16)]
        public string? IconEmoji { get; set; }
    }
}