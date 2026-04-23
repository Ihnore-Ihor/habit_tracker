# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ASP.NET Core 9 Web API (`HabitTracker`) — the backend for a habit tracking app. The React frontend lives in a sibling directory (`../../FrontendProject`) and is expected at `http://localhost:5173` (see the CORS policy in `HabitTracker/Program.cs`). Data layer is PostgreSQL via `Npgsql.EntityFrameworkCore.PostgreSQL`.

This directory (`BackendProject/HabitTracker/`) holds the solution file `HabitTracker.sln`; the actual project lives one level deeper at `HabitTracker/HabitTracker.csproj`.

## Common commands

Run all `dotnet` commands from the `HabitTracker/` subdirectory (where `HabitTracker.csproj` lives), unless noted.

- `dotnet restore` — restore NuGet packages
- `dotnet build` — build the Web API
- `dotnet run` — run the API (Development profile binds to `http://localhost:5259` and `https://localhost:7152`; see `Properties/launchSettings.json`)
- `dotnet ef migrations add <Name>` — create a new EF Core migration (needs the `dotnet-ef` tool installed globally)
- `dotnet ef database update` — apply migrations to the database configured by `ConnectionStrings:DefaultConnection`
- `dotnet ef migrations remove` — drop the last un-applied migration

PostgreSQL is expected to be reachable at `localhost:5432` with DB `habit_tracker_db`, user `user`, password `password` (matches `appsettings.json`). A `docker-compose.yml` at the repo root (`../../docker-compose.yml`) spins up a matching Postgres 15 container — run `docker compose up -d` from the repo root to start it.

There is no test project yet.

## Architecture notes

**PostgreSQL enums are wired in two places and both must stay in sync.** The DB uses native Postgres enum types (`frequency_type`, `proposal_status`) rather than integer columns. Adding a new enum requires:
1. Declaring the C# enum in `Models/Enums.cs`.
2. Calling `dataSourceBuilder.MapEnum<YourEnum>()` in `Program.cs` on the shared `NpgsqlDataSource` **before** the DbContext is registered — the DbContext is built against the data source, not a raw connection string, so the mapping has to be in place first.
3. Calling `modelBuilder.HasPostgresEnum<YourEnum>()` in `AppDbContext.OnModelCreating`.
4. Generating a migration — EF will emit `Npgsql:Enum:<name>` annotations on `AlterDatabase()` (see `Migrations/20260227211001_InitialSetup.cs` for the pattern).

**Trigger-maintained columns.** `User.UpdatedAt` is updated by a Postgres trigger (`trg_users_updated_at`) created via raw SQL inside the initial migration, not by EF. Do not try to set it from application code on update; new migrations that recreate the Users table must re-establish the trigger or it will be lost.

**Cached streak fields.** `User.CurrentGoodStreak` / `LongestGoodStreak` are described in the model comments as "updated by a trigger" — that trigger does not yet exist in the current migration. Treat these as write-from-application until a streak trigger is added.

**DbContext registration.** `AppDbContext` is in the root namespace (no `HabitTracker.Data` namespace declaration despite living under `Data/`). Keep that in mind when adding usings.

**Unregistered model.** `Models/HabitExample.cs` exists but is not exposed as a `DbSet` on `AppDbContext` and has no migration — looks like a scratch/demo class rather than part of the schema.

**Controllers.** Only `TestController` (GET `/test`) exists today — real feature controllers have not been written yet. Source comments are largely in Ukrainian.

**HTTPS redirection is on** (`app.UseHttpsRedirection()` in `Program.cs`); frontend calls hitting the plain-HTTP port will be redirected, which can surface as CORS failures if the frontend doesn't follow redirects. The inline Ukrainian comment flags this as intentional for Mac dev setups.