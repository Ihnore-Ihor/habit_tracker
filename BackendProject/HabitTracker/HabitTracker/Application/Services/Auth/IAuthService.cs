using HabitTracker.Application.DTOs.Auth;

namespace HabitTracker.Application.Services.Auth
{
    /// <summary>
    /// User-facing authentication operations. Both methods return a populated <see cref="AuthResponse"/>
    /// so the SPA can persist the bearer token and skip a follow-up <c>GET /me</c> on first paint.
    /// </summary>
    public interface IAuthService
    {
        Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken ct = default);
        Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken ct = default);
    }
}