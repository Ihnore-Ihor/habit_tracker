
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

            // 1. ОДИН БЛОК CORS
            builder.Services.AddCors(options =>
            {
                options.AddPolicy("AllowReactApp", policy =>
                {
                    policy.WithOrigins("http://localhost:5173")
                          .AllowAnyHeader()
                          .AllowAnyMethod();
                });
            });

            var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
            var dataSourceBuilder = new NpgsqlDataSourceBuilder(connectionString);
            dataSourceBuilder.MapEnum<FrequencyType>();
            dataSourceBuilder.MapEnum<ProposalStatus>();
            var dataSource = dataSourceBuilder.Build();

            builder.Services.AddDbContext<AppDbContext>(options =>
                options.UseNpgsql(dataSource));

            builder.Services.AddControllers();
            builder.Services.AddOpenApi(); // Для .NET 9

            var app = builder.Build();

            // 2. ПРАВИЛЬНИЙ ПОРЯДОК MIDDLEWARE
            if (app.Environment.IsDevelopment())
            {
                app.MapOpenApi();
            }

            // CORS МАЄ БУТИ ПЕРШИМ, щоб перехоплювати запити до редіректів
            app.UseCors("AllowReactApp");

            // Тимчасово закоментуйте це, якщо будуть проблеми з HTTPS на Mac
            app.UseHttpsRedirection();

            app.UseAuthorization();
            app.MapControllers();

            app.Run();
        }
    }
}
