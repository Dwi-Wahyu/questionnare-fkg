# PM2 Log Analysis — SSE Listener Drops & "Jawaban" Tab Not Auto‑Refreshing

**App:** `tracerst` (pm2 process id `8`)
**Log window:** 2026‑07‑19 09:17:16 → 09:19:55 (~2m 39s)
**Files involved:** `src/server/liveRegistry.ts`, `src/routes/api/surveys.$surveyId.live.ts`,
`src/routes/api/surveys.live.ts`, `src/hooks/useSurveyLive.ts`, `src/server/surveyFunctions.ts`,
`src/routes/admin/surveys.$surveyId.tsx`

---

## 1. What the log actually shows

| Time | Event |
|---|---|
| 09:17:16 | Aggregate presence connect requested (2 listeners already active) |
| 09:17:20 | Per‑survey connect, `surveyId=2`, `role=viewer` → 1 sub |
| 09:18:53 | Aggregate connect requested (3 already active) |
| 09:18:57 | `surveyId=3, role=filler` **aborted** → broadcast `presence` (1 sub left) → broadcast aggregate (4 listeners) |
| 09:19:01 | Aggregate client **aborted** |
| 09:19:02 | `surveyId=3, role=filler` **aborted** → `presence` broadcast (0 subs) → aggregate broadcast (3 listeners) |
| 09:19:10 | Aggregate client **aborted** |
| 09:19:21 | Aggregate client **aborted** |
| 09:19:25 | `surveyId=2, role=viewer` **aborted** |
| 09:19:55 | Aggregate client **aborted** |

Two distinct things are happening here, and it's important not to conflate them:

1. **Connections are churning (connect → abort) every 10‑40 seconds.** This is normal-ish SSE noise (tab switches, `EventSource` reconnects, admin navigating between survey pages) — but the *volume* of aborts relative to connects in this short window is high enough to be worth hardening.
2. **There is no `notifySurveyAnswered` / broadcast log line anywhere in this excerpt**, even though the admin is clearly watching a survey (`surveyId=2`, `role=viewer`) during the window. If a respondent had submitted an answer for survey 2 in this window, you'd expect to see:
   ```
   [SSE Server] notifySurveyAnswered called for surveyId=2
   [SSE Server] Broadcasting event="answer" to surveyId=2, activeSubs=1
   ```
   That line **never appears**, which lines up exactly with the "Jawaban tab doesn't auto‑reload on submit" symptom. This is not a coincidence — see Root Cause #1 below, it's a code bug, not a log‑visibility issue.

---

## 2. Root Cause #1 (confirmed, the actual bug): dead code after `return`

`src/server/surveyFunctions.ts`, inside `submitResponseFn`:

```ts
.handler(async ({ data }) => {
  ...
  return await db.transaction(async (tx) => {
    ...
    return {
      success: true,
      responseId,
    };
  });               // <-- function returns HERE

  // Notify live SSE viewers that a response was submitted
  try {
    broadcast(data.surveyId, "answer", { at: Date.now() });   // <-- UNREACHABLE
  } catch (err) {
    console.error("Failed to broadcast response notification:", err);
  }

  return result;     // <-- also unreachable, and `result` doesn't even exist
});
```

`return await db.transaction(...)` exits `submitResponseFn` immediately. Everything after it —
including the `broadcast(...)` call that is supposed to tell the SSE channel "a new answer came in" —
is **unreachable code**. It never runs, on any request, ever.

This is why:
- The DB insert succeeds (respondents can submit fine).
- The **`answer` SSE event is never emitted** for the per‑survey channel.
- `useSurveyLive(surveyId, "viewer", onAnswer)` in `SurveyDetailComponent` never fires `onAnswer`,
  so `router.invalidate()` never runs, so the **Jawaban tab doesn't auto‑refresh**.
- There's also a latent second bug: `return result` references a variable named `result` that is
  never declared anywhere in the function — if that line were ever reached it would throw
  `ReferenceError: result is not defined`.

There is already a correctly‑built helper for this exact purpose,
`notifySurveyAnswered(surveyId)` in `src/routes/api/surveys.$surveyId.live.ts`, with a comment
saying *"dipanggil dari submitResponseFn setelah insert sukses"* — but nothing actually calls it.
The inline `broadcast()` call was written instead, and placed in the wrong spot.

**Fix:** move the notification inside the transaction result handling, before the early `return`.
See `02-FIX_SSE_AUTO_REFRESH.md` for the patch.

---

## 3. Root Cause #2 (likely, needs a quick check): multi‑instance pm2 + in‑memory registry

`src/server/liveRegistry.ts` stores subscribers in a plain JS `Map`/`Set` on `globalThis`:

```ts
export const liveRegistry: LiveRegistry =
  g.__liveRegistry || (g.__liveRegistry = { channels: new Map(), ... });
```

This only works correctly **inside a single Node/Bun process**. If `tracerst` is running under
pm2 in **cluster mode** with more than one instance (the log prefix `8|tracerst` is consistent
with pm2 assigning process ids 0‑8, i.e. 9 instances, which is typical of `pm2 start -i max` or
`-i <n>`), then:

- A browser's `EventSource` GET connection is pinned to whichever worker accepted it (worker A).
- A `submitResponseFn` POST can be load‑balanced to a **different** worker (worker B).
- `broadcast()` (even once the dead‑code bug above is fixed) only reaches subscribers registered
  **in the same process**. Worker B has zero subscribers in its `liveRegistry`, so nothing is sent
  to the browser sitting on worker A.

This produces the same symptom (no auto‑refresh) *intermittently* — it will appear to work
sometimes (when GET and POST land on the same worker) and silently fail other times, which matches
"sometimes it doesn't reload" bug reports better than a 100%-broken feature.

**How to confirm:** run `pm2 show tracerst` / `pm2 list` and check `exec mode` and `instances`.
If it says `cluster` with `instances > 1`, this is in play.

**Fix options** are covered in `02-FIX_SSE_AUTO_REFRESH.md` §3.

---

## 4. Root Cause #3 (contributing, minor): reconnect churn from `EventSource` semantics

The `useSurveyLive` hook creates a new `EventSource` per `[surveyId, role]` and always calls
`es.close()` on cleanup. Sources of the churn seen in the log:

- **React re-mounts** — navigating in/out of the survey detail route, or React 18
  `StrictMode` double-invoking `useEffect` in dev, will connect → disconnect → connect.
- **Browser tab backgrounding / OS network changes** — mobile Chrome and some proxies will kill
  idle HTTP/1.1 connections; the existing 25s heartbeat comment (`: ping\n\n`) mitigates proxy
  idle-timeouts but doesn't stop the browser/OS from doing this on its own.
- **No reconnect backoff visibility** — `EventSource` auto-reconnects by default after `onerror`,
  which is fine, but every reconnect shows up as a fresh "Connection requested" + a later "aborted"
  line, inflating the log and making genuine problems harder to spot.

This isn't breaking functionality by itself, but it's worth tightening (see fix doc) so that real
signal (e.g. a channel that *never* gets an `answer` broadcast) isn't buried in reconnect noise.

---

## 5. Summary

| # | Cause | Severity | Confirmed by |
|---|---|---|---|
| 1 | `broadcast()` call is unreachable dead code after `return` in `submitResponseFn` | **Critical — this is the bug** | Code inspection of `surveyFunctions.ts:225‑320` |
| 2 | In‑memory `liveRegistry` won't fan out across multiple pm2 cluster workers | High (if cluster mode is on) | pm2 log id pattern `8|tracerst`; needs `pm2 list` to confirm |
| 3 | Normal SSE reconnect churn, not tied to instance count | Low / cosmetic | Log timestamps show connect/abort every 10‑40s |

Fix #1 first — it's a guaranteed, 100%-reproducible bug regardless of deployment topology.
Then check #2, since it determines whether #1 alone is sufficient in production.
