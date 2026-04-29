# Harmony — Developer Onboarding & Architecture Guide

> Welcome back to your own codebase! This document is your map. Read it once end-to-end, then keep it open in a side tab whenever you're working. Everything here is grounded in the real files you have today (April 2026), so the file paths and class names are **clickable starting points**, not abstractions.

---

## Table of Contents
1. [High-Level Tech Stack & Architecture](#1-high-level-tech-stack--architecture)
2. [Folder Structure Map — "Where is what?"](#2-folder-structure-map--where-is-what)
3. [Lifecycle of a Request — Step-by-Step Data Flow](#3-lifecycle-of-a-request--step-by-step-data-flow)
4. [Key Design Patterns Used](#4-key-design-patterns-used)
5. ["How To…" Cheat Sheet](#5-how-to-cheat-sheet)
6. [Domain Model & Business Workflows](#6-domain-model--business-workflows)
7. [Database Architecture & Data Integrity](#7-database-architecture--data-integrity)

---

## 1. High-Level Tech Stack & Architecture

### The mental model

Think of Harmony as **two separate apps that talk over HTTP**:

```
┌────────────────────────────┐         HTTPS + JWT          ┌────────────────────────────┐
│   FRONTEND (browser)       │ ────────────────────────────▶│   BACKEND (ASP.NET Core)   │
│   React 19 + Vite          │   Axios calls /api/...       │   .NET 9 Web API           │
│   localhost:5173           │ ◀────────────────────────────│   localhost:7152 (HTTPS)   │
└────────────────────────────┘   JSON responses             └──────────────┬─────────────┘
                                                                           │ EF Core 9
                                                                           ▼
                                                            ┌──────────────────────────┐
                                                            │   PostgreSQL 15 (Docker) │
                                                            │   localhost:5432         │
                                                            │   habit_tracker_db       │
                                                            └──────────────────────────┘
```

The frontend never touches the database directly. It speaks **only** to the API. The API is the only thing with a database connection string. This is the most important boundary in the system — keep it clean.

### Frontend stack (`FrontendProject/`)

| Tech | Version | What it does for you |
|---|---|---|
| **React** | 19.2 | UI rendering (no TypeScript — pure JSX) |
| **Vite** | 7.3 | Dev server + build tool (fast HMR) |
| **React Router** | 7.14 | Client-side page routing |
| **Axios** | 1.15 | HTTP client (with interceptors for JWT + 401 handling) |
| **Tailwind CSS** | 3.4 | Utility-first styling — see custom "Apothecary Diaries" palette in `tailwind.config.js` |
| **Framer Motion** | 12.38 | Animations (`whileTap`, `AnimatePresence`, page-level stagger variants) |
| **Three.js + R3F** | 0.184 / 9.6 | WebGL Yin-Yang in `StreakWidget` |
| **jwt-decode** | 4.0 | Reading user/role claims out of the access token |

### Backend stack (`BackendProject/HabitTracker/`)

| Tech | Version | What it does for you |
|---|---|---|
| **.NET / ASP.NET Core** | 9 | Web API framework |
| **EF Core** | 9 | ORM — turns C# objects into SQL |
| **Npgsql.EntityFrameworkCore.PostgreSQL** | 9.0.3 | Postgres driver for EF Core (native enums, JSONB, arrays) |
| **PostgreSQL** | 15 (Docker) | Database — also runs triggers, views, stored procedures |
| **JwtBearer auth** | 9.0.2 | Validates the `Authorization: Bearer <token>` header |
| **BCrypt.Net-Next** | 4.0.3 | Password hashing (work factor 12) |
| **Swashbuckle / OpenAPI** | — | Auto-generated `/swagger` docs in development |

### How they communicate

1. The browser stores the JWT in `localStorage` under the key `harmony.token`.
2. Every Axios call attaches `Authorization: Bearer <token>` automatically — see `FrontendProject/src/api/client.js` (the request interceptor).
3. ASP.NET Core's `[Authorize]` attribute on each controller validates the token, populates `User.Claims`, and (for `[Authorize(Roles="ContentManager")]`) blocks the call with a 403 if the role doesn't match.
4. If the API returns **401**, the response interceptor in `client.js` clears the token and redirects to `/auth/login`.

---

## 2. Folder Structure Map — "Where is what?"

```
HabitTracker/                          ← Repo root
├── docker-compose.yml                 ← Spins up Postgres 15
├── init-db/                           ← SQL run on first DB boot
│
├── FrontendProject/                   ← React SPA
│   ├── package.json                   ← npm scripts (dev / build / lint)
│   ├── tailwind.config.js             ← Design tokens (rice / ink / jade…)
│   ├── vite.config.js                 ← Build config
│   └── src/
│       ├── main.jsx                   ← React entry point — mounts <App />
│       ├── App.jsx                    ← Root layout + <AppRouter />
│       ├── api/                       ← All HTTP calls live here
│       │   ├── client.js              ← Axios instance + interceptors
│       │   ├── endpoints.js           ← Centralized URL constants
│       │   ├── auth.js / habits.js / sleep.js / affect.js
│       ├── routes/
│       │   ├── AppRouter.jsx          ← Route table (one <Route> per page)
│       │   └── ProtectedRoute.jsx     ← Role-gated wrapper
│       ├── context/
│       │   └── AuthContext.jsx        ← Single source of truth for auth + ROLES
│       ├── hooks/
│       │   └── useAuth.js             ← Re-exports useAuth() from AuthContext
│       ├── pages/                     ← One file per top-level route
│       │   ├── Dashboard.jsx          ← /dashboard (User home)
│       │   ├── ContentManagerView.jsx ← /catalog (CM home)
│       │   ├── AnalystDashboardView.jsx ← /analytics (Analyst home)
│       │   ├── Profile.jsx, BodyMindPage.jsx, StatsPage.jsx, AchievementsPage.jsx
│       │   └── auth/                  ← Login.jsx, Register.jsx
│       ├── components/
│       │   ├── common/                ← Button, Input, ChineseFrame, BottomNav…
│       │   ├── widgets/               ← StreakWidget (WebGL), etc.
│       │   ├── HabitFormDrawer.jsx    ← Add/edit/archive habit (CRUD UI)
│       │   └── HabitCatalogDrawer.jsx
│       ├── styles/
│       │   └── globals.css            ← CSS vars + custom classes (.chinese-frame, .ink-seal…)
│       ├── utils/
│       │   └── jwt.js                 ← decodeToken(), isExpired() — handles MS long-form claims
│       └── assets/                    ← SVG frames, patterns, decorations
│
└── BackendProject/HabitTracker/       ← The .sln lives here
    └── HabitTracker/                  ← The .csproj — run `dotnet` from this folder
        ├── Program.cs                 ← Composition root: DI, middleware, Postgres enums, seeding
        ├── appsettings.json           ← Connection string, JWT secret (override via user-secrets!)
        │
        ├── Controllers/               ← THIN — translate HTTP ↔ service calls only
        │   ├── AuthController.cs            (POST /api/auth/login | /register)
        │   ├── CatalogController.cs         (catalog CRUD, CM-only writes)
        │   ├── UserHabitController.cs       (user subscriptions + executions)
        │   ├── SleepController.cs, AffectController.cs
        │   ├── AnalyticsController.cs       (per-user, read-only over SQL views)
        │   ├── AnalystDashboardController.cs (global stats, Analyst role)
        │   ├── ContentManagerController.cs  (proposal queue, CM role)
        │   └── AwardsController.cs          (achievement progress + rarity)
        │
        ├── Application/               ← Business logic — the "brain"
        │   ├── Abstractions/          ← IOutboxWriter (DI seam)
        │   ├── Common/                ← Exceptions (NotFound/Validation), ClaimsPrincipal extensions
        │   ├── DTOs/                  ← One folder per feature — request/response shapes
        │   ├── Services/              ← One folder per feature — business logic
        │   │   ├── Auth/AuthService.cs              (register, login, hash password, issue JWT)
        │   │   ├── Catalog/CatalogService.cs        (CRUD over Habit/Category/Achievement)
        │   │   ├── UserHabits/UserHabitService.cs   (subscribe, log execution, update, archive)
        │   │   ├── Sleep/, Affect/, Analytics/, Awards/, Analyst/, ContentManager/
        │   └── Gamification/          ← The achievement engine
        │       ├── IGamificationService.cs / GamificationService.cs
        │       ├── IAchievementEvaluator.cs    ← Strategy interface
        │       ├── EvaluationContext.cs        ← Bundle passed to each evaluator
        │       └── Evaluators/                 ← 13 strategies (one per ConditionKey)
        │
        ├── Domain/                    ← Pure C# entities (no EF / no HTTP)
        │   ├── Entities/              ← User, Role, Category, Habit, UserHabit, HabitExecution,
        │   │                            SleepLog, AffectEntry, Achievement, UserAchievement…
        │   ├── ValueObjects/          ← ScheduleRule (JSONB), SleepPlan (nested JSONB)
        │   ├── Events/                ← IDomainEvent + 4 concrete events
        │   └── ReadModels/            ← Keyless C# shapes that mirror SQL views
        │
        ├── Infrastructure/            ← Cross-cutting plumbing
        │   ├── Authentication/        ← JwtSettings, ITokenProvider, TokenProvider
        │   ├── Outbox/                ← Outbox table + writer + dispatcher BackgroundService
        │   └── DependencyInjection/   ← AddAuth(), AddGamification() extension methods
        │
        ├── Data/
        │   ├── AppDbContext.cs        ← EF Core configuration for all entities, indexes, FKs, soft-delete filters
        │   ├── DatabaseSeeder.cs      ← Runs on app startup
        │   └── SqlScripts/            ← Raw SQL applied by migrations
        │       ├── 01_Extensions_and_Indexes.sql
        │       ├── 02_Functions.sql           ← fn_calculate_daily_affect_centroid (PL/pgSQL)
        │       ├── 03_Triggers.sql            ← trg_users_updated_at, streak triggers
        │       ├── 04_Views.sql               ← vw_user_daily_summary, vw_user_habit_stats…
        │       ├── 05_MaterializedViews.sql   ← mvw_global_habit_stats…
        │       ├── 06_StoredProcedures.sql    ← Streak maintenance proc
        │       └── 07_…10_… + matching Down_*.sql (rollback)
        │
        ├── Migrations/                ← EF Core auto-generated — DO NOT edit by hand
        ├── Models/Enums.cs            ← Native PG enum mirrors (FrequencyType, ProposalStatus, ConditionKey)
        └── Properties/launchSettings.json     ← Dev URLs (HTTP 5259, HTTPS 7152)
```

### Quick "Where do I look?" lookup

| If you want to… | Open this |
|---|---|
| Change a button's color | `FrontendProject/src/components/common/Button.jsx` |
| Add a new screen | `FrontendProject/src/pages/` + register in `routes/AppRouter.jsx` |
| Tweak the design palette | `FrontendProject/tailwind.config.js` + `src/styles/globals.css` |
| Find a backend endpoint | `BackendProject/.../Controllers/<Feature>Controller.cs` |
| Change *what* the endpoint does | `Application/Services/<Feature>/<Feature>Service.cs` |
| Change *what* gets stored | `Domain/Entities/` + `Data/AppDbContext.cs` + new migration |
| Add a SQL view / trigger / function | New file in `Data/SqlScripts/` + reference in a migration |

---

## 3. Lifecycle of a Request — Step-by-Step Data Flow

Let's trace one concrete user action end-to-end: **A user taps "Done" on a habit on the Dashboard.**

This creates a `HabitExecution` row, increments their streak, and may unlock an achievement. It exercises almost every layer of the app.

### Step 1 — The user clicks the button (browser)

In `FrontendProject/src/pages/Dashboard.jsx`, the "Done" button calls `handleDone(habit)`, which calls the API helper:

```js
// src/api/habits.js
export const logHabitExecution = (habitId, payload) =>
  api.post(endpoints.habits.executions(habitId), payload).then((r) => r.data);
```

`endpoints.habits.executions(id)` resolves to `'/api/user-habits/<id>/executions'`.

### Step 2 — Axios attaches the JWT and sends the request

In `src/api/client.js`, the **request interceptor** runs:

```js
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);   // 'harmony.token'
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

So the actual outgoing HTTP request is:

```
POST https://localhost:7152/api/user-habits/abc-123/executions
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json

{ "loggedValue": 1 }
```

### Step 3 — ASP.NET Core authenticates the request

In `Program.cs`, this middleware order matters:

```csharp
app.UseAuthentication();   // Reads the Bearer token, validates signature, populates User.Claims
app.UseAuthorization();    // Enforces [Authorize(...)] attributes
app.MapControllers();      // Routes to the matching action method
```

The token has claims like `sub = <UserId GUID>`, `role = "User"`, etc. (issued by `Infrastructure/Authentication/TokenProvider.cs`).

### Step 4 — The controller receives the call

`Controllers/UserHabitController.cs` matches the route:

```csharp
[ApiController]
[Route("api/user-habits")]
[Authorize]                                                // Any authenticated user
public sealed class UserHabitController : ControllerBase
{
    [HttpPost("{userHabitId:guid}/executions")]
    public async Task<ActionResult<HabitExecutionDto>> LogExecution(
        Guid userHabitId,
        [FromBody] LogExecutionRequest request,
        CancellationToken ct)
    {
        var userId = User.GetUserId();                     // Extract from claims (NOT the body!)
        var execution = await _service.LogExecutionAsync(userId, userHabitId, request, ct);
        return StatusCode(201, execution);
    }
}
```

**Why is `userId` read from claims and not the body?** Because if the client sent it, a malicious user could log executions on someone else's habit. Reading from the JWT means the user IS who the token says they are.

The controller's *only* job is HTTP plumbing — extract input, call the service, translate exceptions to status codes.

### Step 5 — The service layer does the work

`Application/Services/UserHabits/UserHabitService.cs`:

```csharp
public async Task<HabitExecutionDto> LogExecutionAsync(...)
{
    // 1. Verify the subscription belongs to this user (defence in depth)
    var subscription = await _db.UserHabits
        .FirstOrDefaultAsync(uh => uh.Id == userHabitId && uh.UserId == userId, ct)
        ?? throw new NotFoundException(nameof(UserHabit), userHabitId);

    // 2. Validate the timestamp (no future, no >30 days back)
    if (executionTime > nowUtc.AddMinutes(5))    throw new ValidationException(...);
    if (nowUtc - executionTime > MaxBackdate)    throw new ValidationException(...);

    // 3. Build the new entity
    var execution = new HabitExecution { ... };
    _db.HabitExecutions.Add(execution);

    // 4. Enqueue a domain event in the SAME transaction
    await _outbox.EnqueueAsync(new HabitExecutedEvent(
        UserId: userId,
        UserHabitId: subscription.Id,
        ExecutionTime: execution.ExecutionTime,
        LoggedValue: execution.LoggedValue
    ), ct);

    // 5. Single SaveChangesAsync — execution row + outbox row commit together or not at all
    await _db.SaveChangesAsync(ct);

    return MapExecution(execution);
}
```

### Step 6 — EF Core builds the SQL and Postgres runs it

`SaveChangesAsync` translates the two `Add(...)` calls into:

```sql
BEGIN;
  INSERT INTO habit_executions (id, user_habit_id, execution_time, logged_value, ...)
    VALUES (...);
  INSERT INTO outbox_messages (id, event_type, payload, created_at_utc, ...)
    VALUES ('HabitExecutedEvent', '{"UserId":"...","LoggedValue":1,...}', NOW(), ...);
COMMIT;
```

Two extra things happen on the database side:
- A **trigger** (`trg_on_habit_execution` from `03_Triggers.sql`) fires and updates the user's cached streak fields.
- The new outbox row is now visible to the background dispatcher.

### Step 7 — The 201 response goes back to the browser

The service returns a `HabitExecutionDto`, the controller wraps it in `201 Created`, and the browser's `then((r) => r.data)` resolves with that object. The Dashboard's `refreshData()` then re-fetches habits + recent executions to repaint the UI.

### Step 8 — Asynchronously: the gamification engine reacts

This is the magic part. **Outside** the original HTTP request, a background service is polling:

`Infrastructure/Outbox/OutboxDispatcherService.cs` (a `BackgroundService` registered as a `HostedService`) wakes up every few seconds, pulls unprocessed rows, and:

1. Looks up the CLR type for `EventType = "HabitExecutedEvent"` via `DomainEventRegistry`.
2. Deserialises the JSON `Payload` into a `HabitExecutedEvent` record.
3. Hands it to `GamificationService.HandleAsync(event, ct)`.

`Application/Gamification/GamificationService.cs` then:

1. Looks up which `ConditionKey`s a `HabitExecutedEvent` could affect (`POSITIVE_STREAK`, `TOTAL_METRIC_VOLUME`, `FIRST_ACTION`, `SYNERGY_COMBO`, `CATEGORY_TOTAL_EXECUTIONS`, `TIME_SLOT_STREAK`, `ANY_X_HABITS_STREAK`).
2. Loads the matching `Achievement` rows from the catalog.
3. For each one, finds (or creates) the user's `UserAchievement` progress row.
4. Dispatches to the matching `IAchievementEvaluator` (e.g. `PositiveStreakEvaluator`) to update progress and possibly flip `IsUnlocked = true`.
5. Calls `SaveChangesAsync` once for the whole batch.

Finally, the dispatcher stamps `ProcessedAtUtc` on the outbox row so it's never re-processed.

### The full picture

```
[Click "Done"]
   │
   ▼
[Dashboard.jsx → habits.js → axios.post()]
   │
   ▼  Authorization: Bearer <jwt>
[UseAuthentication / UseAuthorization]
   │
   ▼
[UserHabitController.LogExecution]
   │
   ▼
[UserHabitService.LogExecutionAsync]
   │
   ├── _db.HabitExecutions.Add(execution)
   ├── _outbox.EnqueueAsync(HabitExecutedEvent)
   └── _db.SaveChangesAsync()  ───▶  BEGIN; INSERT execution; INSERT outbox_message; COMMIT;
                                          │
                                          ├──▶ trg_on_habit_execution updates streaks
                                          │
                                          ▼ (eventually)
                                  [OutboxDispatcherService] polls every N seconds
                                          │
                                          ▼
                                  [GamificationService.HandleAsync]
                                          │
                                          ▼
                                  [PositiveStreakEvaluator etc.] → UPDATE user_achievements
```

---

## 4. Key Design Patterns Used

You'll bump into these names while reading the code. Each section answers: **what is it, where do I see it, why was it chosen?**

### 4.1 Layered Clean Architecture

**Analogy:** Think of an onion. The core is the *Domain* (entities like `User`, `HabitExecution`) — pure C# with no dependencies. Around it sits the *Application* layer (services, DTOs) that orchestrates business rules. Around *that* sits the *Infrastructure* layer (database, JWT, outbox) — the messy real-world parts. *Controllers* are just the thin shell that lets HTTP touch the onion.

**Where:** `Domain/`, `Application/`, `Infrastructure/`, `Controllers/` folders.

**Why:** The inner layers don't know the outer ones exist. So you can change the database engine, swap REST for gRPC, or replace JWT with cookies without touching business logic.

### 4.2 Dependency Injection (DI)

**Analogy:** Instead of every chef growing their own vegetables, the restaurant has one supplier who delivers what each kitchen needs. The chef just says "I need tomatoes" — they don't care where they came from.

**Where:** `Program.cs` registers services (`builder.Services.AddScoped<IAuthService, AuthService>()`). Controllers and services declare their dependencies in their constructors:

```csharp
public UserHabitService(AppDbContext db, IOutboxWriter outbox) { ... }
```

**Why:** You can swap implementations for tests (e.g. fake `IOutboxWriter`), and the lifetime of every object (Singleton / Scoped / Transient) is centrally controlled.

### 4.3 DTOs (Data Transfer Objects)

**Analogy:** A passport vs. your full identity. The passport carries *just enough* to identify you at a border — you don't hand over your medical history.

**Where:** `Application/DTOs/<Feature>/`. Examples: `UserHabitDto`, `LogExecutionRequest`, `HabitExecutionDto`.

**Why:** Two reasons:
1. **Security** — entities have fields the client must never see (like `PasswordHash`). DTOs only expose safe fields.
2. **Stability** — you can rename a domain entity field without breaking the API contract, by mapping it differently in the DTO.

### 4.4 Service Pattern (no separate Repository)

**Analogy:** A ticket counter at a train station. You go to the counter (the service), tell them what you want ("Subscribe me to this habit"), and they handle the database lookup, validation, and confirmation. You never see the back office.

**Where:** Every feature has `I<Feature>Service` (the contract) and `<Feature>Service` (the implementation). The service holds an `AppDbContext` directly — there's no extra repository layer because EF Core's `DbContext` already *is* a Unit-of-Work + repository.

**Why:** Adding a repository on top of EF Core for a project this size would be ceremony with no payoff. The service IS the business logic boundary.

### 4.5 Transactional Outbox Pattern

**Analogy:** When you mail a letter, you don't deliver it yourself — you drop it in the mailbox, and the postal service picks it up later. If your house burns down between dropping it and pickup, the letter is *still* in the mailbox.

**Where:**
- `Infrastructure/Outbox/OutboxMessage.cs` — the "mailbox" table.
- `Infrastructure/Outbox/OutboxWriter.cs` — what `UserHabitService` calls to drop a letter.
- `Infrastructure/Outbox/OutboxDispatcherService.cs` — the postman, running on a `PeriodicTimer`.

**Why:** Without this, you'd have two writes — "save the execution" AND "tell gamification" — that could be split by a crash, leaving the system inconsistent. With the outbox, the execution and the message commit in **the same SQL transaction**. The dispatcher will eventually pick it up. No event is ever lost.

### 4.6 Domain Events + Strategy Pattern (Gamification)

**Analogy:** A school principal makes one announcement ("the bell rang"), and every teacher decides what to do with it — the math teacher starts class, the gym teacher takes attendance, the cafeteria opens lunch. The announcer doesn't need to know who's listening.

**Where:**
- Events live in `Domain/Events/`: `HabitExecutedEvent`, `SleepLoggedEvent`, `AffectEntryRecordedEvent`, `StreakMaintenanceCompletedEvent`.
- The "teachers" are the **13 evaluators** in `Application/Gamification/Evaluators/`, one per `ConditionKey`.
- `GamificationService.HandleAsync` builds a routing dictionary and dispatches each event to the matching strategies.

**Why:** Adding a new achievement type is **one new class + one DI line** — no `if/else` ladder, no touching existing evaluators. This is the Open/Closed Principle in practice.

### 4.7 Mini-CQRS for Analytics (Materialised Views)

**Analogy:** A restaurant chef doesn't recount the inventory every time a customer asks "what's popular?" — they keep a tally on the wall and update it once a night. Reads are instant; the cost lives in the tally update.

**Where:**
- SQL views in `Data/SqlScripts/04_Views.sql` (`vw_user_daily_summary`, `vw_user_habit_stats`, …).
- Materialized views in `05_MaterializedViews.sql` (`mvw_global_habit_stats`).
- Read-only C# shapes in `Domain/ReadModels/` (e.g. `GlobalHabitStatsView`) — registered as `HasNoKey()` in `AppDbContext`.
- `AnalyticsService` projects rows via `DbContext.Database.SqlQueryRaw<T>()`, bypassing the entity model entirely.

**Why:** Heavy aggregation queries (correlations, weekly summaries) are slow. By computing them in views (or pre-computing in materialised views), reads stay fast and the entity model stays clean.

### 4.8 Soft Delete by Convention

**Where:** `Category`, `Habit`, `Achievement`, `UserHabit` all have an `IsArchived` flag. `AppDbContext.OnModelCreating` adds `e.HasQueryFilter(x => !x.IsArchived)` so EF Core auto-excludes archived rows from every query.

**Why:** `HabitExecution` rows reference `UserHabit` rows. If you hard-delete a habit, you'd lose history. Soft delete keeps referential integrity AND analytics views forever.

To bypass the filter (e.g. in admin/restore flows), call `.IgnoreQueryFilters()`.

### 4.9 PostgreSQL-Native Enums

**Where:** `Models/Enums.cs` declares `FrequencyType`, `ProposalStatus`, `ConditionKey`. They're mapped via `dataSourceBuilder.MapEnum<T>()` in `Program.cs` AND `modelBuilder.HasPostgresEnum<T>()` in `AppDbContext`.

**Why:** Querying `WHERE condition_key = 'POSITIVE_STREAK'` in psql reads naturally. Integer-based enums would force you to remember "is 0 perfect_day or positive_streak?".

**Watch out:** Adding a new enum requires changes in **all three places** (the C# enum, `Program.cs` mapping, `AppDbContext` declaration) AND a new migration.

### 4.10 JWT with Role Claims + Centralised User ID

**Where:**
- `Infrastructure/Authentication/TokenProvider.cs` issues HS256 tokens with `sub`, `email`, `nickname`, `role` claims.
- `Application/Common/Extensions/ClaimsPrincipalExtensions.cs` provides `User.GetUserId()` so controllers never read the user ID from the request body.

**Why:** Reading `userId` from the body is a classic IDOR (insecure direct object reference) bug — clients could log executions on other accounts. Reading from the JWT means cryptographic proof of identity.

---

## 5. "How To…" Cheat Sheet

### How to add a new page to the frontend

1. Create the page component: `FrontendProject/src/pages/MyNewPage.jsx`. Copy the structure of an existing page like `Profile.jsx` so you get the layout, animations, and `BottomNav` for free.
2. Register the route in `FrontendProject/src/routes/AppRouter.jsx`:
   ```jsx
   import MyNewPage from '../pages/MyNewPage.jsx';
   ...
   <Route
     path="/my-new"
     element={
       <ProtectedRoute allow={[ROLES.USER]}>
         <MyNewPage />
       </ProtectedRoute>
     }
   />
   ```
3. If users should navigate to it, add an entry to `src/components/common/BottomNav.jsx` (or wherever you link from).
4. If it needs API data, add a fetcher to `src/api/<feature>.js` and a URL to `src/api/endpoints.js`.

### How to add a new API endpoint

1. **DTOs first.** Add request/response shapes in `Application/DTOs/<Feature>/` (e.g. `MyRequest.cs`, `MyResponseDto.cs`).
2. **Service contract & implementation.** Add a method to `I<Feature>Service` and implement it in `<Feature>Service` (under `Application/Services/<Feature>/`). This is where the real logic lives — DB queries, validation, mapping.
3. **Controller action.** Add an `[HttpGet]` / `[HttpPost]` etc. to the matching controller. Keep it tiny — pull `userId` from claims, call the service, translate exceptions to status codes:
   ```csharp
   [HttpPost("my-action")]
   public async Task<ActionResult<MyResponseDto>> Do([FromBody] MyRequest req, CancellationToken ct)
   {
       try
       {
           var userId = User.GetUserId();
           return Ok(await _service.DoAsync(userId, req, ct));
       }
       catch (ValidationException ex) { return BadRequest(new { error = ex.Message }); }
       catch (NotFoundException ex)   { return NotFound(new { error = ex.Message }); }
   }
   ```
4. **Wire DI** if it's a new service — add `services.AddScoped<IMyService, MyService>()` in the matching `Add<Feature>()` extension under `Infrastructure/DependencyInjection/`.
5. **Frontend.** Add the URL to `src/api/endpoints.js`, write the call helper in `src/api/<feature>.js`, and use it from the page/component.

### How to add a new table to the database

1. **Domain entity.** New file in `Domain/Entities/MyThing.cs` — pure C# class with properties and navigation properties.
2. **DbSet & configuration.** In `Data/AppDbContext.cs`:
   - Add `public DbSet<MyThing> MyThings => Set<MyThing>();`
   - Add a `ConfigureMyThing(modelBuilder)` method following the pattern of the others — keys, indexes, relationships, soft-delete filter if applicable.
3. **Migration.** From `BackendProject/HabitTracker/HabitTracker/`:
   ```bash
   dotnet ef migrations add AddMyThing
   dotnet ef database update
   ```
   Open the generated `Migrations/<timestamp>_AddMyThing.cs` and review — the snake_case conventions and `timestamptz` columns happen automatically.
4. **If you need a trigger / view / function**, add a new SQL file under `Data/SqlScripts/` (numbered so the order is obvious) and call `migrationBuilder.Sql(File.ReadAllText(...))` in the migration's `Up()`. Always create a matching `Down_*.sql` so rollbacks work.

### How to add a new achievement type (gamification)

1. **Add the `ConditionKey` enum value** in `Models/Enums.cs` AND generate a migration so Postgres learns about it.
2. **Write the evaluator.** New class in `Application/Gamification/Evaluators/MyConditionEvaluator.cs` implementing `IAchievementEvaluator`:
   ```csharp
   public ConditionKey Key => ConditionKey.MY_CONDITION;
   public async Task EvaluateAsync(EvaluationContext ctx, CancellationToken ct) { ... }
   ```
3. **Register in DI.** Add `services.AddScoped<IAchievementEvaluator, MyConditionEvaluator>();` in `Infrastructure/DependencyInjection/GamificationServiceCollectionExtensions.cs`.
4. **Update the event-→-conditions map** in `GamificationService.MapEventToConditionKeys` so events that should trigger this evaluator route to it.
5. **Seed achievement rows** in the catalog so users have something to unlock (`Data/DatabaseSeeder.cs` or via the Catalog API as a Content Manager).

### How to run the whole stack locally

```bash
# 1. From the repo root — start Postgres
docker compose up -d

# 2. Backend — apply migrations + run
cd BackendProject/HabitTracker/HabitTracker
dotnet ef database update
dotnet run                        # → https://localhost:7152 (+ Swagger UI at /swagger)

# 3. Frontend — install deps once, then dev server
cd FrontendProject
npm install
npm run dev                       # → http://localhost:5173
```

The frontend's `.env` should have `VITE_API_BASE_URL=https://localhost:7152` (the default if unset).

---

## 6. Domain Model & Business Workflows

The previous sections explained *how* the code is wired. This section explains *what the app actually does* and why the business is structured the way it is. If you want to extend a feature, start here so you don't accidentally break a workflow.

### 6.1 What is Harmony, in one paragraph?

Harmony is a habit-tracking and well-being platform with a feedback loop between three different kinds of users. Regular **Users** track their daily habits, sleep, and mood (PAD affect). **Data Analysts** look at aggregated, anonymised behaviour across the whole user base to find what's working and what isn't, and they file formal **Proposals** for content changes. **Content Managers** own the global catalog (categories, habits, achievements) and act as the gatekeepers who turn analyst proposals into real catalog edits. Gamification (achievements with progress tracking) rewards users for streaks, volume, perfect days, and synergy combos — pulling them back into the loop.

The whole system is engineered so that **the more users do, the more signal analysts get; the better proposals analysts make, the better the catalog content managers ship; the better the catalog, the more users engage.**

### 6.2 The 3-Tier Role System (RBAC)

Three roles live in the `roles` dictionary table, seeded in `AppDbContext.ConfigureRole`:

| Id | Role | What they can do |
|---|---|---|
| 1 | **User** | Subscribe to habits, log executions, log sleep, log affect, view their own analytics, unlock achievements |
| 2 | **ContentManager** | Everything a User can, **plus** create/update/archive Categories, Habits, Achievements, and review the Analyst proposal queue |
| 3 | **Analyst** | Everything a User can, **plus** view global aggregated stats (drop-off rates, AI sleep effectiveness), file Proposals to influence the catalog |

Roles are enforced two ways:

- **At the API surface** — controllers gate writes with `[Authorize(Roles = "ContentManager,Admin")]` (`ContentManagerController`) or `[Authorize(Roles = "Analyst")]` (`AnalystDashboardController`). Reads on the catalog are open to any authenticated user; writes are restricted.
- **At the JWT layer** — `TokenProvider` writes the role into the `role` claim, and `Program.cs` middleware (`UseAuthentication` / `UseAuthorization`) blocks the request before it ever reaches a service.

The frontend mirrors this with `ROLES = { USER, CONTENT_MANAGER, ANALYST }` in `src/context/AuthContext.jsx`. Every protected route declares its allowed roles via `<ProtectedRoute allow={[ROLES.X]}>` in `src/routes/AppRouter.jsx`. The `/` root route looks at the user's role and redirects to their natural home: `/dashboard`, `/catalog`, or `/analytics`.

#### Role landing pages at a glance

| Role | Lands on | Key page file |
|---|---|---|
| User | `/dashboard` | `src/pages/Dashboard.jsx` |
| Content Manager | `/catalog` | `src/pages/ContentManagerView.jsx` |
| Analyst | `/analytics` | `src/pages/AnalystDashboardView.jsx` |

### 6.3 The Analyst → Content Manager Workflow (the heartbeat of the platform)

This is the most important workflow in Harmony — it's what makes the catalog live and improving rather than static. Here is the full lifecycle of a proposal.

#### Lifecycle

```
        ┌────────────────────┐                         ┌──────────────────────────┐
        │   ANALYST          │                         │   CONTENT MANAGER        │
        └─────────┬──────────┘                         └─────────────┬────────────┘
                  │                                                  │
                  │  1. Reads global stats                           │
                  │     (drop-off, sleep effectiveness, trends)      │
                  │                                                  │
                  │  2. Identifies a problem habit /                 │
                  │     opportunity                                  │
                  │                                                  │
                  │  3. POST /api/analyst/proposals                  │
                  │     { habitId, proposedChange, argumentation }   │
                  │     → Status = Pending                           │
                  │ ──────────────────────────────────────────────▶  │
                  │                                                  │
                  │                                                  │  4. GET /api/content/proposals
                  │                                                  │     → reviews queue
                  │                                                  │
                  │                                                  │  5. Decides: Implement or Reject
                  │                                                  │
                  │                                                  │  6. PUT /api/content/proposals/{id}/status
                  │                                                  │     → Status = Implemented | Rejected
                  │                                                  │
                  │                                                  │  7. If Implemented, performs catalog
                  │                                                  │     CRUD (PUT /api/content/habits/{id})
                  │                                                  │
                  │  8. GET /api/analyst/proposals/me                │
                  │  ◀──────────────────────────────────────────────  │
                  │     sees the new status                          │
                  │                                                  │
```

#### The status state machine

The `ProposalStatus` enum in `Models/Enums.cs` defines exactly **three** states (the PostgreSQL enum is `proposal_status`):

```csharp
public enum ProposalStatus { Pending, Implemented, Rejected }
```

> **Note:** there is no separate `InProgress` state in the current schema. A proposal is either awaiting review (`Pending`), accepted and acted upon (`Implemented`), or refused (`Rejected`). Both `Implemented` and `Rejected` are terminal — once set, the workflow is done.

#### Where the code lives

| Step | Backend |
|---|---|
| Analyst submits | `AnalystDashboardController.CreateProposal` → `AnalystDashboardService.CreateProposalAsync` (sets `Status = Pending`) |
| Manager reviews queue | `ContentManagerController.GetProposals` → `ContentManagerService.GetProposalsAsync` |
| Manager decides | `ContentManagerController.UpdateProposalStatus` → `ContentManagerService.UpdateProposalStatusAsync` |
| Manager edits the catalog | `ContentManagerController` PUT/POST/DELETE on `/categories`, `/habits`, `/achievements` |
| Analyst checks back | `AnalystDashboardController.GetMyProposals` (own) / `GetOthersProposals` (peers') |

#### Why proposals are retained even after a habit is deleted

The FK from `AnalystProposal.HabitId` to `Habit.Id` uses **`OnDelete(DeleteBehavior.SetNull)`** (see `AppDbContext.ConfigureAnalystProposal`). When a Content Manager archives a habit, the proposal stays alive with `HabitId = null`, labelled "General" in the analyst dashboard. This preserves the historical record of *why* the catalog evolved — and the materialised view `mvw_analyst_proposal_impact` can still measure month-over-month completion-rate change for each implemented proposal.

#### What an Analyst sees on their dashboard (`AnalystDashboardController`)

- `GET /api/analyst/habits/needs-attention` — habits sorted by **drop-off rate** (highest first), pulled from `mvw_global_habit_stats`. These are the candidates for a proposal.
- `GET /api/analyst/sleep/effectiveness` — the AI sleep-recommendation effectiveness metric (see §6.5).
- `GET /api/analyst/habits/trends` — month-over-month changes in completion rate from `mvw_analyst_proposal_impact`, so the analyst can see whether their previous proposals actually moved the needle.
- `GET /api/analyst/proposals/me` and `/others` — their own queue and what their peers have filed.

### 6.4 Gamification & Achievements — the engagement engine

Achievements are the carrot. They are the catalog mechanism that gives users a reason to keep logging beyond the first novelty week.

#### How achievements are defined (the catalog side)

A Content Manager creates an `Achievement` row with three key fields:

| Field | Meaning |
|---|---|
| `ConditionKey` | **What kind of behaviour** unlocks it (one of 13 fixed `ConditionKey` enum values) |
| `TargetValue` | **How much** is needed (e.g. `100` for "100-day streak", `5000` for "5L of water") — null for boolean conditions like `FIRST_ACTION` |
| `HabitId` | **Optional** — scope the achievement to a single catalog habit, or leave null for a habit-agnostic award |

Critically, **Content Managers cannot invent new ConditionKeys** — the enum is closed at code level. They can only mix-and-match the existing 13 with different `TargetValue`s and `HabitId`s. This is by design: each `ConditionKey` is backed by a hand-written evaluator class, and adding a new kind of unlock condition requires a developer (see "How to add a new achievement type" in §5).

#### The 13 ConditionKeys (from `Models/Enums.cs`)

| Key | What it rewards |
|---|---|
| `TOTAL_METRIC_VOLUME` | Cumulative numeric total (e.g. drank 5000 ml of water all-time) |
| `POSITIVE_STREAK` | N consecutive days of completing a positive habit |
| `NEGATIVE_STREAK` | N consecutive days of avoiding a negative habit |
| `PERFECT_DAY_STREAK` | N consecutive days where *all* a user's habits were completed |
| `ANY_X_HABITS_STREAK` | N consecutive days completing at least X distinct habits |
| `FIRST_ACTION` | One-time: the user did something for the first time |
| `SYNERGY_COMBO` | Performed two specific habits on the same day (e.g. "exercised + meditated") |
| `CATEGORY_TOTAL_EXECUTIONS` | Total executions across an entire category (e.g. 100 Health-category logs) |
| `TIME_SLOT_STREAK` | Streak of completing a habit within a specific time slot (Morning / Evening / …) |
| `CONSISTENT_BEDTIME_STREAK` | Streak of going to bed within the recommended window |
| `SLEEP_DEBT_CLEARED` | Worked off accumulated sleep debt back to zero |
| `AFFECT_STABILITY` | Mood (PAD) variance stayed low over a window |
| `AFFECT_HIGH_DOMINANCE` | Sustained high "in-control" Dominance scores in PAD readings |

#### How a user earns one (runtime)

When a user logs an execution, sleep entry, or affect reading, the service writes a `HabitExecutedEvent` / `SleepLoggedEvent` / `AffectEntryRecordedEvent` to the **outbox table** (in the same transaction as the data row). The `OutboxDispatcherService` background loop picks it up, deserialises it, and hands it to `GamificationService.HandleAsync`. That service:

1. Looks up which `ConditionKey`s this event type might affect (see `MapEventToConditionKeys`).
2. Loads the matching `Achievement` rows from the catalog.
3. For each one, finds the user's `UserAchievement` progress row (or creates one with `CurrentProgress = 0, IsUnlocked = false`).
4. **Skips already-unlocked rows** — progress is monotonic, never re-evaluated.
5. Delegates to the matching `IAchievementEvaluator` (one of 13 strategy classes in `Application/Gamification/Evaluators/`).
6. The evaluator updates `CurrentProgress` and, if the `TargetValue` is reached, flips `IsUnlocked = true` and stamps `UnlockedAt`.
7. Saves all changes in a single `SaveChangesAsync`.

So for the user, the achievement appears to "just unlock" seconds after the qualifying action — but architecturally, the unlock is **eventually consistent**, decoupled from the request that caused it. That's why the user's API call (e.g. logging a habit) returns instantly without waiting for the gamification check.

#### What rarity means

A Content Manager can see how rare each achievement is (what percentage of users have unlocked it) via the materialised view `mvw_achievement_rarity`, projected through `AchievementRarityView` and exposed in the awards/rarity controllers. Rare achievements are a signal to the CM that the `TargetValue` may be too aggressive, or alternatively that the achievement is genuinely prestigious — both useful inputs for catalog tuning.

### 6.5 Sleep & Affect (Mood) Tracking — the "AI Effectiveness" loop

This is the most research-flavoured part of Harmony, and the one that distinguishes it from a generic habit tracker.

#### Sleep tracking

Three entities, working together:

- **`UserSleepProfile`** (`Domain/Entities/UserSleepProfile.cs`) — the user's *parameters*: `BaseSleepHours`, `AbsoluteMinSleepHours`, `WeekendDeviationHours`, `SleepDebtMinutes`. Set once, updated occasionally.
- **`SleepLog`** — every actual sleep interval the user records (start, end, quality 1–10, optional tags). A GiST `EXCLUDE` constraint (`no_overlapping_sleep`) prevents two logs from overlapping in time.
- **`SleepRecommendation`** — a snapshot of the multi-day plan the algorithm has produced for the user, persisted as a JSONB `SleepPlan` document with nested `Days[]` and `Zeitgebers` (light/meal/exercise cues that anchor the circadian rhythm).

The algorithm regenerates a `SleepRecommendation` whenever sleep history or profile parameters drift, and an A/B comparison of *adherent* vs *non-adherent* users is the basis of the AI Effectiveness metric.

#### PAD Affect (mood) tracking

Instead of a naive 1–10 mood slider, Harmony uses the well-established **PAD (Pleasure–Arousal–Dominance)** model — three signed axes from −5 to +5 (`AffectEntry` in `Domain/Entities/`):

| Axis | −5 | 0 | +5 |
|---|---|---|---|
| **Pleasure** | pain / strong aversion | neutral | deep contentment |
| **Arousal** | lethargic / sedated | neutral | wired / activated |
| **Dominance** | helpless / overwhelmed | neutral | fully in control |

Each entry can also carry free-form `ContextTags` (e.g. `["work", "sleep_deprivation"]`), stored as a native PostgreSQL `TEXT[]` and indexed with a GIN index for fast tag-based filtering. Multiple readings per day feed the PL/pgSQL function `fn_calculate_daily_affect_centroid`, which uses **Trapezoidal AUC + Peak-End** weighting to compute the user's daily affect summary — modelling the well-known psychological finding that people remember the peak and the end of an experience more than the average.

#### "AI Effectiveness" — what the metric actually measures

The materialised view `mvw_sleep_recommendation_effectiveness` (declared in `Data/SqlScripts/05_MaterializedViews.sql`, projected by `Domain/ReadModels/SleepEffectivenessView.cs`) bins users into two cohorts:

- **`adherent`** — users whose actual sleep tracks the recommendation closely.
- **`non_adherent`** — users who deviate from the recommendation.

For each cohort it computes mean PAD scores (`MeanP`, `MeanA`, `MeanD`) and the cohort size (`NUsers`). The `AnalystDashboardService.GetSleepEffectivenessAsync` method then derives the analyst-facing percentages:

| Field | How it's computed |
|---|---|
| `AdherenceRatePct` | `adherent.NUsers / totalUsers × 100` |
| `MorningMoodDeltaPct` | `(adherent.MeanP − non_adherent.MeanP) / 10 × 100` (Pleasure delta as % of the 10-point PAD range) |
| `SleepQualityDeltaPct` | Same formula on Arousal |
| `NextDayCompletionDeltaPct` | Same formula on Dominance — proxied here because high Dominance correlates with executing planned habits |
| `KeyInsight` | A short auto-generated coaching sentence — see `BuildKeyInsight` for the rule table |

So the "AI Effectiveness" the Analyst sees is a **causal-inference-style A/B comparison**: do users who follow the AI's sleep plan actually report better mood and feel more in control of their habits the next day? If yes, the algorithm is earning its keep. If not, the analyst will likely file a Proposal to recalibrate parameters or surface the recommendation more prominently — which closes the loop with §6.3.

#### The big picture in one diagram

```
   ┌───── User logs ─────┐                        ┌──── Analyst analyses ─────┐
   │ • HabitExecution    │                        │ • Drop-off rates           │
   │ • SleepLog          │ ─── outbox + events ──▶│ • Sleep AI effectiveness   │
   │ • AffectEntry       │                        │ • Habit trends (MoM)       │
   └─────────────────────┘                        └──────────┬─────────────────┘
              ▲                                              │
              │                                              ▼
              │                                  ┌────────── Proposal ──────────┐
              │                                  │  Pending → Implemented /     │
              │                                  │            Rejected          │
              │                                  └──────────┬───────────────────┘
              │                                             │ (if Implemented)
              │                                             ▼
              │                            ┌──── Content Manager edits ────┐
              │                            │ • Categories / Habits /       │
              └────── Better catalog ──────│   Achievements catalog CRUD   │
                       drives more         └───────────────────────────────┘
                       engagement
```

That feedback loop — User → Analyst → Content Manager → Catalog → User — is the entire reason the three-role split exists. Every architectural decision in this codebase (the outbox, the materialised views, the proposal entity, the soft-delete policy on the catalog, the closed `ConditionKey` enum) is in service of keeping that loop trustworthy and fast.

---

## 7. Database Architecture & Data Integrity

> **Technical Passport — PostgreSQL 15 / `habit_tracker_db`**
> Engine: PostgreSQL 15 · Driver: Npgsql 9.0.3 · ORM: EF Core 9 · Naming: `snake_case` (auto-applied in `AppDbContext.ApplyDatabaseConventions`) · Timestamps: `timestamptz` everywhere · UUIDs: surrogate PKs on user-scoped entities · Surrogate `serial` PKs on dictionary tables · Soft delete: `is_archived BOOLEAN` + intercepting trigger.

The database is not a passive byte store. It is an **active layer** that participates in business logic — enforcing exclusion constraints, maintaining streak counters, intercepting deletes, materializing analytics. The C# `Application` layer is the *orchestrator*; PostgreSQL is the *enforcer of last resort*. This section is the technical passport for that storage layer.

### 7.1 Core Entity Relationship Groups

The schema partitions cleanly into **four functional groups**. Read them in order — each builds on the previous.

#### 7.1.1 Identity & RBAC — *who is allowed to do what*

```
                    ┌─────────────┐
                    │   roles     │  ← seeded dictionary, 3 rows
                    │  (id, name) │      User / ContentManager / Analyst
                    └──────┬──────┘
                           │ 1
                           │
                           │ N
                    ┌──────▼──────────────────────────────┐
                    │            users                    │
                    │  (id UUID, role_id, email UNIQUE,   │
                    │   password_hash, timezone,          │
                    │   updated_at ← maintained by        │
                    │                trg_users_updated_at)│
                    └─────────────────────────────────────┘
```

- **`roles`** is a fixed 3-row dictionary, seeded by `AppDbContext.ConfigureRole` via `HasData(...)`. The values (`User`, `ContentManager`, `Analyst`) appear verbatim in JWT `role` claims and in `[Authorize(Roles=...)]` attributes — they are part of the API contract.
- **`users.role_id`** uses `OnDelete(DeleteBehavior.Restrict)` so an in-use role can never be accidentally deleted out from under live accounts.
- **`users.email`** has a unique B-Tree index (the only natural key on the table); the surrogate UUID `id` is what every other table FKs to.
- **`users.timezone`** is an IANA string (default `'UTC'`) — every analytics view uses it for local-date bucketing (`(ae.recorded_at AT TIME ZONE u.timezone)::DATE` is a recurring pattern in `04_Views.sql`).
- **`users.updated_at`** is **never written from C#**. EF Core declares it `ValueGeneratedOnAddOrUpdate` and ignores it on save; the `trg_users_updated_at` trigger handles every UPDATE.

#### 7.1.2 Global Catalog — *the blueprint layer*

The **catalog** is the shared template library that Content Managers curate. It exists independently of any user: deleting a user does not perturb a catalog row, and archiving a catalog row does not destroy any user's history.

```
       ┌──────────────┐     1     N    ┌─────────────┐     N     0..1   ┌────────────────┐
       │  categories  │ ◀──────────────│   habits    │ ─────────────────▶│  achievements  │
       │ (id SERIAL,  │                │ (id SERIAL, │                   │ (id SERIAL,    │
       │  name,       │                │  category_id│                   │  habit_id?,    │
       │  is_negative,│                │  is_negative│                   │  condition_key,│
       │  is_archived)│                │  is_archived)                   │  target_value, │
       └──────────────┘                └─────────────┘                   │  is_archived)  │
                                                                         └────────────────┘
```

- **`categories`** — surrogate `serial` PK, `is_negative` flag (Health vs Distraction), `is_archived` flag.
- **`habits`** — the catalog template a user can subscribe to. Has a fixed `Title`, optional default `ColorHex` / `IconEmoji`. FK `habits.category_id → categories.id` uses **`Restrict`** so a category with live habits can't be deleted directly — the soft-delete trigger short-circuits this anyway.
- **`achievements`** — the unlock catalog. Three fields are the *contract* with the gamification engine: `condition_key` (one of 13 native enum values, see §7.4), `target_value` (the threshold), and the optional `habit_id` scope. FK `achievements.habit_id → habits.id` uses **`SetNull`** so deleting a habit demotes its scoped achievements to "habit-agnostic" instead of orphaning them.
- All four catalog tables (`categories`, `habits`, `achievements`, plus `user_habits` from §7.1.3) are protected by **`trg_soft_delete`** (see §7.2.1). A `DELETE` from C# becomes an `UPDATE is_archived = true` at the DB level.

#### 7.1.3 User Progress — *subscriptions and the granular action log*

This is the operational core of the database — the high-write pair that records what users actually do.

```
   ┌───────┐      1   N    ┌────────────────────┐    1    N    ┌─────────────────────┐
   │ users │ ─────────────▶│    user_habits     │ ────────────▶│  habit_executions   │
   └───────┘               │   (junction +      │              │ (the granular log)  │
                           │   subscription)    │              │                     │
                           │                    │              │ (id UUID,           │
                           │ (id UUID,          │              │  user_habit_id,     │
                           │  user_id,          │              │  execution_time     │
                           │  habit_id?  ───────┘              │       timestamptz,  │
                           │  category_id,                     │  logged_value,      │
                           │  custom_name?,                    │  note?,             │
                           │  schedule_rule    ← JSONB         │  created_at         │
                           │  current_streak,  ← maintained    │       DEFAULT NOW())│
                           │  longest_streak,  ← by trigger    │                     │
                           │  is_archived)                     │ FK → user_habits    │
                           └────────────────────┘              │   ON DELETE RESTRICT│
                                                               └─────────────────────┘
```

**`user_habits` — the subscription junction table.**
- One row per (user, habit) the user has subscribed to. The `habit_id` is **nullable** — when null, this is a fully *custom* habit (the user invented it, not a catalog template). When non-null, the row is an instance of a catalog habit, optionally with overrides (`custom_name`, `color_hex`, `target_value`).
- **`schedule_rule`** is persisted as a single **JSONB sub-document** via `OwnsOne(...).ToJson("schedule_rule")` — the polymorphic `TimeSlot | ExactTime | DaysOfWeek | DayOfMonth | OneTimeDate | TimesPerPeriod` shape would be ugly as separate columns and is best read as one document.
- FK behaviour: `user_id` → `Cascade` (GDPR — delete the user, their subscriptions go with them), `habit_id` → `SetNull` (catalog habit removed → subscription becomes custom), `category_id` → `Restrict`.
- **Partial Index `idx_user_habits_user_archived`** filters on `WHERE is_archived = false` — most queries only ever care about active subscriptions, so the index is half the size.

**`habit_executions` — the immutable activity log.**
- Append-only by convention; nothing in the application writes UPDATE or DELETE against this table. `created_at` is server-generated by `DEFAULT NOW()`.
- FK `user_habit_id → user_habits.id` uses **`Restrict`** — *`HabitExecution` rows must NEVER be cascade-deleted from `UserHabit`*. This protects the entire historical record. GDPR user-deletion has to purge executions in an explicit service-layer step *before* the user row is removed (because the user → user_habit cascade would otherwise be blocked by the restrict).
- Composite B-Tree index **`idx_executions_userhabit_time` on `(user_habit_id, execution_time)`** is the index that powers virtually every dashboard query and the streak trigger's lookups.
- `logged_value NUMERIC(18,4)` — supports both quantity (`1500.0` ml) and signed corrections (`-1500.0` for an undo).

#### 7.1.4 Biometric & Mood Data — *the well-being timeline*

Two parallel time-series tables, one for sleep and one for affect (PAD), both keyed off `user_id` with chronological indexes.

```
   ┌───────┐      ┌──────────────────────────────────┐
   │ users │ ────▶│           sleep_logs             │
   └───┬───┘      │ (id UUID, user_id, sleep_start,  │
       │          │  sleep_end, sleep_quality 1-10,  │
       │          │  tags TEXT[],                    │
       │          │  CHECK end > start,              │
       │          │  CHECK quality BETWEEN 1 AND 10, │
       │          │  EXCLUDE no_overlapping_sleep    │
       │          │     ← GiST + btree_gist)         │
       │          └──────────────────────────────────┘
       │
       │          ┌──────────────────────────────────┐
       └─────────▶│         affect_entries           │
                  │ (id UUID, user_id, recorded_at,  │
                  │  pleasure_score   ∈ [-5, +5],    │
                  │  arousal_score    ∈ [-5, +5],    │
                  │  dominance_score  ∈ [-5, +5],    │
                  │  context_tags TEXT[],            │
                  │  note?)                          │
                  │                                  │
                  │  + idx_affect_user_time (B-Tree) │
                  │  + idx_affect_tags (GIN)         │
                  └──────────────────────────────────┘

           ┌──────────────────────────────────┐
           │     user_sleep_profiles          │  ← 1:1 with users (UNIQUE user_id)
           │  (base_sleep_hours,              │      Algorithm parameters,
           │   absolute_min_sleep_hours,      │      not a time-series.
           │   weekend_deviation_hours,       │
           │   sleep_debt_minutes)            │
           └──────────────────────────────────┘

           ┌──────────────────────────────────┐
           │     sleep_recommendations        │  ← snapshots of multi-day
           │  (id UUID, user_id, generated_at,│      sleep plans (JSONB)
           │   sleep_plan JSONB ← OwnsOne)    │
           └──────────────────────────────────┘
```

Three integrity constraints worth memorising:

1. **`no_overlapping_sleep`** (in `01_Extensions_and_Indexes.sql`) is a GiST `EXCLUDE USING gist (user_id WITH =, tstzrange(sleep_start, sleep_end, '[)') WITH &&)`. It prevents a user from logging two overlapping sleep intervals. The `[)` boundary lets adjacent intervals touch but not overlap. The `btree_gist` extension is required so a `=` operator on a scalar (`user_id`) can coexist with a range `&&` operator inside the same GiST index.
2. **PAD score CHECK constraints** (`ck_affect_pleasure_range`, `ck_affect_arousal_range`, `ck_affect_dominance_range`) enforce `BETWEEN -5 AND 5` *at the database level*, in addition to the C# `[Range(-5, 5)]` attribute. Defence in depth.
3. **`ck_sleep_quality_range`** + **`ck_sleep_end_after_start`** on `sleep_logs` make a malformed sleep entry impossible regardless of which client wrote it.

The two `TEXT[]` columns (`affect_entries.context_tags`, `sleep_logs.tags`) are native PostgreSQL arrays, not JSON. **`idx_affect_tags` is a GIN index** on `context_tags`, which means tag containment queries (`WHERE context_tags @> ARRAY['work']`) are effectively O(1).

### 7.2 Intelligent Automation — Triggers & Functions

PostgreSQL is doing real work, not just storing rows. Three pieces of database-resident logic are load-bearing for the application's correctness.

#### 7.2.1 Soft Delete Mechanism — *historical integrity by default*

**Problem:** `habit_executions` references `user_habits`. If a user "deletes" a habit subscription, you can't actually `DELETE` that row — every execution would either be orphaned or the cascade would shred a year of analytics.

**Solution — defence in *three* layers** (you'll see this pattern referenced as "soft delete" throughout the codebase):

| Layer | Where | What it does |
|---|---|---|
| **C# query filter** | `AppDbContext.OnModelCreating` — `e.HasQueryFilter(x => !x.IsArchived)` on Category, Habit, Achievement, UserHabit | Every EF query auto-appends `WHERE is_archived = false`. Bypass with `.IgnoreQueryFilters()`. |
| **C# service convention** | `Service.ArchiveAsync()` methods set `IsArchived = true` and call `SaveChangesAsync()` — they never call `_db.Remove(...)` | Idiomatic path. |
| **Database trigger** | `trg_soft_delete` on `categories`, `habits`, `user_habits`, `achievements` (`03_Triggers.sql`) → `fn_soft_delete()` (`02_Functions.sql`) | If anything (psql, DBA tool, a future bug) issues a real `DELETE`, the trigger intercepts it, runs `UPDATE %I SET is_archived = true WHERE id = OLD.id`, and returns `NULL` to suppress the original `DELETE`. |

**The bypass mechanism** is intentional and worth knowing about. `fn_soft_delete()` checks:

```sql
IF current_setting('app.bypass_soft_delete', true) = 'true' THEN
    RETURN OLD;  -- allow the real delete
END IF;
```

This is the GDPR escape hatch — when a user requests full account deletion, the service-layer flow does `SET LOCAL app.bypass_soft_delete = 'true';` inside a transaction, then deletes the user and lets the cascade run. Outside that one flow, **a real DELETE is not possible**, and that is the whole point.

#### 7.2.2 Streak Calculation — *offload heavy counting to the heart*

The brain (C#) decides *what* happened. The heart (Postgres) keeps score.

When the application writes a `habit_executions` row, **`trg_on_habit_execution`** fires (`AFTER INSERT FOR EACH ROW`) and runs `fn_on_habit_execution()`. That function:

1. Reads the parent `user_habit` row to learn whether the habit is positive (Yang) or negative (Yin) and its `target_value`.
2. Sums the existing `logged_value` for the same local day to find `v_sum_prior`, then computes `v_sum_total = v_sum_prior + NEW.logged_value`.
3. **For positive habits:** if `v_sum_prior < target ≤ v_sum_total`, the day just crossed the goal → `current_streak++` and `longest_streak = GREATEST(longest_streak, current_streak)`. If a negating execution drags the day back below target, `current_streak` is decremented (clamped at 0).
4. **For negative habits:** the polarity inverts — *any* logged failure event resets the streak to 0; an "undo" (negative `logged_value` that brings the day back to 0) recalculates the streak from history via `fn_calc_current_streak`.
5. All updates happen in a single `UPDATE user_habits ...` statement inside the trigger context — the parent row is locked by the trigger, so concurrent writers see a consistent view.

**Why this lives in Postgres rather than C#:**
- **O(1) at write time.** The trigger needs only the same-day execution sum and the parent row — no ORM round-trips, no `SELECT` of the entire history.
- **Atomicity.** The execution insert and the streak update share one transaction. The application can't observe a state where the execution exists but the streak hasn't moved.
- **Single source of truth.** Any client (the API, a future cron job, a manual DB fixup) that inserts into `habit_executions` automatically gets correct streaks. The application code does not need to remember to call a "recalculate streaks" helper.

The "day passed without execution" half of streak logic (decay) is handled by **`sp_daily_streak_maintenance`** (in `06_StoredProcedures.sql`), invoked on a schedule. When it finishes, it raises a `StreakMaintenanceCompletedEvent` so the gamification engine (§4.6) can re-evaluate streak-class achievements like `NEGATIVE_STREAK` and `PERFECT_DAY_STREAK`.

#### 7.2.3 The `users.updated_at` trigger

`trg_users_updated_at` is the simple textbook case: `BEFORE UPDATE`, set `NEW.updated_at := NOW()`. Pairs with the EF Core declaration `ValueGeneratedOnAddOrUpdate` + `PropertySaveBehavior.Ignore` so the application stays out of the trigger's lane.

### 7.3 Analytics & Materialized Views — the performance layer

Read traffic and write traffic have very different shapes here. The schema acknowledges this with a clear separation: **virtual views for per-user real-time questions, materialized views for global cross-user aggregates.**

#### 7.3.1 Virtual Views (`vw_*`) — real-time, per-user, exact

A virtual view is just a saved `SELECT`. Each query against it runs the underlying SQL fresh, so the result is always current — but the cost is paid on every read. Used when the view is *narrow* (filtered to a single user) and the user expects *up-to-the-second* numbers on their dashboard.

| View | Purpose | Used by |
|---|---|---|
| **`vw_user_daily_summary`** | One row per (user, local_date) with success rate, total sleep hours, PAD centroid, Peak-End remembered scores, and PAD volatility. The local-date bucketing uses each user's IANA timezone. | `/api/analytics/daily?from&to` |
| **`vw_user_habit_stats`** | Per-subscription stats: total executions, last-30-day count, last execution timestamp, current/longest streak. | `/api/analytics/habits` |
| **`vw_user_category_balance`** | Per-category share of the user's executions — drives the radar chart. | `/api/analytics/categories` |
| **`vw_user_correlations`** | Pearson r between daily binary completion of each `user_habit` and the day's PAD centroid (P, A, D). Sample = days with at least one affect entry. | `/api/analytics/correlations` |

These views **lean on the database functions** in `02_Functions.sql` (notably `fn_calculate_daily_affect_centroid` for Trapezoidal AUC + Peak-End and `fn_is_habit_scheduled` for schedule-rule evaluation). The complexity stays in PL/pgSQL where it can be unit-tested in psql; the C# `AnalyticsService` simply projects the rows via `DbContext.Database.SqlQueryRaw<T>()` into PascalCase DTOs.

#### 7.3.2 Materialized Views (`mvw_*`) — cached, global, refreshed

A materialized view is a *real table* whose contents are computed by a `SELECT` and then frozen until you `REFRESH` it. Used when the aggregate is **expensive**, **global** (all users at once), and **acceptable to be a few minutes stale** — exactly the shape of the Analyst dashboard.

| Materialized view | What it caches | Refresh strategy |
|---|---|---|
| **`mvw_global_habit_stats`** | Per-habit globals: subscribers_total, subscribers_active (last 14 days), **dropoff_rate_pct**, total_executions, avg_executions_per_active_user. Powers the analyst's "habits needing attention" list. | Periodic — see roadmap below |
| **`mvw_achievement_rarity`** | Unlock count and `unlock_rate_pct` per achievement (vs total user count). Drives the rarity badge in gamification UI. | Periodic |
| **`mvw_analyst_proposal_impact`** | Month-over-month change in execution count for the target habit of each *implemented* proposal: 30-day window before vs 30-day window after `created_at`, plus `mom_change_pct`. | Periodic |
| **`mvw_sleep_recommendation_effectiveness`** | A/B comparison: mean PAD scores for adherent vs non-adherent users (adherence ≈ at least one post-recommendation sleep log within ±30 min of the planned hours). Two cohorts, two rows. | Periodic |

**Why materialized views, specifically?**

1. **The aggregations are heavy.** `mvw_global_habit_stats` joins `habits × user_habits × habit_executions` with two correlated subqueries; running that on every analyst page load would be wasteful and would scale badly with execution volume.
2. **The freshness requirement is loose.** An analyst making catalog decisions doesn't need to-the-second numbers — yesterday's snapshot is fine.
3. **`REFRESH MATERIALIZED VIEW CONCURRENTLY` is safe under load.** Each MV has a `UNIQUE` index (e.g. `idx_mvw_global_habit_stats_habit ON (habit_id)`) which is the prerequisite for the `CONCURRENTLY` option — readers continue to see the old snapshot while the new one is being built.
4. **Read pattern matches keyless EF projections.** `Domain/ReadModels/GlobalHabitStatsView.cs` etc. are declared `HasNoKey().ToView("mvw_...")`; the analyst service queries them as ordinary `DbSet<...>` without polluting the entity model.

**Roadmap note** (from `BackendProject/README.md`): a Hangfire / cron job to call `REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_global_habit_stats` (and the other three) on a fixed cadence is listed under "Out of Scope" for the current sprint. Until that's wired, MVs need a manual refresh after a new round of seed data.

#### 7.3.3 Side-by-side: when to use which

| Question | Answer | Why |
|---|---|---|
| Per-user dashboard, "current streak" | **Live column** on `user_habits` (trigger-maintained) | O(1) read, write-time cost paid by the trigger |
| Per-user dashboard, "this week's success rate" | **Virtual view** `vw_user_daily_summary` | Narrow (filtered by user_id), needs to be exact |
| Cross-user dashboard, "which habits are bleeding subscribers?" | **Materialized view** `mvw_global_habit_stats` | Expensive, broad, freshness tolerant |
| Did proposal P actually improve completion? | **Materialized view** `mvw_analyst_proposal_impact` | Aggregates over months of executions |

### 7.4 Type Safety — Native PostgreSQL Enums

Most ORMs translate enums to integers (`0`, `1`, `2`) and call it a day. Harmony deliberately doesn't: three of the most semantically important enums are **first-class PostgreSQL types**.

| C# type (`Models/Enums.cs`) | PostgreSQL type | Where it appears |
|---|---|---|
| `FrequencyType` (`Daily`, `Weekly`, `Monthly`, `Once`) | `frequency_type` | `user_habits.frequency_type` |
| `ProposalStatus` (`Pending`, `Implemented`, `Rejected`) | `proposal_status` | `analyst_proposals.status` |
| `ConditionKey` (13 members, `TOTAL_METRIC_VOLUME`, `POSITIVE_STREAK`, …) | `condition_key` | `achievements.condition_key` |

**Wiring requires three coordinated registrations** (covered in detail in `BackendProject/HabitTracker/CLAUDE.md`):

1. **Declare the C# enum** in `Models/Enums.cs`.
2. **Register on the data source** in `Program.cs`, *before* the `DbContext` is built:
   ```csharp
   var dataSourceBuilder = new NpgsqlDataSourceBuilder(connectionString);
   dataSourceBuilder.MapEnum<FrequencyType>();
   dataSourceBuilder.MapEnum<ProposalStatus>();
   dataSourceBuilder.MapEnum<ConditionKey>();
   ```
3. **Declare on the model** in `AppDbContext.OnModelCreating`:
   ```csharp
   modelBuilder.HasPostgresEnum<FrequencyType>();
   modelBuilder.HasPostgresEnum<ProposalStatus>();
   modelBuilder.HasPostgresEnum<ConditionKey>();
   ```
   Then generate a migration — EF will emit `Npgsql:Enum:<name>` annotations on `AlterDatabase()`.

**Why pay the wiring cost?**

- **No magic strings, no random integers.** When a C# evaluator says `achievement.ConditionKey == ConditionKey.POSITIVE_STREAK`, the SQL it generates is `WHERE condition_key = 'positive_streak'` — exactly what a DBA opening psql would type by hand. Compare with an `INT` column where you'd have to keep `0 = TOTAL_METRIC_VOLUME, 1 = POSITIVE_STREAK, …` documented somewhere fragile.
- **Database-side validation.** Inserting an unknown value (typo in a SQL script, manual fix-up gone wrong) raises `invalid input value for enum` immediately, instead of silently storing `99` and breaking the application weeks later.
- **Self-documenting tables.** `SELECT * FROM analyst_proposals` shows you `pending` / `implemented` / `rejected` in the `status` column — no decoder ring required.
- **Migrations are explicit.** Adding a new `ConditionKey` value requires a migration that emits `ALTER TYPE condition_key ADD VALUE 'new_value'` — the schema change is visible and reviewable, not silently inferred.

**Caveat — naming conventions.** `ConditionKey` uses `UPPER_SNAKE_CASE` CLR member names (e.g. `TOTAL_METRIC_VOLUME`). Npgsql's default snake_case translator maps these to lowercase Postgres labels (`total_metric_volume`) correctly. If you ever add an enum with `MixedCase` members and find queries failing with `invalid input value`, the translator is the first place to look.

#### Native enums vs. plain enums (`TimeSlot`)

Not every enum needs to be native. **`TimeSlot`** (`Morning`, `Afternoon`, `Evening`, `Night`, `Anytime`) is an *internal* value embedded inside the `schedule_rule` JSONB document. It never appears as a column name in a `WHERE` clause and isn't queried directly, so the cost of native enum machinery isn't justified. It stays a plain C# enum and serializes to JSON as a string. The general rule: **native enum if the value is a column you'll filter or join on; plain enum if it lives inside JSONB.**

### 7.5 Quick reference — the database "passport"

| Property | Value |
|---|---|
| **Engine** | PostgreSQL 15 |
| **Driver** | Npgsql.EntityFrameworkCore.PostgreSQL 9.0.3 |
| **Naming convention** | `snake_case` (auto-applied) |
| **Datetime storage** | `timestamp with time zone` (UTC), local-date computed per-user via `AT TIME ZONE u.timezone` |
| **Surrogate keys** | `UUID` for user-scoped tables, `serial` for dictionaries |
| **Soft delete** | `is_archived BOOLEAN` on Category / Habit / UserHabit / Achievement, enforced by `trg_soft_delete` |
| **Native enums** | `frequency_type`, `proposal_status`, `condition_key` |
| **Extensions** | `btree_gist` (for `no_overlapping_sleep`) |
| **JSONB columns** | `user_habits.schedule_rule`, `sleep_recommendations.sleep_plan` |
| **TEXT[] columns** | `affect_entries.context_tags` (GIN-indexed), `sleep_logs.tags` |
| **Triggers** | `trg_users_updated_at`, `trg_on_habit_execution`, `trg_soft_delete` ×4 |
| **Functions** | `update_updated_at_column`, `fn_soft_delete`, `fn_on_habit_execution`, `fn_calc_current_streak`, `fn_calculate_daily_affect_centroid`, `fn_is_habit_scheduled` |
| **Stored procedures** | `sp_daily_streak_maintenance`, `sp_update_achievement_progress`, streak resync proc |
| **Virtual views** | `vw_user_daily_summary`, `vw_user_habit_stats`, `vw_user_category_balance`, `vw_user_correlations` |
| **Materialized views** | `mvw_global_habit_stats`, `mvw_achievement_rarity`, `mvw_analyst_proposal_impact`, `mvw_sleep_recommendation_effectiveness` |
| **Notable constraints** | `no_overlapping_sleep` (GiST EXCLUDE), PAD score range CHECKs, `ck_sleep_end_after_start`, `ck_sleep_quality_range` |

The takeaway: this database is engineered as a high-performance relational system *tailored for analytics on user behaviour*. The C# `Application` layer is intentionally thin over a PostgreSQL layer that does its own enforcement, its own counting, and its own caching. When you change the schema, you are not just editing storage — you are editing part of the running application.

---

## Closing thought

You're not lost — you built a system with serious architectural discipline (Clean Architecture, Outbox, Strategy pattern, CQRS-lite). The complexity that feels overwhelming is the same complexity that made it *work* the first time. Every time you come back to add a feature, follow the layer order: **DTO → Service → Controller → API helper → page**. Every time you read code, follow the request lifecycle from §3. The codebase will start to feel small.

Welcome home.