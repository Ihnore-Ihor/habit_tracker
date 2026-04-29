using System.IO;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HabitTracker.Migrations
{
    /// <summary>
    /// Introduces dynamic, on-the-fly streak calculation for both Yang (positive)
    /// and Yin (negative) habits so that the Dashboard always shows correct values
    /// regardless of whether the nightly <c>sp_daily_streak_maintenance</c> has run.
    ///
    /// Changes applied:
    ///   07_StreakFunctions.sql       — fn_calc_current_streak + fn_calc_longest_streak
    ///   08_UpdatedHabitStatsView.sql — vw_user_habit_stats uses fn_calc_current_streak
    ///   09_StreakResyncProc.sql      — sp_resync_streaks() back-fills static columns
    /// </summary>
    public partial class StreakResync : Migration
    {
        private static readonly string[] UpScripts =
        {
            "07_StreakFunctions.sql",
            "08_UpdatedHabitStatsView.sql",
            "09_StreakResyncProc.sql",
        };

        private static readonly string[] DownScripts =
        {
            "Down_09_StreakResyncProc.sql",
            "Down_08_UpdatedHabitStatsView.sql",
            "Down_07_StreakFunctions.sql",
        };

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
            => ExecuteScripts(migrationBuilder, UpScripts);

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
            => ExecuteScripts(migrationBuilder, DownScripts);

        private static void ExecuteScripts(MigrationBuilder migrationBuilder, string[] scripts)
        {
            var scriptDir = Path.Combine(AppContext.BaseDirectory, "Data", "SqlScripts");

            foreach (var script in scripts)
            {
                var path = Path.Combine(scriptDir, script);
                if (!File.Exists(path))
                    throw new FileNotFoundException(
                        $"Required SQL script '{script}' was not found at '{path}'.", path);

                migrationBuilder.Sql(File.ReadAllText(path));
            }
        }
    }
}
