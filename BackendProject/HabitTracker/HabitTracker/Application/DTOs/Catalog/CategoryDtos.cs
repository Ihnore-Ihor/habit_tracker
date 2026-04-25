using System.ComponentModel.DataAnnotations;

namespace HabitTracker.Application.DTOs.Catalog
{
    /// <summary>Read model returned to clients. Excludes <c>IsArchived</c> because the global query filter hides archived rows.</summary>
    public sealed class CategoryDto
    {
        public int Id { get; init; }
        public string Name { get; init; } = string.Empty;
        public string ColorHex { get; init; } = string.Empty;
        public string IconEmoji { get; init; } = string.Empty;
        public bool IsNegative { get; init; }
    }

    /// <summary>Inbound payload for <c>POST /api/catalog/categories</c>.</summary>
    public sealed class CreateCategoryRequest
    {
        [Required, MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [Required, MaxLength(7), RegularExpression("^#[0-9A-Fa-f]{6}$", ErrorMessage = "ColorHex must be a 7-char hex string like '#22C55E'.")]
        public string ColorHex { get; set; } = string.Empty;

        [Required, MaxLength(16)]
        public string IconEmoji { get; set; } = string.Empty;

        public bool IsNegative { get; set; }
    }

    /// <summary>Inbound payload for <c>PUT /api/catalog/categories/{id}</c>.</summary>
    public sealed class UpdateCategoryRequest
    {
        [Required, MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [Required, MaxLength(7), RegularExpression("^#[0-9A-Fa-f]{6}$")]
        public string ColorHex { get; set; } = string.Empty;

        [Required, MaxLength(16)]
        public string IconEmoji { get; set; } = string.Empty;

        public bool IsNegative { get; set; }
    }
}