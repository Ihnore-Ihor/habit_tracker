using HabitTracker.Application.Common.Exceptions;
using HabitTracker.Application.Common.Extensions;
using HabitTracker.Application.DTOs.Sleep;
using HabitTracker.Application.Services.Sleep;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HabitTracker.Controllers
{
    /// <summary>
    /// Sleep logging and per-user sleep profile management. All actions require a bearer token;
    /// the caller's id comes from <see cref="System.Security.Claims.ClaimTypes.NameIdentifier"/>.
    /// </summary>
    [ApiController]
    [Route("api/sleep")]
    [Authorize]
    public sealed class SleepController : ControllerBase
    {
        private readonly ISleepTrackingService _service;

        public SleepController(ISleepTrackingService service)
        {
            _service = service;
        }

        /// <summary>Logs a sleep interval. May be retroactive; no-overlap is enforced by GiST EXCLUDE.</summary>
        [HttpPost("logs")]
        [ProducesResponseType(typeof(SleepLogDto), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<SleepLogDto>> LogSleep(
            [FromBody] LogSleepRequest request,
            CancellationToken ct)
        {
            try
            {
                var userId = User.GetUserId();
                var log = await _service.LogSleepAsync(userId, request, ct);
                return StatusCode(StatusCodes.Status201Created, log);
            }
            catch (ValidationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        /// <summary>Returns sleep logs within a specific date range.</summary>
        [HttpGet]
        [ProducesResponseType(typeof(IReadOnlyList<SleepLogDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<IReadOnlyList<SleepLogDto>>> GetSleepLogs(
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to,
            CancellationToken ct)
        {
            var userId = User.GetUserId();
            return Ok(await _service.GetSleepLogsAsync(userId, from, to, ct));
        }

        /// <summary>Returns the caller's most recent sleep logs.</summary>
        [HttpGet("logs")]
        [ProducesResponseType(typeof(IReadOnlyList<SleepLogDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<IReadOnlyList<SleepLogDto>>> GetRecent(
            [FromQuery] int take = 30,
            CancellationToken ct = default)
        {
            var userId = User.GetUserId();
            return Ok(await _service.GetRecentSleepLogsAsync(userId, take, ct));
        }

        /// <summary>Returns the caller's <c>UserSleepProfile</c>, or 404 if it has never been created.</summary>
        [HttpGet("profile")]
        [ProducesResponseType(typeof(SleepProfileDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<SleepProfileDto>> GetProfile(CancellationToken ct)
        {
            var userId = User.GetUserId();
            var profile = await _service.GetSleepProfileAsync(userId, ct);
            return profile is null ? NotFound(new { error = "Sleep profile has not been set up yet." }) : Ok(profile);
        }

        /// <summary>Creates or replaces the caller's sleep profile (PUT semantics — full replacement).</summary>
        [HttpPut("profile")]
        [ProducesResponseType(typeof(SleepProfileDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<SleepProfileDto>> UpsertProfile(
            [FromBody] UpsertSleepProfileRequest request,
            CancellationToken ct)
        {
            try
            {
                var userId = User.GetUserId();
                var profile = await _service.UpsertSleepProfileAsync(userId, request, ct);
                return Ok(profile);
            }
            catch (ValidationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }
    }
}
