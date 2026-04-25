using HabitTracker.Domain.Entities;

namespace HabitTracker.Infrastructure.Authentication
{
    /// <summary>
    /// Issues short-lived bearer tokens for authenticated users.
    /// Implementations must embed at minimum the user id (<c>sub</c>/<c>nameidentifier</c>) and
    /// the role name (<c>role</c>) so [Authorize(Roles = "...")] works without a DB round-trip.
    /// </summary>
    public interface ITokenProvider
    {
        TokenIssueResult Issue(User user);
    }

    /// <param name="AccessToken">Compact JWS string ready to be sent in the Authorization header.</param>
    /// <param name="ExpiresAtUtc">Absolute expiry; the client uses this to schedule re-login.</param>
    public readonly record struct TokenIssueResult(string AccessToken, DateTime ExpiresAtUtc);
}