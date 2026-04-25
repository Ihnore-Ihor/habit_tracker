# Harmony — Habit Tracker & Gamification API

ASP.NET Core 9 backend for **Harmony**, a habit-tracking and well-being platform that pairs daily habit logging with sleep tracking, PAD (Pleasure–Arousal–Dominance) affect readings, and a gamification engine that unlocks achievements based on user behaviour. The frontend is a React SPA (sibling repo,
served on `http://localhost:5173`).
   
---                                                                                                                                                                                                                                                                                                              

## Architecture Highlights

The codebase is organised along **Clean Architecture** boundaries and leans on a few high-impact patterns:

- **Layered Clean Architecture** — `Domain` (entities, value objects, domain events) at the core; `Application` (services, DTOs, abstractions) above it; `Infrastructure` (outbox, JWT, DI extensions) and `Data` (DbContext, migrations, raw SQL scripts) at the edges; `Controllers` as the thinnest possible
  presentation layer.
- **Transactional Outbox Pattern** — every state-changing user operation (`HabitExecution`, `SleepLog`, `AffectEntry`) writes its row **and** the corresponding domain event in a single `SaveChangesAsync`. A `BackgroundService` (`OutboxDispatcherService`) drains the outbox table and fans events out,
  eliminating the dual-write inconsistency window between the database and the gamification engine.
- **Domain Events** (`IDomainEvent`) — `HabitExecutedEvent`, `SleepLoggedEvent`, `AffectEntryRecordedEvent`, `StreakMaintenanceCompletedEvent`. Carry only the data each evaluator needs; never reach into entities.
- **Strategy Pattern for Gamification** — 13 `IAchievementEvaluator` implementations, one per `ConditionKey` (`POSITIVE_STREAK`, `TOTAL_METRIC_VOLUME`, `SYNERGY_COMBO`, `CONSISTENT_BEDTIME_STREAK`, etc.). The `GamificationService` builds a routing dictionary from DI and dispatches each event to the
  matching strategies — adding a new achievement type is one new class plus one DI registration.
- **Mini-CQRS for Analytics** — heavy aggregates live in PostgreSQL **virtual views** (`vw_user_daily_summary`, `vw_user_habit_stats`, `vw_user_category_balance`, `vw_user_correlations`) and a **materialized view** (`mvw_global_habit_stats`). The `AnalyticsService` projects view rows into DTOs via
  `DbContext.Database.SqlQueryRaw<T>()` with PascalCase column aliases, bypassing the entity model entirely for read performance.
- **Raw SQL Migrations for DB-Native Constructs** — triggers (`trg_users_updated_at`, `trg_on_habit_execution`, `trg_soft_delete`), the `fn_calculate_daily_affect_centroid` PL/pgSQL function (Trapezoidal AUC + Peak-End algorithm), a GiST `EXCLUDE` constraint (`no_overlapping_sleep`), and a stored
  procedure for streak maintenance. Each lives as a versioned `.sql` script under `Data/SqlScripts/` and is applied alongside the EF migrations.
- **PostgreSQL-Native Enums** — `frequency_type`, `proposal_status`, `condition_key` are real Postgres enum types (mapped via `NpgsqlDataSourceBuilder.MapEnum<T>()`), not `int` columns — `WHERE condition_key = 'POSITIVE_STREAK'` reads naturally in psql.
- **Soft Delete by Convention** — `Category`, `Habit`, `Achievement`, and `UserHabit` flip an `IsArchived` flag instead of physically deleting, keeping `HabitExecution` history and analytics views referentially intact forever.
- **JWT Bearer Authentication with Role Claims** — `TokenProvider` issues HS256 tokens carrying `sub`, `email`, `nickname`, and `role`. Catalog write endpoints are gated by `[Authorize(Roles = "ContentManager")]`; user-facing endpoints extract `UserId` from `ClaimTypes.NameIdentifier` so the request body
  never carries it.

  ---

## Tech Stack

| Layer            | Technology                                             |
  | ---------------- | ------------------------------------------------------ |
| Runtime          | .NET 9 / ASP.NET Core 9                                |
| ORM              | EF Core 9                                              |
| Database         | PostgreSQL 15 (native enums, JSONB, GIN, GiST, MVs)    |
| Postgres driver  | `Npgsql.EntityFrameworkCore.PostgreSQL` 9.0.3          |
| Authentication   | JWT (HS256) via `Microsoft.AspNetCore.Authentication.JwtBearer` 9.0.2 |
| Password hashing | `BCrypt.Net-Next` 4.0.3 (work factor 12)               |
| API docs         | OpenAPI / Swashbuckle                                  |
| Container        | Docker Compose (PostgreSQL service)                    |

  ---

## Project Layout

  ```
  BackendProject/HabitTracker/
  ├── HabitTracker.sln
  └── HabitTracker/
      ├── Domain/
      │   ├── Entities/         # 13 entities (User, Role, Category, Habit, ...)
      │   ├── ValueObjects/     # ScheduleRule, SleepPlan
      │   └── Events/           # IDomainEvent + concrete events
      ├── Application/
      │   ├── Abstractions/     # IOutboxWriter
      │   ├── Common/           # AppExceptions, ClaimsPrincipal extensions
      │   ├── DTOs/             # Auth, Catalog, UserHabits, Sleep, Affect, Analytics
      │   ├── Services/         # Auth, Catalog, UserHabits, Sleep, Affect, Analytics
      │   └── Gamification/     # IGamificationService + 13 evaluators
      ├── Infrastructure/
      │   ├── Authentication/   # JwtSettings, ITokenProvider, TokenProvider
      │   ├── Outbox/           # OutboxMessage, Writer, DispatcherService, Registry
      │   └── DependencyInjection/
      ├── Data/
      │   ├── AppDbContext.cs
      │   └── SqlScripts/       # 01_Extensions … 06_StoredProcedures + Down_*
      ├── Migrations/
      ├── Controllers/          # Auth, Catalog, UserHabit, Sleep, Affect, Analytics
      └── Program.cs
  ```

  ---

## Getting Started

### Prerequisites

- .NET 9 SDK
- Docker (or a local PostgreSQL 15 instance)
- `dotnet-ef` global tool: `dotnet tool install --global dotnet-ef`

### 1. Start PostgreSQL

A `docker-compose.yml` at the repo root provisions a Postgres 15 container that matches the connection string in `appsettings.json`.

  ```bash
  # from the repo root
  docker compose up -d
  ```

This exposes Postgres on `localhost:5432` with database `habit_tracker_db`, user `user`, password `password`.

### 2. Configure the JWT Secret

The `Jwt:Secret` in `appsettings.json` is a placeholder — replace it with a real ≥ 32-byte value. For local development, use `user-secrets` so the secret never ends up in source control:

  ```bash
  cd BackendProject/HabitTracker/HabitTracker
  dotnet user-secrets init
  dotnet user-secrets set "Jwt:Secret" "$(openssl rand -base64 48)"
  ```

### 3. Restore, Build, Migrate

  ```bash
  # from BackendProject/HabitTracker/HabitTracker
  dotnet restore
  dotnet build
  dotnet ef database update
  ```

`database update` applies the EF migrations **and** runs the raw-SQL scripts under `Data/SqlScripts/` (extensions, indexes, functions, triggers, views, materialized views, stored procedures).

### 4. Run the API

  ```bash
  dotnet run
  ```

The development profile binds to:

- `http://localhost:5259`
- `https://localhost:7152`

OpenAPI is available at `/openapi/v1.json` in the Development environment.

### Useful EF Commands

  ```bash
  dotnet ef migrations add <Name>     # create a new migration
  dotnet ef migrations remove         # drop the last un-applied migration
  dotnet ef database update           # apply pending migrations
  dotnet ef database update <Name>    # roll forward/back to a specific migration
  ```

  ---

## API Structure

All endpoints are prefixed with `/api`. Anonymous access is restricted to the two auth endpoints; everything else requires a `Authorization: Bearer <token>` header.

### Authentication — `api/auth` (`AuthController`)

| Method | Route               | Auth     | Purpose                                    |
  | ------ | ------------------- | -------- | ------------------------------------------ |
| POST   | `/api/auth/register`| Anonymous| Create a regular user (RoleId = 1) and issue a JWT |
| POST   | `/api/auth/login`   | Anonymous| Validate credentials and issue a JWT       |

### Catalog — `api/catalog` (`CatalogController`)

Reads require any authenticated user. Writes require `ContentManager` role.

| Method | Route                              | Role            |
  | ------ | ---------------------------------- | --------------- |
| GET    | `/api/catalog/categories`          | Authenticated   |
| GET    | `/api/catalog/categories/{id}`     | Authenticated   |
| POST   | `/api/catalog/categories`          | ContentManager  |
| PUT    | `/api/catalog/categories/{id}`     | ContentManager  |
| DELETE | `/api/catalog/categories/{id}`     | ContentManager  |
| GET    | `/api/catalog/habits`              | Authenticated   |
| GET    | `/api/catalog/habits/{id}`         | Authenticated   |
| POST   | `/api/catalog/habits`              | ContentManager  |
| PUT    | `/api/catalog/habits/{id}`         | ContentManager  |
| DELETE | `/api/catalog/habits/{id}`         | ContentManager  |
| GET    | `/api/catalog/achievements`        | Authenticated   |
| GET    | `/api/catalog/achievements/{id}`   | Authenticated   |
| POST   | `/api/catalog/achievements`        | ContentManager  |
| PUT    | `/api/catalog/achievements/{id}`   | ContentManager  |
| DELETE | `/api/catalog/achievements/{id}`   | ContentManager  |

### User Habits — `api/user-habits` (`UserHabitController`)

| Method | Route                                              | Purpose                                  |
  | ------ | -------------------------------------------------- | ---------------------------------------- |
| GET    | `/api/user-habits`                                 | Caller's active subscriptions            |
| POST   | `/api/user-habits`                                 | Subscribe to a catalog or custom habit   |
| POST   | `/api/user-habits/{userHabitId}/executions`        | Log an execution (Outbox + transaction)  |
| GET    | `/api/user-habits/executions/recent?take=50`       | Recent executions across subscriptions   |

### Sleep — `api/sleep` (`SleepController`)

| Method | Route                          | Purpose                                              |
  | ------ | ------------------------------ | ---------------------------------------------------- |
| POST   | `/api/sleep/logs`              | Log a sleep interval (Outbox + transaction)          |
| GET    | `/api/sleep/logs?take=30`      | Recent sleep logs                                    |
| GET    | `/api/sleep/profile`           | Caller's `UserSleepProfile` (404 if not set up)      |
| PUT    | `/api/sleep/profile`           | Upsert sleep-algorithm parameters                    |

### Affect — `api/affect` (`AffectController`)

| Method | Route                  | Purpose                                       |
  | ------ | ---------------------- | --------------------------------------------- |
| POST   | `/api/affect`          | Record a PAD reading (Outbox + transaction)   |
| GET    | `/api/affect?take=50`  | Recent PAD entries                            |

### Analytics — `api/analytics` (`AnalyticsController`)

Read-only projections over the SQL views.

| Method | Route                                                 | Source view              |
  | ------ | ----------------------------------------------------- | ------------------------ |
| GET    | `/api/analytics/daily?startDate=&endDate=`            | `vw_user_daily_summary`  |
| GET    | `/api/analytics/habits`                               | `vw_user_habit_stats`    |
| GET    | `/api/analytics/categories`                           | `vw_user_category_balance` |
| GET    | `/api/analytics/correlations`                         | `vw_user_correlations`   |

  ---

## Quick Smoke Test

  ```bash
  # 1. Register
  curl -X POST http://localhost:5259/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{"nickname":"alice","email":"alice@example.com","password":"hunter2hunter2","timezone":"Europe/Kyiv"}'

  # 2. Login (copy AccessToken from the response)
  TOKEN=$(curl -s -X POST http://localhost:5259/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"alice@example.com","password":"hunter2hunter2"}' \
    | jq -r .accessToken)

  # 3. Subscribe to a habit
  curl -X POST http://localhost:5259/api/user-habits \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"categoryId":1,"customName":"Drink water","frequencyType":0,"scheduleRule":{"timeSlot":4}}'

  # 4. Pull analytics
  curl http://localhost:5259/api/analytics/habits -H "Authorization: Bearer $TOKEN"
  ```

  ---

## Roadmap / Out of Scope

- Refresh-token flow (Phase 1 issues access tokens only).
- Analyst-role workflow (`api/proposals`) for the data-analyst persona.
- Hangfire/cron scheduling for `REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_global_habit_stats`.
- Streak-trigger DDL to keep `User.CurrentGoodStreak` / `LongestGoodStreak` write-from-DB instead of write-from-application.
- Test project (none exists today).

  ---

## License

Internal — not yet released.