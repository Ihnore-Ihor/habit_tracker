using HabitTracker.Application.Common.Extensions;
using HabitTracker.Application.DTOs.Analytics;
using HabitTracker.Application.Services.Analytics;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HabitTracker.Controllers
{
    /// <summary>
    /// Read-only analytics endpoints. All actions require a bearer token; the caller's id comes
    /// from <see cref="System.Security.Claims.ClaimTypes.NameIdentifier"/>, never from the
    /// query string — so a tampered request can't fetch another account's analytics.
    /// </summary>
    [ApiController]
    [Route("api/analytics")]
    [Authorize]
    public sealed class AnalyticsController : ControllerBase
    {
        private readonly IAnalyticsService _analytics;

        public AnalyticsController(IAnalyticsService analytics)
        {
            _analytics = analytics;
        }

        /// <summary>
        /// Daily summary rows for the caller. Optional <paramref name="startDate"/> /
        /// <paramref name="endDate"/> bound an inclusive local-date window.
        /// </summary>
        [HttpGet("daily")]
        [ProducesResponseType(typeof(IReadOnlyList<DailySummaryDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<IReadOnlyList<DailySummaryDto>>> GetDaily(
            [FromQuery] DateOnly? startDate,
            [FromQuery] DateOnly? endDate,
            CancellationToken ct)
        {
            var userId = User.GetUserId();
            return Ok(await _analytics.GetDailySummariesAsync(userId, startDate, endDate, ct));
        }

        /// <summary>Per-subscription stats card for every active <c>UserHabit</c> the caller owns.</summary>
        [HttpGet("habits")]
        [ProducesResponseType(typeof(IReadOnlyList<HabitStatsDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<IReadOnlyList<HabitStatsDto>>> GetHabits(CancellationToken ct)
        {
            var userId = User.GetUserId();
            return Ok(await _analytics.GetHabitStatsAsync(userId, ct));
        }

        /// <summary>Category-balance breakdown (radar chart input).</summary>
        [HttpGet("categories")]
        [ProducesResponseType(typeof(IReadOnlyList<CategoryBalanceDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<IReadOnlyList<CategoryBalanceDto>>> GetCategories(CancellationToken ct)
        {
            var userId = User.GetUserId();
            return Ok(await _analytics.GetCategoryBalanceAsync(userId, ct));
        }

        /// <summary>Habit ↔ PAD Pearson correlations (A10).</summary>
        [HttpGet("correlations")]
        [ProducesResponseType(typeof(IReadOnlyList<CorrelationDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<IReadOnlyList<CorrelationDto>>> GetCorrelations(CancellationToken ct)
        {
            var userId = User.GetUserId();
            return Ok(await _analytics.GetCorrelationsAsync(userId, ct));
        }
    }
}
