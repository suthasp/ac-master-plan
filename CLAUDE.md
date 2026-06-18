# CLAUDE.md

## Project Overview

This project (`ac-master-plan`) is a **Next.js** web application using the App Router, TypeScript, and Supabase as the backend.

Tech stack:

- Next.js 14 (App Router)
- React 18
- TypeScript 5
- Tailwind CSS 3
- Supabase (`@supabase/ssr`, `@supabase/supabase-js`) — auth + Postgres
- AG Grid (`ag-grid-react`, `ag-grid-community`) — data grid UI
- ESLint (`eslint-config-next`)
- GitHub for version control

Primary goal:

Build a maintainable, secure, and lightweight Next.js application with Supabase, deployable to platforms such as Vercel (or any Node host).

---

## Development Principles

### 1. Prefer Server Components

- Default to React Server Components; add `"use client"` only when a component needs state, effects, or browser APIs (e.g. AG Grid).
- Fetch data on the server where possible; keep secrets out of client components.

### 2. Supabase Access

- Use the SSR helpers in `src/lib/supabase` to create clients (server vs. browser).
- Never expose the service-role key to the client — only `NEXT_PUBLIC_*` vars are safe in the browser.
- Enforce data access with Row Level Security (RLS) in Supabase, not just in app code. See `supabase_schema.sql`.

### 3. Auth

- Auth flows go through Supabase; `src/middleware.ts` handles session refresh / route protection.

---

## Coding Standards

### Next.js / TypeScript Best Practices

Use:

- App Router conventions (`page.tsx`, `layout.tsx`, `route.ts`)
- Route Handlers under `src/app/api/**` for backend endpoints
- TypeScript types for props, API payloads, and DB rows
- Server Components by default; Client Components only when needed
- Environment variables via `.env.local` (never commit secrets)
- Tailwind utility classes for styling

Avoid:

- Hardcoded secrets or keys in source
- Business logic inside JSX
- Leaking server-only env vars to the client
- Raw `any` types when a concrete type is feasible

---

## Folder Structure

```text
src/
 ├── app/
 │    ├── api/          # Route Handlers (auth, entries, sites)
 │    ├── dashboard/
 │    ├── login/
 │    ├── layout.tsx
 │    ├── page.tsx
 │    └── globals.css
 ├── components/        # Reusable UI (e.g. PlanGrid.tsx)
 ├── lib/
 │    └── supabase/     # Supabase client factories
 └── middleware.ts      # Session / route protection

public/                 # Static assets
supabase_schema.sql     # DB schema + RLS policies
```

---

## Common Commands

```bash
npm run dev     # Start dev server (http://localhost:3000)
npm run build   # Production build
npm run start   # Run the production build
npm run lint    # ESLint
```
