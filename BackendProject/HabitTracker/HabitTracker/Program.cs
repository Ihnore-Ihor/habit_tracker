using HabitTracker.Application.Services;
using HabitTracker.Data;
using HabitTracker.Infrastructure.DependencyInjection;
using HabitTracker.Models;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace HabitTracker
{
    public class Program
    {
        public static void Main(string[] args)
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
            builder.Services.AddOpenApi();
            builder.Services.AddScoped<IHabitExecutionService, HabitExecutionService>();
            builder.Services.AddGamification(builder.Configuration);
            builder.Services.AddScoped<ISleepTrackingService, SleepTrackingService>();

            var app = builder.Build();

            if (app.Environment.IsDevelopment())
            {
                app.MapOpenApi();
            }

            app.UseCors("AllowReactApp");

            // Kept on so Mac dev setups see a consistent HTTPS redirect — frontend must follow redirects.
            app.UseHttpsRedirection();

            app.UseAuthorization();
            app.MapControllers();

            app.Run();
        }
    }
}
