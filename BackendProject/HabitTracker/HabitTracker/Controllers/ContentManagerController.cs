using HabitTracker.Application.Common.Exceptions;
using HabitTracker.Application.DTOs.ContentManager;
using HabitTracker.Application.Services.ContentManager;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HabitTracker.Controllers
{
    [ApiController]
    [Route("api/content")]
    [Authorize(Roles = "ContentManager,Admin")]
    public sealed class ContentManagerController : ControllerBase
    {
        private readonly IContentManagerService _content;

        public ContentManagerController(IContentManagerService content)
        {
            _content = content;
        }

        // ── Proposals ──────────────────────────────────────────────────────────────

        [HttpGet("proposals")]
        [ProducesResponseType(typeof(IReadOnlyList<ProposalManagerDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<IReadOnlyList<ProposalManagerDto>>> GetProposals(CancellationToken ct)
        {
            var result = await _content.GetProposalsAsync(ct);
            return Ok(result);
        }

        [HttpPut("proposals/{id:guid}/status")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> UpdateProposalStatus(
            Guid id,
            [FromBody] UpdateProposalStatusRequest request,
            CancellationToken ct)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            try
            {
                await _content.UpdateProposalStatusAsync(id, request.Status, ct);
                return NoContent();
            }
            catch (ValidationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
            catch (NotFoundException ex)
            {
                return NotFound(new { error = ex.Message });
            }
        }

        // ── Categories ─────────────────────────────────────────────────────────────

        [HttpGet("categories")]
        [ProducesResponseType(typeof(IReadOnlyList<CategoryManagerDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<IReadOnlyList<CategoryManagerDto>>> GetCategories(CancellationToken ct)
        {
            var result = await _content.GetCategoriesAsync(ct);
            return Ok(result);
        }

        [HttpPost("categories")]
        [ProducesResponseType(typeof(CategoryManagerDto), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<CategoryManagerDto>> CreateCategory(
            [FromBody] CreateCategoryRequest request,
            CancellationToken ct)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var result = await _content.CreateCategoryAsync(request, ct);
            return CreatedAtAction(nameof(GetCategories), result);
        }

        [HttpPut("categories/{id:int}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> UpdateCategory(
            int id,
            [FromBody] UpdateCategoryRequest request,
            CancellationToken ct)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            try
            {
                await _content.UpdateCategoryAsync(id, request, ct);
                return NoContent();
            }
            catch (NotFoundException ex)
            {
                return NotFound(new { error = ex.Message });
            }
        }

        [HttpDelete("categories/{id:int}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> DeleteCategory(int id, CancellationToken ct)
        {
            try
            {
                await _content.DeleteCategoryAsync(id, ct);
                return NoContent();
            }
            catch (NotFoundException ex)
            {
                return NotFound(new { error = ex.Message });
            }
        }

        // ── Habits ─────────────────────────────────────────────────────────────────

        [HttpGet("habits")]
        [ProducesResponseType(typeof(IReadOnlyList<HabitCatalogDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<IReadOnlyList<HabitCatalogDto>>> GetHabits(CancellationToken ct)
        {
            var result = await _content.GetHabitsAsync(ct);
            return Ok(result);
        }

        [HttpPost("habits")]
        [ProducesResponseType(typeof(HabitCatalogDto), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<HabitCatalogDto>> CreateHabit(
            [FromBody] CreateHabitRequest request,
            CancellationToken ct)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            try
            {
                var result = await _content.CreateHabitAsync(request, ct);
                return CreatedAtAction(nameof(GetHabits), result);
            }
            catch (ValidationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        [HttpPut("habits/{id:int}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> UpdateHabit(
            int id,
            [FromBody] UpdateHabitRequest request,
            CancellationToken ct)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            try
            {
                await _content.UpdateHabitAsync(id, request, ct);
                return NoContent();
            }
            catch (ValidationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
            catch (NotFoundException ex)
            {
                return NotFound(new { error = ex.Message });
            }
        }

        [HttpDelete("habits/{id:int}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> DeleteHabit(int id, CancellationToken ct)
        {
            try
            {
                await _content.DeleteHabitAsync(id, ct);
                return NoContent();
            }
            catch (NotFoundException ex)
            {
                return NotFound(new { error = ex.Message });
            }
        }

        // ── Achievements ───────────────────────────────────────────────────────────

        [HttpGet("achievements")]
        [ProducesResponseType(typeof(IReadOnlyList<AchievementManagerDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<IReadOnlyList<AchievementManagerDto>>> GetAchievements(CancellationToken ct)
        {
            var result = await _content.GetAchievementsAsync(ct);
            return Ok(result);
        }

        [HttpPost("achievements")]
        [ProducesResponseType(typeof(AchievementManagerDto), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<AchievementManagerDto>> CreateAchievement(
            [FromBody] CreateAchievementRequest request,
            CancellationToken ct)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var result = await _content.CreateAchievementAsync(request, ct);
            return CreatedAtAction(nameof(GetAchievements), result);
        }

        [HttpPut("achievements/{id:int}")]
        [ProducesResponseType(typeof(AchievementManagerDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<AchievementManagerDto>> UpdateAchievement(
            int id,
            [FromBody] UpdateAchievementRequest request,
            CancellationToken ct)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            try
            {
                var result = await _content.UpdateAchievementAsync(id, request, ct);
                return Ok(result);
            }
            catch (NotFoundException ex)
            {
                return NotFound(new { error = ex.Message });
            }
        }

        [HttpDelete("achievements/{id:int}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> DeleteAchievement(int id, CancellationToken ct)
        {
            try
            {
                await _content.DeleteAchievementAsync(id, ct);
                return NoContent();
            }
            catch (NotFoundException ex)
            {
                return NotFound(new { error = ex.Message });
            }
        }
    }
}
