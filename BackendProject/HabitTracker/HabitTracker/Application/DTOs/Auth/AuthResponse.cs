namespace HabitTracker.Application.DTOs.Auth
{
    /// <summary>
    /// Outbound payload returned by both <c>register</c> and <c>login</c>.
    /// The PasswordHash is never echoed back; identity is conveyed entirely via the bearer token.
    /// </summary>
    public sealed class AuthResponse
    {
        public Guid UserId { get; init; }
        public string Nickname { get; init; } = string.Empty;
        public string Email { get; init; } = string.Empty;
        public string Role { get; init; } = string.Empty;
        public string AccessToken { get; init; } = string.Empty;
        public DateTime ExpiresAtUtc { get; init; }
    }
}