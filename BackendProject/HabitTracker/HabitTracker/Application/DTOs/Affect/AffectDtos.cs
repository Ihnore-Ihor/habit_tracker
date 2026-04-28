using System.ComponentModel.DataAnnotations;

namespace HabitTracker.Application.DTOs.Affect
{
    public sealed class AffectEntryDto
    {
        public Guid Id { get; init; }
        public int PleasureScore { get; init; }
        public int ArousalScore { get; init; }
        public int DominanceScore { get; init; }
        public List<string> ContextTags { get; init; } = new();
        public string? Note { get; init; }
        public DateTime RecordedAt { get; init; }
    }

    /// <summary>
    /// Inbound payload for <c>POST /api/affect</c>.
    /// Three PAD axes in [-5, +5]; DB CHECK constraints duplicate the validation server-side.
    /// </summary>
    public sealed class LogAffectRequest
    {
        [Required, Range(-5, 5)]
        public int PleasureScore { get; set; }

        [Required, Range(-5, 5)]
        public int ArousalScore { get; set; }

        [Required, Range(-5, 5)]
        public int DominanceScore { get; set; }

        public List<string>? ContextTags { get; set; }

        public string? Note { get; set; }

        /// <summary>Optional retro-log moment (UTC). Defaults to <c>DateTime.UtcNow</c>.</summary>
        public DateTime? RecordedAt { get; set; }
    }

    public sealed class AffectSummaryDto
    {
        public double p_centroid { get; init; }
        public double a_centroid { get; init; }
        public double d_centroid { get; init; }
    }
}
