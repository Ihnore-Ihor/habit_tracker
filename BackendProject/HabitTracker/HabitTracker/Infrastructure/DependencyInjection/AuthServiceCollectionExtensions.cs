using System.Text;
using HabitTracker.Application.Services.Affect;
using HabitTracker.Application.Services.Analytics;
using HabitTracker.Application.Services.Auth;
using HabitTracker.Application.Services.Awards;
using HabitTracker.Application.Services.Catalog;
using HabitTracker.Application.Services.Sleep;
using HabitTracker.Application.Services.UserHabits;
using HabitTracker.Infrastructure.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace HabitTracker.Infrastructure.DependencyInjection
{
    /// <summary>
    /// DI wiring for Phase 1 (Auth + Catalog). Mirrors the structure of
    /// <see cref="GamificationServiceCollectionExtensions"/> so all cross-cutting
    /// composition lives next to its peers.
    /// </summary>
    public static class AuthServiceCollectionExtensions
    {
        /// <summary>
        /// Registers <see cref="IAuthService"/>, <see cref="ITokenProvider"/>, the bound
        /// <see cref="JwtSettings"/>, and configures JwtBearer authentication. Authorization
        /// uses role claims emitted by <see cref="TokenProvider"/>; no custom policies needed.
        /// </summary>
        public static IServiceCollection AddAuth(
            this IServiceCollection services,
            IConfiguration configuration)
        {
            var jwtSection = configuration.GetSection(JwtSettings.SectionName);
            services.Configure<JwtSettings>(jwtSection);

            var jwt = jwtSection.Get<JwtSettings>()
                ?? throw new InvalidOperationException(
                    $"Configuration section '{JwtSettings.SectionName}' is missing — see appsettings.json.");

            if (string.IsNullOrWhiteSpace(jwt.Secret) || Encoding.UTF8.GetByteCount(jwt.Secret) < 32)
                throw new InvalidOperationException(
                    "Jwt:Secret must be configured with at least 32 bytes (256 bits) of entropy.");

            services.AddSingleton<ITokenProvider, TokenProvider>();
            services.AddScoped<IAuthService, AuthService>();

            services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme    = JwtBearerDefaults.AuthenticationScheme;
            })
            .AddJwtBearer(options =>
            {
                options.RequireHttpsMetadata = false; // Dev: HTTPS redirect already on; relax for token introspection.
                options.SaveToken = true;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer           = true,
                    ValidateAudience         = true,
                    ValidateLifetime         = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer              = jwt.Issuer,
                    ValidAudience            = jwt.Audience,
                    IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Secret)),
                    ClockSkew                = TimeSpan.FromSeconds(30),
                    RoleClaimType            = System.Security.Claims.ClaimTypes.Role,
                    NameClaimType            = System.Security.Claims.ClaimTypes.NameIdentifier
                };
            });

            services.AddAuthorization();
            return services;
        }

        /// <summary>Registers <see cref="ICatalogService"/>.</summary>
        public static IServiceCollection AddCatalog(this IServiceCollection services)
        {
            services.AddScoped<ICatalogService, CatalogService>();
            return services;
        }

        /// <summary>Registers Phase 2 user-facing services (UserHabit, Sleep, Affect).</summary>
        public static IServiceCollection AddUserOperations(this IServiceCollection services)
        {
            services.AddScoped<IUserHabitService, UserHabitService>();
            services.AddScoped<ISleepRecommendationService, SleepRecommendationService>();
            services.AddScoped<ISleepTrackingService, SleepTrackingService>();
            services.AddScoped<IAffectTrackingService, AffectTrackingService>();
            return services;
        }

        /// <summary>Registers the Phase 3 read-only analytics service (mini-CQRS over the SQL views).</summary>
        public static IServiceCollection AddAnalytics(this IServiceCollection services)
        {
            services.AddScoped<IAnalyticsService, AnalyticsService>();
            return services;
        }

        /// <summary>Registers <see cref="IAwardsService"/> (achievement catalog + per-user progress + rarity).</summary>
        public static IServiceCollection AddAwards(this IServiceCollection services)
        {
            services.AddScoped<IAwardsService, AwardsService>();
            return services;
        }
    }
}