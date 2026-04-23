using System.ComponentModel.DataAnnotations;
using HabitTracker.Models;

namespace HabitTracker.Domain.Entities
{
    /// <summary>
    /// Formalised content-improvement request authored by a user in the Analyst role.
    /// Feeds the content-manager queue and the <c>mvw_analyst_proposal_impact</c> materialized view, which
    /// measures month-over-month change in completion rate for <see cref="HabitId"/> before and after
    /// implementation. Retained after the target habit is deleted (FK uses SET NULL).
    /// </summary>
    public class AnalystProposal
    {
        /// <summary>UUID primary key.</summary>
        [Key]
        public Guid Id { get; set; }

        /// <summary>FK to the authoring analyst (<see cref="User"/> with the Analyst role).</summary>
        public Guid AnalystId { get; set; }

        /// <summary>Optional FK to the <see cref="Habit"/> the proposal targets; null for catalog-wide suggestions.</summary>
        public int? HabitId { get; set; }

        /// <summary>Submission timestamp (UTC). Used by the impact MV as the "before/after" split point.</summary>
        public DateTime CreatedAt { get; set; }

        /// <summary>Short title / essence of the proposal.</summary>
        [Required, MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        /// <summary>Detailed justification for the content change.</summary>
        [Required]
        public string Description { get; set; } = string.Empty;

        /// <summary>
        /// Review status. Mapped to the PostgreSQL enum <c>proposal_status</c>.
        /// New proposals start as <c>Pending</c>; terminal states are <c>Implemented</c> or <c>Rejected</c>.
        /// </summary>
        public ProposalStatus Status { get; set; }

        /// <summary>Authoring analyst.</summary>
        public User Analyst { get; set; } = null!;

        /// <summary>Target habit (null for catalog-wide proposals).</summary>
        public Habit? Habit { get; set; }
    }
}
