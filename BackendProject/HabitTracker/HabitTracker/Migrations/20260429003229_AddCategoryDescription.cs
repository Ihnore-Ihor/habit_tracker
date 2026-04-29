using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HabitTracker.Migrations
{
    /// <inheritdoc />
    public partial class AddCategoryDescription : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "description",
                table: "categories",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "achievement_rarity_views",
                columns: table => new
                {
                    achievement_id = table.Column<int>(type: "integer", nullable: false),
                    unlock_rate_pct = table.Column<decimal>(type: "numeric", nullable: false)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "global_habit_stats_views",
                columns: table => new
                {
                    habit_id = table.Column<int>(type: "integer", nullable: false),
                    title = table.Column<string>(type: "text", nullable: false),
                    subscribers_active = table.Column<long>(type: "bigint", nullable: false),
                    dropoff_rate_pct = table.Column<decimal>(type: "numeric", nullable: false),
                    total_executions = table.Column<decimal>(type: "numeric", nullable: false),
                    avg_executions_per_active_user = table.Column<decimal>(type: "numeric", nullable: false)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "proposal_impact_views",
                columns: table => new
                {
                    proposal_id = table.Column<Guid>(type: "uuid", nullable: false),
                    habit_id = table.Column<int>(type: "integer", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    executions_before = table.Column<decimal>(type: "numeric", nullable: false),
                    executions_after = table.Column<decimal>(type: "numeric", nullable: false),
                    mom_change_pct = table.Column<decimal>(type: "numeric", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "sleep_effectiveness_views",
                columns: table => new
                {
                    cohort = table.Column<string>(type: "text", nullable: false),
                    n_users = table.Column<long>(type: "bigint", nullable: false),
                    mean_p = table.Column<decimal>(type: "numeric", nullable: false),
                    mean_a = table.Column<decimal>(type: "numeric", nullable: false),
                    mean_d = table.Column<decimal>(type: "numeric", nullable: false)
                },
                constraints: table =>
                {
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "achievement_rarity_views");

            migrationBuilder.DropTable(
                name: "global_habit_stats_views");

            migrationBuilder.DropTable(
                name: "proposal_impact_views");

            migrationBuilder.DropTable(
                name: "sleep_effectiveness_views");

            migrationBuilder.DropColumn(
                name: "description",
                table: "categories");
        }
    }
}
