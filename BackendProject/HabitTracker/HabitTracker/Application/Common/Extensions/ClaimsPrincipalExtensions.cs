using System.Security.Claims;

namespace HabitTracker.Application.Common.Extensions
{
    /// <summary>
    /// Helpers for pulling identity data out of <see cref="ClaimsPrincipal"/>.
    /// All Phase-2 controllers extract the owning user id this way — request bodies never
    /// carry <c>UserId</c>, so a compromised client can't act on another account.
    /// </summary>
    public static class ClaimsPrincipalExtensions
    {
        /// <summary>
        /// Reads <see cref="ClaimTypes.NameIdentifier"/> (the <c>sub</c>/<c>nameid</c> claim emitted
        /// by <c>TokenProvider</c>) and parses it as a <see cref="Guid"/>.
        /// Throws <see cref="UnauthorizedAccessException"/> when the claim is missing or malformed —
        /// which can only happen if a controller forgets <c>[Authorize]</c>.
        /// </summary>
        public static Guid GetUserId(this ClaimsPrincipal principal)
        {
            var raw = principal.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(raw) || !Guid.TryParse(raw, out var userId))
                throw new UnauthorizedAccessException("Authenticated principal is missing a valid user id claim.");

            return userId;
        }
    }
}
