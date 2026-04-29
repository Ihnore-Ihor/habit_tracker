using HabitTracker.Application.Common.Extensions;
using HabitTracker.Application.DTOs.Analyst;
using HabitTracker.Application.Services.Analyst;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HabitTracker.Controllers
{
    [ApiController]
    [Route("api/analyst")]
    [Authorize(Roles = "Analyst")]
    public sealed class AnalystDashboardController : ControllerBase
    {
        private readonly IAnalystDashboardService _analyst;

        public AnalystDashboardController(IAnalystDashboardService analyst)
        {
            _analyst = analyst;
        }

        // ── Global habit performance ───────────────────────────────────────────────

        [HttpGet("habits/needs-attention")]
        [ProducesResponseType(typeof(IReadOnlyList<HabitNeedsAttentionDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<IReadOnlyList<HabitNeedsAttentionDto>>> GetHabitsNeedingAttention(
            CancellationToken ct)
        {
            var result = await _analyst.GetHabitsNeedingAttentionAsync(ct);
            return Ok(result);
        }

        // ── Sleep AI effectiveness ─────────────────────────────────────────────────

        [HttpGet("sleep/effectiveness")]
        [ProducesResponseType(typeof(SleepEffectivenessDto), StatusCodes.Status200OK)]
        public async Task<ActionResult<SleepEffectivenessDto>> GetSleepEffectiveness(CancellationToken ct)
        {
            var result = await _analyst.GetSleepEffectivenessAsync(ct);
            return Ok(result);
        }

        // ── Habit performance trends ───────────────────────────────────────────────

        [HttpGet("habits/trends")]
        [ProducesResponseType(typeof(IReadOnlyList<HabitTrendDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<IReadOnlyList<HabitTrendDto>>> GetHabitTrends(CancellationToken ct)
        {
            var result = await _analyst.GetHabitTrendsAsync(ct);
            return Ok(result);
        }

        // ── Proposals ─────────────────────────────────────────────────────────────

        [HttpPost("proposals")]
        [ProducesResponseType(typeof(AnalystProposalDto), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<AnalystProposalDto>> CreateProposal(
            [FromBody] CreateProposalRequest request,
            CancellationToken ct)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var analystId = User.GetUserId();
            var result = await _analyst.CreateProposalAsync(analystId, request, ct);
            return CreatedAtAction(nameof(GetMyProposals), result);
        }

        [HttpGet("proposals/me")]
        [ProducesResponseType(typeof(IReadOnlyList<AnalystProposalDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<IReadOnlyList<AnalystProposalDto>>> GetMyProposals(CancellationToken ct)
        {
            var analystId = User.GetUserId();
            var result = await _analyst.GetMyProposalsAsync(analystId, ct);
            return Ok(result);
        }

        [HttpGet("proposals/others")]
        [ProducesResponseType(typeof(IReadOnlyList<AnalystProposalDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<IReadOnlyList<AnalystProposalDto>>> GetOthersProposals(CancellationToken ct)
        {
            var analystId = User.GetUserId();
            var result = await _analyst.GetOthersProposalsAsync(analystId, ct);
            return Ok(result);
        }
    }
}
