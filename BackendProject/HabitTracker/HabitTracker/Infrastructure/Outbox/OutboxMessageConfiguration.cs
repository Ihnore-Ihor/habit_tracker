using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HabitTracker.Infrastructure.Outbox
{
    /// <summary>
    /// Fluent API configuration for <see cref="OutboxMessage"/>.
    /// Applied from <c>AppDbContext.OnModelCreating</c> via <c>ApplyConfiguration</c>.
    /// </summary>
    public sealed class OutboxMessageConfiguration : IEntityTypeConfiguration<OutboxMessage>
    {
        public void Configure(EntityTypeBuilder<OutboxMessage> e)
        {
            e.ToTable("outbox_messages");

            e.HasKey(m => m.Id);

            e.Property(m => m.EventType)
                .IsRequired()
                .HasMaxLength(300);

            // Payload as JSONB — queryable with Postgres JSON operators for diagnostics / poison inspection.
            e.Property(m => m.Payload)
                .IsRequired()
                .HasColumnType("jsonb");

            // NOW() default keeps CreatedAt authoritative on the DB side, independent of producer clocks.
            e.Property(m => m.CreatedAtUtc)
                .HasDefaultValueSql("NOW()")
                .ValueGeneratedOnAdd();

            e.Property(m => m.Attempts)
                .HasDefaultValue(0);

            e.Property(m => m.LastError)
                .HasMaxLength(2000);

            // Partial index on unprocessed rows only. The dispatcher issues
            // "WHERE processed_at_utc IS NULL ORDER BY created_at_utc LIMIT N" on every poll;
            // the partial index stays tiny because processed rows are excluded.
            e.HasIndex(m => m.CreatedAtUtc)
                .HasDatabaseName("idx_outbox_unprocessed_created_at")
                .HasFilter("processed_at_utc IS NULL");
        }
    }
}