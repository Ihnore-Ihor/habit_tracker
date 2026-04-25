using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using HabitTracker.Domain.Entities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace HabitTracker.Infrastructure.Authentication
{
    /// <summary>
    /// HMAC-SHA256 JWT issuer. Token contents:
    /// <list type="bullet">
    ///   <item><c>sub</c> / <see cref="ClaimTypes.NameIdentifier"/> — User.Id (Guid).</item>
    ///   <item><c>email</c> / <see cref="ClaimTypes.Email"/> — User.Email.</item>
    ///   <item><c>nickname</c> — User.Nickname (display only).</item>
    ///   <item><see cref="ClaimTypes.Role"/> — Role.Name, drives [Authorize(Roles = "...")].</item>
    ///   <item><c>jti</c> — fresh GUID per token for future revocation lists.</item>
    /// </list>
    /// </summary>
    public sealed class TokenProvider : ITokenProvider
    {
        private readonly JwtSettings _settings;
        private readonly SigningCredentials _signingCredentials;

        public TokenProvider(IOptions<JwtSettings> options)
        {
            _settings = options.Value;

            if (string.IsNullOrWhiteSpace(_settings.Secret) || Encoding.UTF8.GetByteCount(_settings.Secret) < 32)
                throw new InvalidOperationException(
                    "Jwt:Secret must be configured and contain at least 32 bytes (256 bits) for HMAC-SHA256.");

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.Secret));
            _signingCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        }

        public TokenIssueResult Issue(User user)
        {
            if (user.Role is null)
                throw new InvalidOperationException(
                    $"User {user.Id} was passed to TokenProvider without its Role navigation loaded.");

            var now = DateTime.UtcNow;
            var expires = now.AddMinutes(_settings.ExpiryInMinutes);

            var claims = new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new(JwtRegisteredClaimNames.Email, user.Email),
                new(ClaimTypes.Email, user.Email),
                new("nickname", user.Nickname),
                new(ClaimTypes.Role, user.Role.Name),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            var token = new JwtSecurityToken(
                issuer: _settings.Issuer,
                audience: _settings.Audience,
                claims: claims,
                notBefore: now,
                expires: expires,
                signingCredentials: _signingCredentials);

            var encoded = new JwtSecurityTokenHandler().WriteToken(token);
            return new TokenIssueResult(encoded, expires);
        }
    }
}