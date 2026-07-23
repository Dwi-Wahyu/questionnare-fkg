# Task: Replace SSE-based live presence/auto-refresh with polling (fixes Cloudflare Tunnel buffering bug)

Target repo: `tracerstudy` (TanStack Start + Bun + Drizzle/MySQL, deployed via PM2 + `cloudflared` tunnel).

## 0. Read this first — root cause

The app currently pushes "someone is filling this survey" (presence) and "a
new answer arrived, refresh the Jawaban tab" (auto-refresh) via **Server-Sent
Events** (`EventSource` + `ReadableStream`), implemented in:

- `src/server/liveRegistry.ts`
- `src/routes/api/surveys.$surveyId.live.ts`
- `src/routes/api/surveys.live.ts`
- `src/hooks/useSurveyLive.ts`
- inline `EventSource` in `src/routes/admin/surveys.index.tsx`

This works locally (client connects directly to Bun on `:3438`), but not in
production, where traffic is routed through a **Cloudflare Tunnel**
(`cloudflared`). This is a long-standing, widely-reported limitation, not a
bug in this codebase:

> Cloudflare's edge (and `cloudflared`) buffers long-lived `GET`
> `text/event-stream` responses and only flushes them to the browser when the
> connection closes (or a large internal buffer fills). Adding
> `Cache-Control: no-cache`, `X-Accel-Buffering: no`, heartbeats, etc. does
> **not** reliably fix it — this has been an open issue since 2020
> (`cloudflare/cloudflared#199`, `#1449`, and many Cloudflare Community
> threads). It only affects `GET`-streamed SSE; POST/one-shot requests are
> unaffected.

That's why the PM2 log shows the server correctly detecting connects,
disconnects, and broadcasting `presence`/`answer` events — the **server**
is doing everything right. The events are just stuck in Cloudflare's buffer
and never reach the browser in real time.

**Decision: do NOT introduce Redis for this.** Redis pub/sub only solves the
problem of synchronizing state *across multiple app processes/instances*.
This app runs as a single PM2 instance (`instances: 1`, `fork` mode) talking
to MySQL — there is only one process, so the existing in-memory
(`globalThis`) registry is already 100% consistent. Redis would add an
operational dependency while fixing nothing, because the actual failure is
in the Cloudflare Tunnel transport layer, not in cross-process state.
(See the "When Redis would actually help" section at the end if the
deployment topology changes later.)

**The fix:** replace the SSE transport with short-interval polling +
heartbeats over plain request/response calls (TanStack `createServerFn`).
Polling is immune to this class of proxy/tunnel buffering because each
request is a normal, short-lived HTTP round trip — nothing is held open.
For an admin dashboard (presence badge + answer count), a 4–5s refresh
cadence is indistinguishable from "live" to a human and is trivial to keep
correct.

---

## 1. Replace `src/server/liveRegistry.ts`

Delete the file and create `src/server/livePresence.ts`:

```ts
// src/server/livePresence.ts
const g = globalThis as any;

const STALE_MS = 12_000; // a filler is considered "gone" if no heartbeat in 12s

interface PresenceStore {
	fillers: Map<number, Map<string, number>>; // surveyId -> clientId -> lastSeen(ms)
	lastActivity: Map<number, number>; // surveyId -> ms timestamp of most recent submitted answer
}

export const presenceStore: PresenceStore =
	g.__presenceStore ||
	(g.__presenceStore = {
		fillers: new Map(),
		lastActivity: new Map(),
	});

function pruneStale(surveyId: number) {
	const map = presenceStore.fillers.get(surveyId);
	if (!map) return;
	const now = Date.now();
	for (const [clientId, lastSeen] of map) {
		if (now - lastSeen > STALE_MS) map.delete(clientId);
	}
	if (map.size === 0) presenceStore.fillers.delete(surveyId);
}

export function heartbeat(surveyId: number, clientId: string) {
	if (!presenceStore.fillers.has(surveyId)) {
		presenceStore.fillers.set(surveyId, new Map());
	}
	presenceStore.fillers.get(surveyId)!.set(clientId, Date.now());
}

export function removeFiller(surveyId: number, clientId: string) {
	presenceStore.fillers.get(surveyId)?.delete(clientId);
}

export function getPresenceCount(surveyId: number): number {
	pruneStale(surveyId);
	return presenceStore.fillers.get(surveyId)?.size ?? 0;
}

export function getAggregatePresence(): Record<number, number> {
	const data: Record<number, number> = {};
	for (const surveyId of Array.from(presenceStore.fillers.keys())) {
		const count = getPresenceCount(surveyId);
		if (count > 0) data[surveyId] = count;
	}
	return data;
}

export function markAnswered(surveyId: number) {
	presenceStore.lastActivity.set(surveyId, Date.now());
}

export function getLastActivity(surveyId: number): number {
	return presenceStore.lastActivity.get(surveyId) ?? 0;
}
```

## 2. Add server functions

Create `src/server/livePresenceFunctions.ts`:

```ts
// src/server/livePresenceFunctions.ts
import { createServerFn } from "@tanstack/react-start";
import {
	getAggregatePresence,
	getLastActivity,
	getPresenceCount,
	heartbeat,
	removeFiller,
} from "./livePresence";

export const heartbeatFn = createServerFn({ method: "POST" })
	.validator(
		(data: {
			surveyId: number;
			clientId: string;
			role: "filler" | "viewer";
		}) => data,
	)
	.handler(async ({ data }) => {
		if (data.role === "filler") {
			heartbeat(data.surveyId, data.clientId);
		}
		return { success: true };
	});

export const leaveFillerFn = createServerFn({ method: "POST" })
	.validator((data: { surveyId: number; clientId: string }) => data)
	.handler(async ({ data }) => {
		removeFiller(data.surveyId, data.clientId);
		return { success: true };
	});

export const getLiveStatusFn = createServerFn({ method: "GET" })
	.validator((data: { surveyId: number }) => data)
	.handler(async ({ data }) => {
		return {
			presenceCount: getPresenceCount(data.surveyId),
			lastActivityAt: getLastActivity(data.surveyId),
		};
	});

export const getAggregatePresenceFn = createServerFn({
	method: "GET",
}).handler(async () => {
	return getAggregatePresence();
});
```

## 3. Update `src/server/surveyFunctions.ts`

- Remove the import of `broadcast` from `./liveRegistry`.
- Import `markAnswered` from `./livePresence` instead.
- In `submitResponseFn`, replace:

```ts
// Notify live SSE viewers that a response was submitted
try {
	broadcast(data.surveyId, "answer", { at: Date.now() });
} catch (err) {
	console.error("Failed to broadcast response notification:", err);
}
```

with:

```ts
// Mark this survey's last-activity timestamp so polling viewers pick it up.
markAnswered(data.surveyId);
```

## 4. Delete the SSE route files

Delete:
- `src/routes/api/surveys.$surveyId.live.ts`
- `src/routes/api/surveys.live.ts`

(Also remove `notifySurveyAnswered` — it's no longer called anywhere; confirm
with a repo-wide search before deleting, in case something else imports it.)

Regenerate the route tree afterward (TanStack Router codegen), e.g.:
```bash
bun run build
# or whatever the repo's route-generation script is (check package.json),
# routeTree.gen.ts must no longer reference the deleted /api/surveys/... routes.
```

## 5. Rewrite `src/hooks/useSurveyLive.ts`

Keep the exact same external signature — `useSurveyLive(surveyId, role, onAnswer)
=> presenceCount` — so every consuming component keeps working unchanged.

```ts
import { useEffect, useRef, useState } from "react";
import {
	getLiveStatusFn,
	heartbeatFn,
	leaveFillerFn,
} from "../server/livePresenceFunctions";

const POLL_MS = 4000;
const HEARTBEAT_MS = 5000;

export function useSurveyLive(
	surveyId: number,
	role: "filler" | "viewer",
	onAnswer?: () => void,
) {
	const [presenceCount, setPresenceCount] = useState(0);
	const onAnswerRef = useRef(onAnswer);
	const lastActivityRef = useRef<number | null>(null);
	const clientIdRef = useRef<string>(
		typeof crypto !== "undefined" && crypto.randomUUID
			? crypto.randomUUID()
			: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
	);

	useEffect(() => {
		onAnswerRef.current = onAnswer;
	}, [onAnswer]);

	useEffect(() => {
		if (!surveyId) return;
		let cancelled = false;
		const clientId = clientIdRef.current;
		lastActivityRef.current = null; // reset baseline per survey/role mount

		async function poll() {
			try {
				const status = await getLiveStatusFn({ data: { surveyId } });
				if (cancelled) return;
				setPresenceCount(status.presenceCount);

				if (lastActivityRef.current === null) {
					// First tick after mount: just record the baseline, don't fire onAnswer
					// (avoids refetching immediately on every navigation to the page).
					lastActivityRef.current = status.lastActivityAt;
				} else if (status.lastActivityAt > lastActivityRef.current) {
					lastActivityRef.current = status.lastActivityAt;
					onAnswerRef.current?.();
				}
			} catch (err) {
				console.error(
					`[useSurveyLive] poll failed for surveyId=${surveyId}:`,
					err,
				);
			}
		}

		async function sendHeartbeat() {
			try {
				await heartbeatFn({ data: { surveyId, clientId, role } });
			} catch (err) {
				console.error(
					`[useSurveyLive] heartbeat failed for surveyId=${surveyId}:`,
					err,
				);
			}
		}

		poll();
		const pollInterval = setInterval(poll, POLL_MS);

		let heartbeatInterval: ReturnType<typeof setInterval> | undefined;
		if (role === "filler") {
			sendHeartbeat();
			heartbeatInterval = setInterval(sendHeartbeat, HEARTBEAT_MS);
		}

		return () => {
			cancelled = true;
			clearInterval(pollInterval);
			if (heartbeatInterval) clearInterval(heartbeatInterval);
			if (role === "filler") {
				// Best-effort immediate leave so the badge drops without waiting
				// for the 12s stale timeout. Fire-and-forget on unmount.
				leaveFillerFn({ data: { surveyId, clientId } }).catch(() => {});
			}
		};
	}, [surveyId, role]);

	return presenceCount;
}
```

Notes:
- `POLL_MS=4000` / `HEARTBEAT_MS=5000` / `STALE_MS=12000` (in
  `livePresence.ts`) give a badge that updates within ~4-5s and clears within
  ~10-12s of a filler leaving — tune these if you want it snappier, at the
  cost of more requests.
- The debounce-merge behavior from the old SSE `answer` handler (merging
  bursts) is no longer needed: polling naturally coalesces bursts, since
  multiple submissions between two polls only trigger one `onAnswer()` call.

## 6. Update `src/routes/admin/surveys.index.tsx`

Replace the inline `EventSource` block:

```ts
useEffect(() => {
	const es = new EventSource("/api/surveys/live");
	es.addEventListener("presence", (e) => {
		try {
			const data = JSON.parse(e.data);
			if (data && typeof data === "object") {
				setLiveCounts(data);
			}
		} catch (err) {
			console.error("Error parsing aggregate presence SSE:", err);
		}
	});
	return () => {
		es.close();
	};
}, []);
```

with a poll against the new aggregate function:

```ts
import { getAggregatePresenceFn } from "../../server/livePresenceFunctions";

// ...

useEffect(() => {
	let cancelled = false;
	async function poll() {
		try {
			const data = await getAggregatePresenceFn();
			if (!cancelled) setLiveCounts(data);
		} catch (err) {
			console.error("Error fetching aggregate presence:", err);
		}
	}
	poll();
	const interval = setInterval(poll, 4000);
	return () => {
		cancelled = true;
		clearInterval(interval);
	};
}, []);
```

## 7. Verify all consumers still compile

- `src/routes/admin/surveys.$surveyId.tsx` — `useSurveyLive(surveyId, "viewer", () => {...})`
  → no change needed, same hook signature.
- `src/routes/survey.$surveySlug.tsx` — `useSurveyLive(survey?.id || 0, "filler")`
  → no change needed, same hook signature.

Search the repo for any other `EventSource(` or `liveRegistry` references and
update/remove them:
```bash
grep -rn "EventSource\|liveRegistry\|notifySurveyAnswered" src
```

## 8. Test plan

1. `bun run build && bun run start` locally, confirm presence badge + answer
   auto-refresh still work (same as before, now via polling).
2. Deploy to production behind the `cloudflared` tunnel.
3. Open the admin survey detail page in one browser/tab, submit a response
   from another (incognito) tab.
4. Confirm within ~5s: the "sedang mengisi" badge appears while the second
   tab is on the survey-taking page, and the Jawaban tab / counts refresh
   after submission — without needing to reload.
5. Check `logs/pm2-out.log` — you should now see regular
   `getLiveStatusFn`/`heartbeatFn` server-function invocations instead of the
   old `[SSE Server] ...` log lines (remove/replace those console.log calls
   if you added logging inside the new functions, or add new ones for
   observability).

## 9. Cleanup

- Remove the now-unused `SSE_LOG_ANALYSIS.md` / `FIX_SSE_AUTO_REFRESH.md`
  docs if they only describe the old approach, or append a short note that
  the transport was migrated to polling because of Cloudflare Tunnel
  buffering, linking to this file.
- Run `graphify update .` (per `GRAPH_REPORT.md`) after these changes so the
  code graph reflects the new files/removed files.

---

## Appendix: when Redis *would* actually help here

Keep using the in-memory `globalThis` store as long as:
- `ecosystem.config.js` keeps `instances: 1`, `exec_mode: "fork"`.
- There is exactly one server process/box serving traffic.

Redis (or another shared store) becomes necessary only if you later:
- Scale to `instances: "max"`/cluster mode, or run 2+ PM2 processes.
- Run a blue-green or multi-server deployment where requests for the same
  survey can land on different processes.

In that scenario, presence/heartbeat state (not the polling transport
itself) needs to live somewhere shared — e.g. Redis with a `TTL` per
`clientId` key (`EXPIRE` handles the "stale filler" cleanup for free) and
`INCR`/`SCAN` for counts. The polling+heartbeat approach above ports to
Redis directly later (swap the `Map`-based `livePresence.ts` internals for
Redis calls) without touching the client hook or server function
signatures at all.
