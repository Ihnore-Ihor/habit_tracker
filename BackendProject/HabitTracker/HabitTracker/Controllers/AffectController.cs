using HabitTracker.Application.Common.Exceptions;
using HabitTracker.Application.Common.Extensions;
using HabitTracker.Application.DTOs.Affect;
using HabitTracker.Application.Services.Affect;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HabitTracker.Controllers
{
    /// <summary>
    /// PAD (Pleasure-Arousal-Dominance) affect endpoints. All actions require a bearer token;
    /// the caller's id is read from the JWT, never from the request body.
    /// </summary>
    [ApiController]
    [Route("api/affect")]
    [Authorize]
    public sealed class AffectController : ControllerBase
    {
        private readonly IAffectTrackingService _service;

        public AffectController(IAffectTrackingService service)
        {
            _service = service;
        }

        /// <summary>Records a single PAD reading and queues the gamification event.</summary>
        [HttpPost]
        [ProducesResponseType(typeof(AffectEntryDto), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<AffectEntryDto>> Log(
            [FromBody] LogAffectRequest request,
            CancellationToken ct)
        {
            try
            {
                var userId = User.GetUserId();
                var entry = await _service.LogAffectAsync(userId, request, ct);
                return StatusCode(StatusCodes.Status201Created, entry);
            }
            catch (ValidationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        /// <summary>Returns the caller's most recent affect entries (newest first).</summary>
        [HttpGet]
        [ProducesResponseType(typeof(IReadOnlyList<AffectEntryDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<IReadOnlyList<AffectEntryDto>>> GetRecent(
            [FromQuery] int take = 50,
            CancellationToken ct = default)
        {
            var userId = User.GetUserId();
            return Ok(await _service.GetRecentEntriesAsync(userId, take, ct));
        }

        /// <summary>Returns the caller's affect entries for the specified date.</summary>
        [HttpGet("daily")]
        [ProducesResponseType(typeof(IReadOnlyList<AffectEntryDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<IReadOnlyList<AffectEntryDto>>> GetDailyAffect([FromQuery] DateTime? date, CancellationToken ct)
        {
            var userId = User.GetUserId();
            return Ok(await _service.GetDailyAffectAsync(userId, date, ct));
        }

        /// <summary>Returns the centroid of the caller's affect for the specified date.</summary>
        [HttpGet("daily/summary")]
        [ProducesResponseType(typeof(AffectSummaryDto), StatusCodes.Status200OK)]
        public async Task<ActionResult<AffectSummaryDto>> GetDailySummary([FromQuery] DateTime? date, CancellationToken ct)
        {
            var userId = User.GetUserId();
            return Ok(await _service.GetDailySummaryAsync(userId, date, ct));
        }
    }
}
