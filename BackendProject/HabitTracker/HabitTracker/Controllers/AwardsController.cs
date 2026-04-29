using HabitTracker.Application.Common.Extensions;
using HabitTracker.Application.DTOs.Awards;
using HabitTracker.Application.Services.Awards;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HabitTracker.Controllers
{
    /// <summary>
    /// Returns the full achievement catalog enriched with personal progress and global rarity.
    /// All entries are returned, including ones the caller has never started (progress = 0).
    /// </summary>
    [ApiController]
    [Route("api/awards")]
    [Authorize]
    public sealed class AwardsController : ControllerBase
    {
        private readonly IAwardsService _awardsService;

        public AwardsController(IAwardsService awardsService)
        {
            _awardsService = awardsService;
        }

        [HttpGet]
        [ProducesResponseType(typeof(IReadOnlyList<AwardDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<IReadOnlyList<AwardDto>>> GetAwards(CancellationToken ct)
        {
            var userId = User.GetUserId();
            var awards = await _awardsService.GetAwardsForUserAsync(userId, ct);
            return Ok(awards);
        }
    }
}
