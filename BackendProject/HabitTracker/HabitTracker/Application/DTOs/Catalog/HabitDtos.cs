using System.ComponentModel.DataAnnotations;

namespace HabitTracker.Application.DTOs.Catalog
{
    public sealed class HabitDto
    {
        public int Id { get; init; }
        public int CategoryId { get; init; }
        public string Title { get; init; } = string.Empty;
        public string? Description { get; init; }
        public string? ColorHex { get; init; }
        public string? IconEmoji { get; init; }
        public bool IsNegative { get; init; }
    }

    public sealed class CreateHabitRequest
    {
        [Required]
        public int CategoryId { get; set; }

        [Required, MaxLength(150)]
        public string Title { get; set; } = string.Empty;

        public string? Description { get; set; }

        [MaxLength(7), RegularExpression("^#[0-9A-Fa-f]{6}$")]
        public string? ColorHex { get; set; }

        [MaxLength(16)]
        public string? IconEmoji { get; set; }

        public bool IsNegative { get; set; }
    }

    public sealed class UpdateHabitRequest
    {
        [Required]
        public int CategoryId { get; set; }

        [Required, MaxLength(150)]
        public string Title { get; set; } = string.Empty;

        public string? Description { get; set; }

        [MaxLength(7), RegularExpression("^#[0-9A-Fa-f]{6}$")]
        public string? ColorHex { get; set; }

        [MaxLength(16)]
        public string? IconEmoji { get; set; }

        public bool IsNegative { get; set; }
    }
}