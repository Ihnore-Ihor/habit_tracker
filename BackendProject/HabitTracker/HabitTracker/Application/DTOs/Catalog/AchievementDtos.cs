using System.ComponentModel.DataAnnotations;
using HabitTracker.Models;

namespace HabitTracker.Application.DTOs.Catalog
{
    public sealed class AchievementDto
    {
        public int Id { get; init; }
        public string Title { get; init; } = string.Empty;
        public string Description { get; init; } = string.Empty;
        public string ColorHex { get; init; } = string.Empty;
        public string IconUrl { get; init; } = string.Empty;
        public ConditionKey ConditionKey { get; init; }
        public int? TargetValue { get; init; }
        public int? HabitId { get; init; }
    }

    /// <summary>
    /// Inbound payload for <c>POST /api/catalog/achievements</c>.
    /// <see cref="ConditionKey"/> is fixed at code level — content managers pick from the closed enum,
    /// they cannot invent new keys without an evaluator implementation.
    /// </summary>
    public sealed class CreateAchievementRequest
    {
        [Required, MaxLength(150)]
        public string Title { get; set; } = string.Empty;

        [Required]
        public string Description { get; set; } = string.Empty;

        [Required, MaxLength(7), RegularExpression("^#[0-9A-Fa-f]{6}$")]
        public string ColorHex { get; set; } = string.Empty;

        [Required, MaxLength(500)]
        public string IconUrl { get; set; } = string.Empty;

        [Required]
        public ConditionKey ConditionKey { get; set; }

        public int? TargetValue { get; set; }

        public int? HabitId { get; set; }
    }

    public sealed class UpdateAchievementRequest
    {
        [Required, MaxLength(150)]
        public string Title { get; set; } = string.Empty;

        [Required]
        public string Description { get; set; } = string.Empty;

        [Required, MaxLength(7), RegularExpression("^#[0-9A-Fa-f]{6}$")]
        public string ColorHex { get; set; } = string.Empty;

        [Required, MaxLength(500)]
        public string IconUrl { get; set; } = string.Empty;

        [Required]
        public ConditionKey ConditionKey { get; set; }

        public int? TargetValue { get; set; }

        public int? HabitId { get; set; }
    }
}