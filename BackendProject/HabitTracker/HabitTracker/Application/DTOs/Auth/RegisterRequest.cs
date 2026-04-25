using System.ComponentModel.DataAnnotations;

namespace HabitTracker.Application.DTOs.Auth
{
    /// <summary>
    /// Inbound payload for <c>POST /api/auth/register</c>.
    /// Always provisions a regular User (RoleId = 1); ContentManager / Analyst accounts are
    /// created out-of-band and never via the public API.
    /// </summary>
    public sealed class RegisterRequest
    {
        [Required, MaxLength(100)]
        public string Nickname { get; set; } = string.Empty;

        [Required, EmailAddress, MaxLength(255)]
        public string Email { get; set; } = string.Empty;

        [Required, MinLength(8), MaxLength(128)]
        public string Password { get; set; } = string.Empty;

        [MaxLength(64)]
        public string Timezone { get; set; } = "UTC";
    }
}