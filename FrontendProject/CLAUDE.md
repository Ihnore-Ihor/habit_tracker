# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start Vite dev server (https://localhost:5173)
npm run build      # production build → dist/
npm run lint       # ESLint check
npm run preview    # serve the production build locally
```

No test runner is configured yet.

**First-time setup:** copy `.env.example` to `.env` and set `VITE_API_BASE_URL` to the running ASP.NET Core backend (default `https://localhost:7152`).

## Architecture Overview

**Stack:** React 19 (JS, no TS) · Vite 7 · React Router 7 · Axios · Tailwind CSS 3 · Framer Motion 12

### Auth & role routing

`src/context/AuthContext.jsx` is the single source of truth for auth. It exposes `{ user, role, isAuthenticated, login, register, logout }` via `useAuth()` (re-exported from `src/hooks/useAuth.js`).

Three roles are defined in `ROLES = { USER, CONTENT_MANAGER, ANALYST }`.

`src/routes/AppRouter.jsx` wraps each role-specific route in `<ProtectedRoute allow={[ROLES.X]}>`. Unauthenticated users are redirected to `/auth/login`; wrong-role users go to `/forbidden`. The `/` root auto-redirects to the correct home based on role.

The JWT is stored in `localStorage` under the key `harmony.token`. On every Axios request, `src/api/client.js` attaches it as a `Bearer` header. A 401 response clears the token and redirects to `/auth/login`. The `AuthContext` also listens for `storage` events to sync across browser tabs.

`src/utils/jwt.js` handles ASP.NET Core's long-form claim URIs (e.g. `http://schemas.microsoft.com/ws/2008/06/identity/claims/role`) alongside short-form ones (`role`, `sub`, `name`, `email`).

### API layer

All HTTP calls go through the singleton `src/api/client.js` (Axios instance). Endpoint paths live in `src/api/endpoints.js`. Feature-specific request functions (e.g. `loginRequest`, `registerRequest`) live in `src/api/*.js` and call the shared instance.

### Design system — "The Apothecary Diaries"

**Base palette** — configured in `tailwind.config.js` and mirrored as CSS variables in `src/styles/globals.css`:

| Token | Hex | Pavilion meaning |
|---|---|---|
| `rice` | `#F9F6EE` | page background |
| `ink` | `#2D2D2D` | body text |
| `jade` / `jade-deep` | `#8FBC8F` / `#6B9B6B` | Habits / Health |
| `crystal` / `crystal-solid` | `rgba(168,213,226,0.5)` / `#A8D5E2` | Sleep / Study |
| `garnet` | `#C85A54` | Affect / Failed states |
| `diamond` | `#B8A888` | Gamification |

Use `bg-jade/15`, `text-garnet`, etc. for pavilion-tinted UI. The globals also expose `font-serif` (Cormorant Garamond + Noto Serif SC) and `font-seal` (Noto Serif SC) — use for headings and hanzi characters respectively.

**Named CSS classes from globals.css** (not Tailwind utilities):
- `.chinese-frame` / `.chinese-frame--lg` — ornate border-image frame; swap the SVG via `style={{ '--frame-url': 'url(...)' }}`
- `.ink-seal` — garnet filled badge for hanzi seals
- `.ink-stroke` — brushed ink underline gradient
- `.pavilion-glow-jade/garnet/diamond` — coloured box-shadow glow
- `.blend-multiply` / `.blend-overlay` — mix-blend-mode helpers
- `.tint-jade/garnet/diamond/crystal` — tints `<img>` SVGs via `currentColor`
- `.safe-top` / `.safe-bottom` — iOS safe-area padding

### SVG asset conventions

All custom SVGs are in `src/assets/`. Key categories:
- **Frames:** `chinese-border-frame1.svg` → `chinese-border-frame21.svg` — use via `<ChineseFrame frame={N} size="md|lg">`. The component eagerly globs all 21 at build time.
- **Patterns:** `wave-pattern.svg`, `wave-outline-patter.svg`, `curls-pattern1/2.svg`, `square-pattern.svg`, `strip-pattern-*.svg`, `triangle-pattern.svg`, `fan-pattern*.svg`, `round-pattern2.svg` — apply as `bg-repeat` background images or `<img>` with `.blend-multiply` + low opacity.
- **Decorative:** `bonsai-tree.svg`, `circles-sign.svg`, `icon-lotos-slider.svg`, `bamboo-slips.svg`, `bamboo-slips-single.svg`, `chinese-arc.svg`

When blending a pattern over rice-paper: put the pattern in a **separate child div** (never the same element that has `background-color`), then apply `mix-blend-multiply`.

### Component conventions

**`ChineseFrame`** — the canonical way to add an ornate border. Pass `frame={1..21}`, `size="lg"` for auth/hero contexts. Always provide `style={{ backgroundColor: '#F9F6EE' }}` when the frame sits over a busy background.

**`Button`** — Framer `whileTap` spring; variants `jade | garnet | diamond | ghost`.

**`Input`** — controlled, with `label`, `error`, `helper`, and `icon` slot. Uses `forwardRef`.

**`AuthShell`** — shared layout for Login/Register: fixed `wave-pattern.svg` background tile (isolated child div to allow `mix-blend-multiply`), centered header stack (circles halo → seal → bonsai → title), `ChineseFrame`-wrapped form card.

**`StreakWidget`** — WebGL Yin-Yang; **do not modify its internal WebGL logic**. Props: `yin` (Good count) and `yang` (Avoid count).

### Animation conventions (Framer Motion)

- Page-level: `staggerChildren` container variant (`pageVar`) + spring children variants.
- Lists: `cardListVar` (stagger 0.07s) → `cardVar` (spring stiffness 220, damping 24).
- Section entries: `sectionVar` (spring stiffness 180, damping 22, y 22→0).
- Interactive: `whileTap={{ scale: 0.96..0.97 }}` on buttons/cards.
- Route transitions: `<AnimatePresence mode="wait">` wraps `<Routes>` in `AppRouter`.

### Role-specific pages

| Route | Role | File |
|---|---|---|
| `/dashboard` | `User` | `src/pages/Dashboard.jsx` |
| `/catalog` | `ContentManager` | `src/pages/ContentManagerHome.jsx` |
| `/analytics` | `Analyst` | `src/pages/AnalystHome.jsx` |

Dashboard uses static seed data for habits — in Phase 3 this will be replaced with API calls from `src/api/` modules. The `failHabit()` local state handler is the pattern to extend for optimistic updates.
