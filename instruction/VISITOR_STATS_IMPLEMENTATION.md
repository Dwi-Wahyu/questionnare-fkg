# Task: Implement Visitor Statistics Feature

## Context
Stack: TanStack Start (React) + TanStack Router (file-based routes) + Drizzle ORM (MySQL) + Bun. Follow existing conventions exactly — this is a Bahasa Indonesia admin panel (FKG Unhas Tracer Study). Do not invent new patterns; mirror the ones cited below.

Reference files (read these first):
- `src/server/db/schema.ts` — Drizzle table definitions
- `src/server/auth.ts` — `getUserFromSession()`, `SessionUser`
- `src/server/authFunctions.ts` — cookie set/get pattern via `getCookie` / `setCookie` from `@tanstack/react-start/server`
- `src/server/adminSurveyFunctions.ts` — `assertUser()` / `assertAdmin()` guards, `getAdminDashboardStatsFn` stat-query pattern
- `src/server/surveyFunctions.ts` — `getPublicLandingStatsFn` short-TTL in-memory cache pattern (`statsCache`)
- `src/routes/__root.tsx` — root loader, runs on every navigation, receives `location`
- `src/routes/admin/index.tsx` — existing 4-stat-card grid UI to copy the visual style from

## Goal
Add a visitor-tracking system with:
1. A DB-backed visit log.
2. Cookie-based dedup so **one browser only ever counts as one visit per rolling day**, no matter how many pages/clicks it makes that day (this is the anti-self-bottleneck requirement — no DB write on repeat views).
3. Three stat cards — **Hari Ini (Today)**, **Bulan Ini (This Month)**, **Total** — shown in the admin dashboard.

---

## Step 1 — Schema: add `visitor_logs` table

Edit `src/server/db/schema.ts`, append:

```ts
// ─────────────────────────────────────────────────────────────
// VISITOR LOGS (public-site traffic, deduped 1x/day via cookie)
// ─────────────────────────────────────────────────────────────
export const visitorLogs = mysqlTable(
	"visitor_logs",
	{
		id: int("id").autoincrement().primaryKey(),
		// UUID stored in the visitor's cookie — one row per visitorId per day.
		visitorId: varchar("visitor_id", { length: 100 }).notNull(),
		path: varchar("path", { length: 255 }),
		visitedAt: timestamp("visited_at").notNull().defaultNow(),
	},
	(table) => ({
		visitorIdx: index("visitor_logs_visitor_idx").on(table.visitorId),
		visitedAtIdx: index("visitor_logs_visited_at_idx").on(table.visitedAt),
	}),
);
```

Generate + apply the migration using whatever scripts the project already defines (check `package.json`):

```bash
bun run db:generate   # or: bunx drizzle-kit generate
bun run db:migrate    # or: bunx drizzle-kit migrate
```

If those scripts don't exist, fall back to `bunx drizzle-kit generate --config=drizzle.config.ts` and inspect the generated SQL under the migrations folder before applying — follow the existing numbered-migration convention (`000N_*.sql`) already in the repo.

---

## Step 2 — Server functions: `src/server/visitorFunctions.ts` (new file)

```ts
import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { and, gte, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { visitorLogs } from "./db/schema";

const VISITOR_COOKIE = "visitor_id";
const ONE_DAY_SECONDS = 86400;

/**
 * Call once per public page load (from a route loader).
 * - If the visitor cookie already exists -> no-op, no DB write.
 *   (This is what prevents a new "visitor" being logged on every click.)
 * - If it doesn't exist -> mint one, set a 1-day cookie, write one log row.
 * Never throws — a tracking failure must not break page rendering.
 */
export const trackVisitFn = createServerFn({ method: "POST" })
	.validator((data: { path?: string } | undefined) => data ?? {})
	.handler(async ({ data }) => {
		try {
			const existing = getCookie(VISITOR_COOKIE);
			if (existing) {
				return { tracked: false };
			}

			const visitorId = randomUUID();
			setCookie(VISITOR_COOKIE, visitorId, {
				path: "/",
				httpOnly: true,
				sameSite: "lax",
				maxAge: ONE_DAY_SECONDS,
			});

			await db.insert(visitorLogs).values({
				visitorId,
				path: data.path?.slice(0, 255),
			});

			return { tracked: true };
		} catch (err) {
			console.error("trackVisitFn failed:", err);
			return { tracked: false };
		}
	});

// Short in-memory cache, same idea as getPublicLandingStatsFn's statsCache,
// so the admin dashboard doesn't hammer the DB on every load/refresh.
let statsCache: { data: VisitorStats | null; timestamp: number } = {
	data: null,
	timestamp: 0,
};

export interface VisitorStats {
	today: number;
	thisMonth: number;
	total: number;
}

export const getVisitorStatsFn = createServerFn({ method: "GET" }).handler(
	async (): Promise<VisitorStats> => {
		const now = Date.now();
		if (statsCache.data && now - statsCache.timestamp < 60_000) {
			return statsCache.data;
		}

		const startOfDay = new Date();
		startOfDay.setHours(0, 0, 0, 0);

		const startOfMonth = new Date();
		startOfMonth.setDate(1);
		startOfMonth.setHours(0, 0, 0, 0);

		const [[todayRow], [monthRow], [totalRow]] = await Promise.all([
			db
				.select({ count: sql<number>`count(*)` })
				.from(visitorLogs)
				.where(gte(visitorLogs.visitedAt, startOfDay)),
			db
				.select({ count: sql<number>`count(*)` })
				.from(visitorLogs)
				.where(gte(visitorLogs.visitedAt, startOfMonth)),
			db.select({ count: sql<number>`count(*)` }).from(visitorLogs),
		]);

		const data: VisitorStats = {
			today: todayRow?.count ?? 0,
			thisMonth: monthRow?.count ?? 0,
			total: totalRow?.count ?? 0,
		};

		statsCache = { data, timestamp: now };
		return data;
	},
);
```

Notes:
- Do **not** gate `getVisitorStatsFn` behind `assertAdmin()` blindly if you want it visible to `visitor`-role staff too — match whatever access level the rest of `admin/index.tsx` uses (currently `assertUser()`-equivalent, since both `admin` and `visitor` roles can see the dashboard). Add `await assertUser()` at the top of the handler by importing it, or duplicate the same guard used in `adminSurveyFunctions.ts` if it isn't exported — check that file first.

---

## Step 3 — Wire tracking into page loads (root loader)

Edit `src/routes/__root.tsx`. The root loader already runs on every navigation and receives `location`, so this is the single place to hook in — do **not** duplicate tracking calls into individual page loaders.

```ts
import { trackVisitFn } from "../server/visitorFunctions";

// ...
loader: async ({ location }) => {
  const user = await getSessionFn();

  // Only count real public visits — exclude admin panel, auth, and API routes
  // so staff/admin traffic never inflates visitor stats.
  const path = location.pathname;
  const isTrackable =
    !path.startsWith("/admin") &&
    !path.startsWith("/api") &&
    path !== "/login";

  if (isTrackable) {
    await trackVisitFn({ data: { path } });
  }

  return { user };
},
```

Why this placement is safe against self-bottlenecking:
- `trackVisitFn` only writes to the DB the *first* time a browser hits the site without a `visitor_id` cookie. Every subsequent navigation/click within the same day reads the cookie, finds it present, and returns immediately with **zero DB writes**.
- The cookie's `maxAge` is exactly one day, so a given browser can only ever produce at most one new row per calendar day, regardless of click volume.

---

## Step 4 — Admin dashboard UI: 3 new stat cards

Edit `src/routes/admin/index.tsx`.

1. Import the fetcher and an icon:
```ts
import { Users } from "lucide-react";
import { getVisitorStatsFn } from "../../server/visitorFunctions";
```

2. Fetch alongside the existing stats in the loader:
```ts
loader: async () => {
  const [stats, surveysList, visitorStats] = await Promise.all([
    getAdminDashboardStatsFn(),
    getAdminSurveysListFn(),
    getVisitorStatsFn(),
  ]);
  return { stats, surveysList, visitorStats };
},
```

3. Destructure it in the component:
```ts
const { stats, surveysList, visitorStats } = Route.useLoaderData();
```

4. Add a new labeled section with a 3-card grid, styled identically to the existing "Stat Cards Grid" block (same classes: `bg-white border border-outline-variant rounded-xl p-6 shadow-sm flex items-center justify-between`). Place it directly below the existing 4-card grid:

```tsx
{/* Visitor Stats */}
<div>
  <h3 className="text-lg font-bold text-[#4A0000] text-left mb-3">
    Statistik Pengunjung
  </h3>
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-sm flex items-center justify-between">
      <div className="space-y-1 text-left">
        <span className="text-xs font-bold text-[#434652] uppercase tracking-wider">
          Hari Ini
        </span>
        <p className="text-3xl font-bold text-[#4A0000]">
          {visitorStats.today}
        </p>
      </div>
      <div className="p-3 bg-sky-100 text-sky-800 rounded-full">
        <Users className="h-8 w-8 block" />
      </div>
    </div>

    <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-sm flex items-center justify-between">
      <div className="space-y-1 text-left">
        <span className="text-xs font-bold text-[#434652] uppercase tracking-wider">
          Bulan Ini
        </span>
        <p className="text-3xl font-bold text-[#4A0000]">
          {visitorStats.thisMonth}
        </p>
      </div>
      <div className="p-3 bg-violet-100 text-violet-800 rounded-full">
        <Users className="h-8 w-8 block" />
      </div>
    </div>

    <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-sm flex items-center justify-between">
      <div className="space-y-1 text-left">
        <span className="text-xs font-bold text-[#434652] uppercase tracking-wider">
          Total
        </span>
        <p className="text-3xl font-bold text-[#4A0000]">
          {visitorStats.total}
        </p>
      </div>
      <div className="p-3 bg-rose-100 text-rose-800 rounded-full">
        <Users className="h-8 w-8 block" />
      </div>
    </div>
  </div>
</div>
```

---

## Step 5 — Verification checklist

Run through all of these before considering the task done:

- [ ] `bunx tsc --noEmit` (or the project's typecheck script) passes.
- [ ] Migration file generated and applied cleanly against a local/dev DB; `visitor_logs` table exists.
- [ ] Load `/` in an incognito/private window with no cookies:
  - [ ] One row is inserted into `visitor_logs`.
  - [ ] A `visitor_id` cookie is set with `Max-Age=86400`.
- [ ] Reload `/` and click around the public site (survey list, survey detail) several times in the same session:
  - [ ] **No additional rows** are inserted (confirm via `SELECT COUNT(*) FROM visitor_logs`).
- [ ] Delete the `visitor_id` cookie manually and reload:
  - [ ] Exactly one new row is inserted.
- [ ] Visit `/admin` (or `/login`, `/admin/*`) while logged in as admin:
  - [ ] No new `visitor_logs` row is created for those requests.
- [ ] `/admin` dashboard renders the 3 new cards with correct counts:
  - [ ] Today matches rows since local midnight.
  - [ ] This Month matches rows since the 1st of the current month.
  - [ ] Total matches full table count.
- [ ] Confirm `getVisitorStatsFn`'s 60s cache means the dashboard doesn't run 3 fresh COUNT queries on every single page refresh.

## Non-goals / explicitly out of scope
- No IP-based tracking, geolocation, or device/browser fingerprinting beyond the random UUID cookie.
- No admin UI to reset/clear visitor logs (add only if separately requested).
- No distinction between "unique visitor" vs "pageview" beyond the 1-per-day-per-cookie dedup described above.
