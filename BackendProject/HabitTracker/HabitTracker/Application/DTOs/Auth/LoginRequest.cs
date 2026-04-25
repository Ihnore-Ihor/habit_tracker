using System.ComponentModel.DataAnnotations;

namespace HabitTracker.Application.DTOs.Auth
{
    /// <summary>Inbound payload for <c>POST /api/auth/login</c>.</summary>
    public sealed class LoginRequest
    {
        [Required, EmailAddress, MaxLength(255)]
        public string Email { get; set; } = string.Empty;

        [Required, MaxLength(128)]
        public string Password { get; set; } = string.Empty;
    }
}
