# Visitor Statistics Implementation Summary

## Modified Files
- `src/server/db/schema.ts`
- `src/server/visitorFunctions.ts` (New file)
- `src/routes/__root.tsx`
- `src/routes/admin/index.tsx`

## Logic Changes
- **Database Schema**: Added `visitor_logs` table (`id`, `visitor_id`, `path`, `visited_at`) with indexes on `visitor_id` and `visited_at`.
- **Visitor Tracking (`src/server/visitorFunctions.ts`)**: Implemented `trackVisitFn` server function which sets a 1-day `visitor_id` HTTP-only cookie and inserts a row into `visitor_logs` only on initial visit. Subsequent page visits within the rolling 24-hour window find the cookie and return immediately without DB writes (deduplication / anti-self-bottleneck).
- **Visitor Stats Query (`src/server/visitorFunctions.ts`)**: Implemented `getVisitorStatsFn` server function guarded with `assertUser()`. Computes counts for today (since midnight), this month (since 1st of month), and total visits. Implemented 60-second in-memory caching (`statsCache`) to prevent DB query strain on dashboard refreshes.
- **Root Loader Integration (`src/routes/__root.tsx`)**: Intercepted page navigations in the root route loader and triggered `trackVisitFn` for trackable public routes (excluding `/admin`, `/api`, and `/login`).
- **Admin Dashboard UI (`src/routes/admin/index.tsx`)**: Updated dashboard loader to fetch `getVisitorStatsFn()` in parallel with existing metrics. Rendered 3 new stat cards ("Hari Ini", "Bulan Ini", "Total") styled consistently with existing dashboard UI cards.

## Impact on Graph
- Introduced `src/server/visitorFunctions.ts` as a new node linking `visitor_logs` DB schema, `@tanstack/react-start` server functions, and `getUserFromSession` auth guard.
- Established a new edge from `src/routes/__root.tsx` to `src/server/visitorFunctions.ts` (`trackVisitFn`).
- Established a new edge from `src/routes/admin/index.tsx` to `src/server/visitorFunctions.ts` (`getVisitorStatsFn`).
