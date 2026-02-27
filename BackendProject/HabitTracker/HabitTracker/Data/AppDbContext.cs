using Microsoft.EntityFrameworkCore;
using HabitTracker.Models;
using Npgsql;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    // Реєструємо таблиці
    public DbSet<User> Users { get; set; }
    public DbSet<UserHabit> UserHabits { get; set; }
    // ... інші DbSet

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // 1. Реєструємо Enums для Postgres
        modelBuilder.HasPostgresEnum<FrequencyType>();
        modelBuilder.HasPostgresEnum<ProposalStatus>();

        // 2. Налаштування зв'язків (приклад)
        modelBuilder.Entity<UserHabit>()
            .HasOne<User>()
            .WithMany()
            .HasForeignKey(uh => uh.UserId);

        base.OnModelCreating(modelBuilder);
    }
}