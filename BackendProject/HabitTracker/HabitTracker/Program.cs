using HabitTracker.Data;
using HabitTracker.Infrastructure.DependencyInjection;
using HabitTracker.Models;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace HabitTracker
{
    public class Program
    {
        public static async Task Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            // CORS for the React dev server.
            builder.Services.AddCors(options =>
            {
                options.AddPolicy("AllowReactApp", policy =>
                {
                    policy.WithOrigins("http://localhost:5173")
                          .AllowAnyHeader()
                          .AllowAnyMethod();
                });
            });

            // Build a shared NpgsqlDataSource with every PostgreSQL enum pre-registered.
            // The DataSource — not the raw connection string — is what AppDbContext binds to.
            var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
            var dataSourceBuilder = new NpgsqlDataSourceBuilder(connectionString);
            dataSourceBuilder.MapEnum<FrequencyType>();
            dataSourceBuilder.MapEnum<ProposalStatus>();
            dataSourceBuilder.MapEnum<ConditionKey>();
            var dataSource = dataSourceBuilder.Build();

            builder.Services.AddDbContext<AppDbContext>(options =>
                options.UseNpgsql(dataSource));

            builder.Services.AddControllers();
            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen(c =>
            {
                c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
                {
                    Description = "JWT Authorization header using the Bearer scheme. Example: \"Authorization: Bearer {token}\"",
                    Name = "Authorization",
                    In = Microsoft.OpenApi.Models.ParameterLocation.Header,
                    Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
                    Scheme = "Bearer"
                });

                c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
                {
                    {
                        new Microsoft.OpenApi.Models.OpenApiSecurityScheme
                        {
                            Reference = new Microsoft.OpenApi.Models.OpenApiReference
                            {
                                Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                                Id = "Bearer"
                            }
                        },
                        Array.Empty<string>()
                    }
                });
            });
            builder.Services.AddOpenApi();
            builder.Services.AddGamification(builder.Configuration);

            // Phase 1 — Security & Catalog.
            builder.Services.AddAuth(builder.Configuration);
            builder.Services.AddCatalog();

            // Phase 2 — User operations (Habits, Sleep, Affect).
            builder.Services.AddUserOperations();

            // Phase 3 — Read-only analytics (CQRS over the SQL views).
            builder.Services.AddAnalytics();

            // Phase 4 — Gamification / Awards (achievement catalog + personal progress + rarity).
            builder.Services.AddAwards();

            var app = builder.Build();

            if (app.Environment.IsDevelopment())
            {
                app.MapOpenApi();
                app.UseSwagger();
                app.UseSwaggerUI();
            }

            app.UseCors("AllowReactApp");

            // Kept on so Mac dev setups see a consistent HTTPS redirect — frontend must follow redirects.
            app.UseHttpsRedirection();

            // Authentication MUST run before Authorization so the role claim is on the principal
            // by the time [Authorize(Roles = "ContentManager")] is evaluated.
            app.UseAuthentication();
            app.UseAuthorization();
            app.MapControllers();

            // --- Database Seeding ---
            using (var scope = app.Services.CreateScope())
            {
                var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                try
                {
                    await DatabaseSeeder.SeedAsync(dbContext);
                }
                catch (Exception ex)
                {
                    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
                    logger.LogError(ex, "An error occurred during database seeding.");
                }
            }
            // -------------------------

            app.Run();
        }
    }
}