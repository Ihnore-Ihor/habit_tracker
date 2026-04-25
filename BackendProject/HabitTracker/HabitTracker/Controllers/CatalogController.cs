using HabitTracker.Application.Common.Exceptions;
using HabitTracker.Application.DTOs.Catalog;
using HabitTracker.Application.Services.Catalog;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HabitTracker.Controllers
{
    /// <summary>
    /// Global catalog endpoints (Categories, Habits, Achievements).
    /// <para>
    /// Reads are open to any authenticated user — the SPA needs them to populate the habit picker
    /// and achievement gallery. Writes are restricted to <c>ContentManager</c> via
    /// <see cref="AuthorizeAttribute.Roles"/>; the role name matches the seed in
    /// <c>AppDbContext.ConfigureRole</c> and the claim emitted by <c>TokenProvider</c>.
    /// </para>
    /// </summary>
    [ApiController]
    [Route("api/catalog")]
    [Authorize]
    public sealed class CatalogController : ControllerBase
    {
        private const string ContentManagerRole = "ContentManager";

        private readonly ICatalogService _catalog;

        public CatalogController(ICatalogService catalog)
        {
            _catalog = catalog;
        }

        // ─────────────────────────── Categories ───────────────────────────

        [HttpGet("categories")]
        [ProducesResponseType(typeof(IReadOnlyList<CategoryDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<IReadOnlyList<CategoryDto>>> GetCategories(CancellationToken ct)
            => Ok(await _catalog.GetCategoriesAsync(ct));

        [HttpGet("categories/{id:int}")]
        [ProducesResponseType(typeof(CategoryDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<CategoryDto>> GetCategory(int id, CancellationToken ct)
        {
            try { return Ok(await _catalog.GetCategoryAsync(id, ct)); }
            catch (NotFoundException ex) { return NotFound(new { error = ex.Message }); }
        }

        [HttpPost("categories")]
        [Authorize(Roles = ContentManagerRole)]
        [ProducesResponseType(typeof(CategoryDto), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<ActionResult<CategoryDto>> CreateCategory(
            [FromBody] CreateCategoryRequest request, CancellationToken ct)
        {
            var created = await _catalog.CreateCategoryAsync(request, ct);
            return CreatedAtAction(nameof(GetCategory), new { id = created.Id }, created);
        }

        [HttpPut("categories/{id:int}")]
        [Authorize(Roles = ContentManagerRole)]
        [ProducesResponseType(typeof(CategoryDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<CategoryDto>> UpdateCategory(
            int id, [FromBody] UpdateCategoryRequest request, CancellationToken ct)
        {
            try { return Ok(await _catalog.UpdateCategoryAsync(id, request, ct)); }
            catch (NotFoundException ex) { return NotFound(new { error = ex.Message }); }
        }

        [HttpDelete("categories/{id:int}")]
        [Authorize(Roles = ContentManagerRole)]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> DeleteCategory(int id, CancellationToken ct)
        {
            try { await _catalog.DeleteCategoryAsync(id, ct); return NoContent(); }
            catch (NotFoundException ex) { return NotFound(new { error = ex.Message }); }
        }

        // ───────────────────────────── Habits ─────────────────────────────

        [HttpGet("habits")]
        [ProducesResponseType(typeof(IReadOnlyList<HabitDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<IReadOnlyList<HabitDto>>> GetHabits(
            [FromQuery] int? categoryId, CancellationToken ct)
            => Ok(await _catalog.GetHabitsAsync(categoryId, ct));

        [HttpGet("habits/{id:int}")]
        [ProducesResponseType(typeof(HabitDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<HabitDto>> GetHabit(int id, CancellationToken ct)
        {
            try { return Ok(await _catalog.GetHabitAsync(id, ct)); }
            catch (NotFoundException ex) { return NotFound(new { error = ex.Message }); }
        }

        [HttpPost("habits")]
        [Authorize(Roles = ContentManagerRole)]
        [ProducesResponseType(typeof(HabitDto), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<HabitDto>> CreateHabit(
            [FromBody] CreateHabitRequest request, CancellationToken ct)
        {
            try
            {
                var created = await _catalog.CreateHabitAsync(request, ct);
                return CreatedAtAction(nameof(GetHabit), new { id = created.Id }, created);
            }
            catch (ValidationException ex) { return BadRequest(new { error = ex.Message }); }
        }

        [HttpPut("habits/{id:int}")]
        [Authorize(Roles = ContentManagerRole)]
        [ProducesResponseType(typeof(HabitDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<HabitDto>> UpdateHabit(
            int id, [FromBody] UpdateHabitRequest request, CancellationToken ct)
        {
            try { return Ok(await _catalog.UpdateHabitAsync(id, request, ct)); }
            catch (NotFoundException ex) { return NotFound(new { error = ex.Message }); }
            catch (ValidationException ex) { return BadRequest(new { error = ex.Message }); }
        }

        [HttpDelete("habits/{id:int}")]
        [Authorize(Roles = ContentManagerRole)]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> DeleteHabit(int id, CancellationToken ct)
        {
            try { await _catalog.DeleteHabitAsync(id, ct); return NoContent(); }
            catch (NotFoundException ex) { return NotFound(new { error = ex.Message }); }
        }

        // ─────────────────────────── Achievements ───────────────────────────

        [HttpGet("achievements")]
        [ProducesResponseType(typeof(IReadOnlyList<AchievementDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<IReadOnlyList<AchievementDto>>> GetAchievements(CancellationToken ct)
            => Ok(await _catalog.GetAchievementsAsync(ct));

        [HttpGet("achievements/{id:int}")]
        [ProducesResponseType(typeof(AchievementDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<AchievementDto>> GetAchievement(int id, CancellationToken ct)
        {
            try { return Ok(await _catalog.GetAchievementAsync(id, ct)); }
            catch (NotFoundException ex) { return NotFound(new { error = ex.Message }); }
        }

        [HttpPost("achievements")]
        [Authorize(Roles = ContentManagerRole)]
        [ProducesResponseType(typeof(AchievementDto), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<AchievementDto>> CreateAchievement(
            [FromBody] CreateAchievementRequest request, CancellationToken ct)
        {
            try
            {
                var created = await _catalog.CreateAchievementAsync(request, ct);
                return CreatedAtAction(nameof(GetAchievement), new { id = created.Id }, created);
            }
            catch (ValidationException ex) { return BadRequest(new { error = ex.Message }); }
        }

        [HttpPut("achievements/{id:int}")]
        [Authorize(Roles = ContentManagerRole)]
        [ProducesResponseType(typeof(AchievementDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<AchievementDto>> UpdateAchievement(
            int id, [FromBody] UpdateAchievementRequest request, CancellationToken ct)
        {
            try { return Ok(await _catalog.UpdateAchievementAsync(id, request, ct)); }
            catch (NotFoundException ex) { return NotFound(new { error = ex.Message }); }
            catch (ValidationException ex) { return BadRequest(new { error = ex.Message }); }
        }

        [HttpDelete("achievements/{id:int}")]
        [Authorize(Roles = ContentManagerRole)]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> DeleteAchievement(int id, CancellationToken ct)
        {
            try { await _catalog.DeleteAchievementAsync(id, ct); return NoContent(); }
            catch (NotFoundException ex) { return NotFound(new { error = ex.Message }); }
        }
    }
}