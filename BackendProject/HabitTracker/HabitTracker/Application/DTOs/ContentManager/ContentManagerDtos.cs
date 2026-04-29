using System.ComponentModel.DataAnnotations;
using HabitTracker.Models;

namespace HabitTracker.Application.DTOs.ContentManager
{
    // ── Proposals ────────────────────────────────────────────────────────────────

    /// <summary>
    /// Enriched view of an <c>AnalystProposal</c> for the content-manager queue.
    /// <c>Status</c> maps to <c>ProposalStatus</c>: 0=Pending, 1=Implemented, 2=Rejected.
    /// </summary>
    public sealed class ProposalManagerDto
    {
        public Guid Id { get; init; }
        public string? HabitTitle { get; init; }
        public string AnalystName { get; init; } = string.Empty;
        public string ProposedChange { get; init; } = string.Empty;
        public string Argumentation { get; init; } = string.Empty;
        public int Status { get; init; }
        public DateTime CreatedAt { get; init; }
    }

    /// <summary>Payload for <c>PUT /api/content/proposals/{id}/status</c>.</summary>
    public sealed class UpdateProposalStatusRequest
    {
        /// <summary>0=Pending, 1=Implemented, 2=Rejected.</summary>
        [Required]
        public int Status { get; set; }
    }

    // ── Categories ────────────────────────────────────────────────────────────────

    /// <summary>Category row enriched with the count of active habits it contains.</summary>
    public sealed class CategoryManagerDto
    {
        public int Id { get; init; }
        public string Name { get; init; } = string.Empty;
        public string? Description { get; init; }
        public string IconEmoji { get; init; } = string.Empty;
        public string ColorHex { get; init; } = string.Empty;
        public bool IsNegative { get; init; }
        public int HabitCount { get; init; }
    }

    /// <summary>Payload for <c>POST /api/content/categories</c>.</summary>
    public sealed class CreateCategoryRequest
    {
        [Required, MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }

        [Required, MaxLength(7)]
        public string ColorHex { get; set; } = string.Empty;

        [Required, MaxLength(16)]
        public string IconEmoji { get; set; } = string.Empty;

        public bool IsNegative { get; set; }
    }

    /// <summary>Payload for <c>PUT /api/content/categories/{id}</c>.</summary>
    public sealed class UpdateCategoryRequest
    {
        [Required, MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }

        [Required, MaxLength(7)]
        public string ColorHex { get; set; } = string.Empty;

        [Required, MaxLength(16)]
        public string IconEmoji { get; set; } = string.Empty;

        public bool IsNegative { get; set; }
    }

    // ── Habits ────────────────────────────────────────────────────────────────────

    /// <summary>Catalog habit row with its parent category name resolved.</summary>
    public sealed class HabitCatalogDto
    {
        public int Id { get; init; }
        public string Title { get; init; } = string.Empty;
        public string? Description { get; init; }
        public int CategoryId { get; init; }
        public string CategoryName { get; init; } = string.Empty;
        public string? ColorHex { get; init; }
        public string? IconEmoji { get; init; }
        public bool IsNegative { get; init; }
    }

    /// <summary>Payload for <c>POST /api/content/habits</c>.</summary>
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

    /// <summary>Payload for <c>PUT /api/content/habits/{id}</c>.</summary>
    public sealed class UpdateHabitRequest
    {
        [Required, MaxLength(150)]
        public string Title { get; set; } = string.Empty;

        [Required]
        public int CategoryId { get; set; }

        public string? Description { get; set; }

        [MaxLength(7), RegularExpression("^#[0-9A-Fa-f]{6}$")]
        public string? ColorHex { get; set; }

        [MaxLength(16)]
        public string? IconEmoji { get; set; }

        public bool IsNegative { get; set; }
    }

    // ── Achievements ──────────────────────────────────────────────────────────────

    /// <summary>Achievement catalog row with <c>ConditionKey</c> exposed as its enum member name.</summary>
    public sealed class AchievementManagerDto
    {
        public int Id { get; init; }
        public string Title { get; init; } = string.Empty;
        public string Description { get; init; } = string.Empty;
        public int? TargetValue { get; init; }
        public string ConditionKey { get; init; } = string.Empty;
        public string IconUrl { get; init; } = string.Empty;
    }

    /// <summary>Payload for <c>POST /api/content/achievements</c>.</summary>
    public sealed class CreateAchievementRequest
    {
        [Required, MaxLength(150)]
        public string Title { get; set; } = string.Empty;

        [Required]
        public string Description { get; set; } = string.Empty;

        [Required, MaxLength(7)]
        public string ColorHex { get; set; } = string.Empty;

        [Required, MaxLength(500)]
        public string IconUrl { get; set; } = string.Empty;

        [Required]
        public ConditionKey ConditionKey { get; set; }

        public int? TargetValue { get; set; }
    }

    /// <summary>Payload for <c>PUT /api/content/achievements/{id}</c>.</summary>
    public sealed class UpdateAchievementRequest
    {
        [Required, MaxLength(150)]
        public string Title { get; set; } = string.Empty;

        [Required]
        public string Description { get; set; } = string.Empty;

        [Required, MaxLength(7)]
        public string ColorHex { get; set; } = string.Empty;

        [Required, MaxLength(500)]
        public string IconUrl { get; set; } = string.Empty;

        [Required]
        public ConditionKey ConditionKey { get; set; }

        public int? TargetValue { get; set; }
    }
}
