using HabitTracker.Application.Common.Exceptions;
using HabitTracker.Application.Common.Extensions;
using HabitTracker.Application.DTOs.Sleep;
using HabitTracker.Application.Services.Sleep;
using HabitTracker.Domain.ValueObjects;
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

        /// <summary>Returns the caller's <c>UserSleepProfile</c>, or a default profile if it has never been created.</summary>
        [HttpGet("profile")]
        [ProducesResponseType(typeof(SleepProfileDto), StatusCodes.Status200OK)]
        public async Task<ActionResult<SleepProfileDto>> GetProfile(CancellationToken ct)
        {
            var userId = User.GetUserId();
            var profile = await _service.GetSleepProfileAsync(userId, ct);
            
            if (profile == null)
            {
                // Повертаємо дефолтний профіль, щоб фронтенд мав що малювати (пунктир цілі тощо)
                return Ok(new SleepProfileDto 
                { 
                    TargetWakeTime = new TimeOnly(7, 30), 
                    BaseSleepHours = 8.0m,
                    AbsoluteMinSleepHours = 6.0m,
                    ShiftStepMinutes = 15,
                    WeekendDeviationHours = 1.0m
                });
            }

            return Ok(profile);
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

        /// <summary>Generates a new 7-day sleep recommendation plan using the Sleep Router algorithm.</summary>
        [HttpPost("recommendations/generate")]
        [ProducesResponseType(typeof(SleepPlan), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<SleepPlan>> GenerateRecommendations(CancellationToken ct)
        {
            try
            {
                var userId = User.GetUserId();
                var plan = await _service.GenerateSleepPlanAsync(userId, ct);
                return Ok(plan);
            }
            catch (ValidationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        /// <summary>Returns the most recently generated sleep recommendation plan.</summary>
        [HttpGet("recommendations/latest")]
        [ProducesResponseType(typeof(SleepPlan), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<SleepPlan>> GetLatestRecommendation(CancellationToken ct)
        {
            var userId = User.GetUserId();
            var plan = await _service.GetLatestRecommendationAsync(userId, ct);
            if (plan == null) return NotFound(new { error = "No recommendations generated yet." });
            return Ok(plan);
        }

        /// <summary>Updates an existing sleep log.</summary>
        [HttpPut("{id}")]
        [ProducesResponseType(typeof(SleepLogDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<SleepLogDto>> UpdateSleepLog(
            Guid id,
            [FromBody] LogSleepRequest request,
            CancellationToken ct)
        {
            try
            {
                var userId = User.GetUserId();
                var log = await _service.UpdateSleepLogAsync(userId, id, request, ct);
                return Ok(log);
            }
            catch (ValidationException ex)
            {
                if (ex.Message.Contains("not found")) return NotFound();
                return BadRequest(new { error = ex.Message });
            }
        }

        /// <summary>Deletes a sleep log.</summary>
        [HttpDelete("{id}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        public async Task<IActionResult> DeleteSleepLog(Guid id, CancellationToken ct)
        {
            var userId = User.GetUserId();
            await _service.DeleteSleepLogAsync(userId, id, ct);
            return NoContent();
        }
    }
}
