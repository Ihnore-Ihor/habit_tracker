using HabitTracker.Application.Common.Exceptions;
using HabitTracker.Application.Common.Extensions;
using HabitTracker.Application.DTOs.UserHabits;
using HabitTracker.Application.Services.UserHabits;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HabitTracker.Controllers
{
    /// <summary>
    /// User-scoped habit subscription and execution endpoints. Every action requires a bearer
    /// token; the owning <c>UserId</c> is read from <see cref="System.Security.Claims.ClaimTypes.NameIdentifier"/>
    /// — the request body never carries it, so a tampered client can't operate on another account.
    /// </summary>
    [ApiController]
    [Route("api/user-habits")]
    [Authorize]
    public sealed class UserHabitController : ControllerBase
    {
        private readonly IUserHabitService _service;

        public UserHabitController(IUserHabitService service)
        {
            _service = service;
        }

        /// <summary>Returns the caller's active (non-archived) habit subscriptions.</summary>
        [HttpGet]
        [ProducesResponseType(typeof(IReadOnlyList<UserHabitDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<IReadOnlyList<UserHabitDto>>> GetMine(CancellationToken ct)
        {
            var userId = User.GetUserId();
            return Ok(await _service.GetActiveUserHabitsAsync(userId, ct));
        }

        /// <summary>Subscribes the caller to a catalog habit (or a fully custom one).</summary>
        [HttpPost]
        [ProducesResponseType(typeof(UserHabitDto), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<UserHabitDto>> Subscribe(
            [FromBody] SubscribeToHabitRequest request,
            CancellationToken ct)
        {
            try
            {
                var userId = User.GetUserId();
                var created = await _service.SubscribeToHabitAsync(userId, request, ct);
                return CreatedAtAction(nameof(GetMine), new { }, created);
            }
            catch (ValidationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        /// <summary>Logs an execution against one of the caller's subscriptions.</summary>
        [HttpPost("{userHabitId:guid}/executions")]
        [ProducesResponseType(typeof(HabitExecutionDto), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<HabitExecutionDto>> LogExecution(
            Guid userHabitId,
            [FromBody] LogExecutionRequest request,
            CancellationToken ct)
        {
            try
            {
                var userId = User.GetUserId();
                var execution = await _service.LogExecutionAsync(userId, userHabitId, request, ct);
                return StatusCode(StatusCodes.Status201Created, execution);
            }
            catch (NotFoundException ex) { return NotFound(new { error = ex.Message }); }
            catch (ValidationException ex) { return BadRequest(new { error = ex.Message }); }
        }

        /// <summary>Returns the caller's most recent executions across all subscriptions.</summary>
        [HttpGet("executions/recent")]
        [ProducesResponseType(typeof(IReadOnlyList<HabitExecutionDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<IReadOnlyList<HabitExecutionDto>>> GetRecentExecutions(
            [FromQuery] int take = 50,
            CancellationToken ct = default)
        {
            var userId = User.GetUserId();
            return Ok(await _service.GetRecentExecutionsAsync(userId, take, ct));
        }
    }
}