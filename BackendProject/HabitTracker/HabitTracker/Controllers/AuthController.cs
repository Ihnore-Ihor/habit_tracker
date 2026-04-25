using HabitTracker.Application.Common.Exceptions;
using HabitTracker.Application.DTOs.Auth;
using HabitTracker.Application.Services.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HabitTracker.Controllers
{
    /// <summary>
    /// Public authentication endpoints. Both routes are <see cref="AllowAnonymousAttribute"/>
    /// because the bearer token they issue is the prerequisite for every other controller.
    /// </summary>
    [ApiController]
    [Route("api/auth")]
    [AllowAnonymous]
    public sealed class AuthController : ControllerBase
    {
        private readonly IAuthService _auth;

        public AuthController(IAuthService auth)
        {
            _auth = auth;
        }

        /// <summary>Creates a new regular User account (RoleId = 1) and returns a JWT.</summary>
        [HttpPost("register")]
        [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status409Conflict)]
        public async Task<ActionResult<AuthResponse>> Register(
            [FromBody] RegisterRequest request,
            CancellationToken ct)
        {
            try
            {
                var response = await _auth.RegisterAsync(request, ct);
                return Ok(response);
            }
            catch (EmailAlreadyInUseException ex)
            {
                return Conflict(new { error = ex.Message });
            }
        }

        /// <summary>Validates email + password and returns a JWT carrying UserId and Role claims.</summary>
        [HttpPost("login")]
        [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<ActionResult<AuthResponse>> Login(
            [FromBody] LoginRequest request,
            CancellationToken ct)
        {
            try
            {
                var response = await _auth.LoginAsync(request, ct);
                return Ok(response);
            }
            catch (InvalidCredentialsException ex)
            {
                return Unauthorized(new { error = ex.Message });
            }
        }
    }
}