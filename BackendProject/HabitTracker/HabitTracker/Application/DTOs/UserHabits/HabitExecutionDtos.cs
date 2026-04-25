using System.ComponentModel.DataAnnotations;

namespace HabitTracker.Application.DTOs.UserHabits
{
    public sealed class HabitExecutionDto
    {
        public Guid Id { get; init; }
        public Guid UserHabitId { get; init; }
        public DateTime ExecutionTime { get; init; }
        public DateTime CreatedAt { get; init; }
        public decimal? LoggedValue { get; init; }
        public string? Note { get; init; }
    }

    /// <summary>
    /// Inbound payload for <c>POST /api/user-habits/{id}/executions</c>.
    /// <see cref="ExecutionTime"/> may be retroactive (validated against the 30-day rule in the service).
    /// </summary>
    public sealed class LogExecutionRequest
    {
        /// <summary>Moment the execution happened (UTC). Optional — defaults to <c>DateTime.UtcNow</c>.</summary>
        public DateTime? ExecutionTime { get; set; }

        public decimal? LoggedValue { get; set; }

        [MaxLength(500)]
        public string? Note { get; set; }
    }
}