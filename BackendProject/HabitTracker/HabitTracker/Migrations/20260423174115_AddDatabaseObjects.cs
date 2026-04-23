using System.IO;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HabitTracker.Migrations
{
    /// <summary>
    /// Layers the 18 bespoke PostgreSQL objects (extensions, helper/business functions,
    /// triggers, virtual/materialized views, stored procedures) on top of the EF-managed
    /// schema produced by InitialSetup.
    /// <para>
    /// The SQL is stored as separate, reviewable files under <c>Data/SqlScripts/</c> and
    /// loaded here via <see cref="File.ReadAllText(string)"/>. The CSPROJ copies those
    /// files to the build output so they are available at <c>dotnet ef database update</c> time.
    /// </para>
    /// </summary>
    public partial class AddDatabaseObjects : Migration
    {
        /// <summary>Scripts executed in dependency order during Up().</summary>
        private static readonly string[] UpScripts =
        {
            "01_Extensions_and_Indexes.sql",
            "02_Functions.sql",
            "03_Triggers.sql",
            "04_Views.sql",
            "05_MaterializedViews.sql",
            "06_StoredProcedures.sql",
        };

        /// <summary>Scripts executed in reverse dependency order during Down().</summary>
        private static readonly string[] DownScripts =
        {
            "Down_06_StoredProcedures.sql",
            "Down_05_MaterializedViews.sql",
            "Down_04_Views.sql",
            "Down_03_Triggers.sql",
            "Down_02_Functions.sql",
            "Down_01_Extensions_and_Indexes.sql",
        };

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
            => ExecuteScripts(migrationBuilder, UpScripts);

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
            => ExecuteScripts(migrationBuilder, DownScripts);

        /// <summary>
        /// Loads each named script from the <c>Data/SqlScripts</c> folder relative to the
        /// runtime base directory and forwards its contents to
        /// <see cref="MigrationBuilder.Sql(string, bool)"/>. Fails fast if a script is missing,
        /// so an incomplete deployment cannot silently skip an object.
        /// </summary>
        private static void ExecuteScripts(MigrationBuilder migrationBuilder, string[] scripts)
        {
            var scriptDir = Path.Combine(AppContext.BaseDirectory, "Data", "SqlScripts");

            foreach (var script in scripts)
            {
                var path = Path.Combine(scriptDir, script);
                if (!File.Exists(path))
                {
                    throw new FileNotFoundException(
                        $"Required SQL script '{script}' was not found at '{path}'. " +
                        "Ensure <None Update=\"Data\\SqlScripts\\**\\*.sql\" CopyToOutputDirectory=\"PreserveNewest\" /> " +
                        "is present in HabitTracker.csproj.",
                        path);
                }

                migrationBuilder.Sql(File.ReadAllText(path));
            }
        }
    }
}