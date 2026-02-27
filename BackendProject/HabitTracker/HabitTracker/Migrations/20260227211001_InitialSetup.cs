using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HabitTracker.Migrations
{
    /// <inheritdoc />
    public partial class InitialSetup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:frequency_type", "daily,weekly,monthly,once")
                .Annotation("Npgsql:Enum:proposal_status", "pending,implemented,rejected");

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RoleId = table.Column<int>(type: "integer", nullable: false),
                    Nickname = table.Column<string>(type: "text", nullable: false),
                    Email = table.Column<string>(type: "text", nullable: false),
                    PasswordHash = table.Column<string>(type: "text", nullable: false),
                    CurrentGoodStreak = table.Column<int>(type: "integer", nullable: false),
                    LongestGoodStreak = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UserHabits",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    HabitId = table.Column<int>(type: "integer", nullable: true),
                    FrequencyType = table.Column<int>(type: "integer", nullable: false),
                    ScheduleRule = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserHabits", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserHabits_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserHabits_UserId",
                table: "UserHabits",
                column: "UserId");

            migrationBuilder.Sql(@"
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.""UpdatedAt"" = now();
            RETURN NEW;
        END;
        $$ language 'plpgsql';

        CREATE TRIGGER trg_users_updated_at
        BEFORE UPDATE ON ""Users""
        FOR EACH ROW
        EXECUTE PROCEDURE update_updated_at_column();
    ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserHabits");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
