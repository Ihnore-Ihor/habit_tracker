using System.IO;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HabitTracker.Migrations
{
    /// <summary>
    /// Fixes the Yin (negative) habit streak calculation so that a day is only
    /// counted as a "failure" when the NET SUM(logged_value) for that local date
    /// is strictly greater than zero.
    ///
    /// The undo mechanism inserts a compensating record with a negative
    /// logged_value (e.g. -1) to cancel an earlier failure (+1). The previous
    /// implementation used MAX(execution_time) on raw rows, so the undo record
    /// itself was picked up as the "last failure" and the streak reset even
    /// though the net sum for that day was 0 (clean).
    ///
    /// Both fn_calc_current_streak and fn_calc_longest_streak are patched via
    /// 10_StreakYinSumFix.sql to aggregate per local day and apply
    /// HAVING SUM(logged_value) > 0 before treating a date as a failure.
    /// </summary>
    public partial class YinStreakSumFix : Migration
    {
        private static readonly string[] UpScripts   = { "10_StreakYinSumFix.sql" };
        private static readonly string[] DownScripts = { "Down_10_StreakYinSumFix.sql" };

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
