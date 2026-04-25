namespace HabitTracker.Infrastructure.Authentication
{
    /// <summary>
    /// Strongly-typed view of the <c>"Jwt"</c> configuration section.
    /// Bound from <c>appsettings.json</c> in <c>Program.cs</c> via <c>IOptions&lt;JwtSettings&gt;</c>.
    /// </summary>
    public sealed class JwtSettings
    {
        public const string SectionName = "Jwt";

        /// <summary>Logical issuer baked into every token (<c>iss</c> claim).</summary>
        public string Issuer { get; set; } = string.Empty;

        /// <summary>Expected audience for the React SPA (<c>aud</c> claim).</summary>
        public string Audience { get; set; } = string.Empty;

        /// <summary>HMAC-SHA256 signing key. Must be at least 32 bytes (256 bits).</summary>
        public string Secret { get; set; } = string.Empty;

        /// <summary>Token lifetime in minutes. Refresh-token flow is out of scope for Phase 1.</summary>
        public int ExpiryInMinutes { get; set; } = 60;
    }
}