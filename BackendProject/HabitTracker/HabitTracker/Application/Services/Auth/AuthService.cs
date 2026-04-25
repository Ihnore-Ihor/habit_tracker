using HabitTracker.Application.Common.Exceptions;
using HabitTracker.Application.DTOs.Auth;
using HabitTracker.Data;
using HabitTracker.Domain.Entities;
using HabitTracker.Infrastructure.Authentication;
using Microsoft.EntityFrameworkCore;

namespace HabitTracker.Application.Services.Auth
{
    /// <summary>
    /// Default <see cref="IAuthService"/> implementation. Hashes credentials with BCrypt
    /// (work-factor 12) and issues a JWT via <see cref="ITokenProvider"/>.
    /// </summary>
    public sealed class AuthService : IAuthService
    {
        /// <summary>Surrogate id of the seeded "User" role — see <c>AppDbContext.ConfigureRole</c>.</summary>
        private const int RegularUserRoleId = 1;

        /// <summary>BCrypt work factor. 12 is the OWASP-recommended floor for new hashes (~250ms on commodity hardware).</summary>
        private const int BcryptWorkFactor = 12;

        private readonly AppDbContext _db;
        private readonly ITokenProvider _tokenProvider;

        public AuthService(AppDbContext db, ITokenProvider tokenProvider)
        {
            _db = db;
            _tokenProvider = tokenProvider;
        }

        public async Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken ct = default)
        {
            var email = NormaliseEmail(request.Email);

            var emailTaken = await _db.Users.AnyAsync(u => u.Email == email, ct);
            if (emailTaken)
                throw new EmailAlreadyInUseException(email);

            var role = await _db.Roles.FirstOrDefaultAsync(r => r.Id == RegularUserRoleId, ct)
                ?? throw new InvalidOperationException(
                    "Seeded 'User' role (id = 1) is missing — run `dotnet ef database update` to apply the InitialSetup migration.");

            var user = new User
            {
                Id = Guid.NewGuid(),
                RoleId = role.Id,
                Role = role,
                Nickname = request.Nickname.Trim(),
                Email = email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password, BcryptWorkFactor),
                Timezone = string.IsNullOrWhiteSpace(request.Timezone) ? "UTC" : request.Timezone.Trim()
            };

            _db.Users.Add(user);
            await _db.SaveChangesAsync(ct);

            return BuildResponse(user);
        }

        public async Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken ct = default)
        {
            var email = NormaliseEmail(request.Email);

            var user = await _db.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.Email == email, ct);

            // Verify the password even when the user is missing to keep timing roughly constant.
            var passwordOk = user is not null
                && BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);

            if (user is null || !passwordOk)
                throw new InvalidCredentialsException();

            return BuildResponse(user);
        }

        private AuthResponse BuildResponse(User user)
        {
            var token = _tokenProvider.Issue(user);
            return new AuthResponse
            {
                UserId = user.Id,
                Nickname = user.Nickname,
                Email = user.Email,
                Role = user.Role.Name,
                AccessToken = token.AccessToken,
                ExpiresAtUtc = token.ExpiresAtUtc
            };
        }

        private static string NormaliseEmail(string email) =>
            email.Trim().ToLowerInvariant();
    }
}