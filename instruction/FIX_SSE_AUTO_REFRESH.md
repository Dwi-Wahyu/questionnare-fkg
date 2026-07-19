# Fix: "Jawaban" Tab Not Auto‑Refreshing on New Response Submit

Companion to `01-SSE_LOG_ANALYSIS.md`. Two fixes: a required one (dead code) and an optional
hardening one (multi‑instance pm2), plus a small dev-noise reduction.

---

## 1. Required fix — `src/server/surveyFunctions.ts`

### Problem
`broadcast(data.surveyId, "answer", ...)` sits after a `return`, so it never executes, and the
line after it references an undefined `result` variable.

### Patch

```diff
--- a/src/server/surveyFunctions.ts
+++ b/src/server/surveyFunctions.ts
@@ submitResponseFn handler
-		return await db.transaction(async (tx) => {
+		const result = await db.transaction(async (tx) => {
 			// Find if response already exists via clientDraftId, or create new
 			let responseId: number;
 			...
 			return {
 				success: true,
 				responseId,
 			};
 		});
-
-		// Notify live SSE viewers that a response was submitted
-		try {
-			broadcast(data.surveyId, "answer", { at: Date.now() });
-		} catch (err) {
-			console.error("Failed to broadcast response notification:", err);
-		}
-
-		return result;
+
+		// Notify live SSE viewers that a response was submitted
+		try {
+			broadcast(data.surveyId, "answer", { at: Date.now() });
+		} catch (err) {
+			console.error("Failed to broadcast response notification:", err);
+		}
+
+		return result;
 	});
```

The only structural change: **remove `await` from `return await db.transaction(...)` and assign it
to `const result` instead**, so the function body continues past the transaction. Now `broadcast()`
runs after every successful submit, and `return result` resolves to the real transaction output
instead of throwing on an undefined identifier.

### Full corrected block (for reference)

```ts
.handler(async ({ data }) => {
	const [survey] = await db
		.select()
		.from(surveys)
		.where(eq(surveys.id, data.surveyId));
	if (!survey) throw new Error("Survei tidak ditemukan.");

	// ...expiry checks and uniqueQuestions lookup unchanged...

	const result = await db.transaction(async (tx) => {
		// ...all existing transaction logic unchanged...
		return {
			success: true,
			responseId,
		};
	});

	// Notify live SSE viewers that a response was submitted
	try {
		broadcast(data.surveyId, "answer", { at: Date.now() });
	} catch (err) {
		console.error("Failed to broadcast response notification:", err);
	}

	return result;
});
```

### Why not just call `notifySurveyAnswered(surveyId)` instead?
Either works — `notifySurveyAnswered` in `src/routes/api/surveys.$surveyId.live.ts` just wraps the
same `broadcast(surveyId, "answer", {...})` call with a console.log. Using it instead is fine and
slightly more consistent with the code comment that already references it:

```ts
import { notifySurveyAnswered } from "../routes/api/surveys.$surveyId.live";
...
notifySurveyAnswered(data.surveyId);
```
Just make sure the import doesn't create a circular dependency between the route file and
`surveyFunctions.ts` — if it does, keep the direct `broadcast()` call shown above instead, since
`liveRegistry.ts` has no such dependency.

### Verify the fix
After deploying, submit a test response while the admin has the survey detail page open on the
"Jawaban" tab, and confirm the pm2 log now shows:
```
[SSE Server] Broadcasting event="answer" to surveyId=<id>, activeSubs=<n>
```
followed (client-side, browser console) by:
```
[useSurveyLive Client] Answer event received for surveyId=<id>
[useSurveyLive Client] Triggering onAnswer callback for surveyId=<id>
```
and the tab should refresh within ~2.5s (the client-side debounce window in `useSurveyLive.ts`).

---

## 2. Optional but recommended — confirm pm2 topology

```bash
pm2 list
pm2 show tracerst
```

- If `exec mode: fork` and `instances: 1` → the in‑memory `liveRegistry` is fine as‑is, fix #1 above
  is sufficient.
- If `exec mode: cluster` and `instances > 1` → broadcasts only reach subscribers on the same
  worker process, and the bug will resurface intermittently even after fix #1. Pick one:

  **A. Simplest — pin `tracerst` to a single instance** (fine for an internal-tool-scale app):
  ```js
  // ecosystem.config.js
  module.exports = {
    apps: [{
      name: "tracerst",
      script: "...",
      exec_mode: "fork",
      instances: 1,
    }],
  };
  ```

  **B. Keep multiple instances — move the pub/sub out of process memory.** Use Redis (or any
  shared pub/sub) so a broadcast from any worker reaches subscribers on every worker:
  ```ts
  // liveRegistry.ts (sketch)
  import { createClient } from "redis";
  const pub = createClient({ url: process.env.REDIS_URL });
  const sub = pub.duplicate();
  await pub.connect();
  await sub.connect();

  export function broadcast(surveyId: number, event: string, data: unknown) {
    pub.publish(`survey:${surveyId}`, JSON.stringify({ event, data }));
  }

  sub.subscribe(`survey:${surveyId}`, (message) => {
    const { event, data } = JSON.parse(message);
    // fan out to this process's local `channels` set as before
  });
  ```
  This is more work; only do it if you actually need horizontal scaling. For a campus survey tool,
  option A is almost certainly the right call.

---

## 3. Optional hardening — reduce reconnect log noise

`src/hooks/useSurveyLive.ts` currently reconnects from scratch on every mount/unmount, and the
server only guards against dead connections via a 25s heartbeat comment. Two small, low-risk
improvements:

**a) Guard against `role` identity changing the effect key unexpectedly.** Already fine today
since `role` is a literal, but if this hook is ever called with a computed role, make sure it's
memoized so you don't get spurious reconnects.

**b) Log at `debug` level, not `log`/`error`, for expected reconnects**, so pm2 logs aren't
dominated by routine churn:

```diff
- es.onerror = (err) => {
-   console.error(
-     `[useSurveyLive Client] Connection error for surveyId=${surveyId}:`,
-     err,
-   );
- };
+ es.onerror = () => {
+   // EventSource auto-reconnects; only log if it stays closed.
+   if (es.readyState === EventSource.CLOSED) {
+     console.warn(
+       `[useSurveyLive Client] SSE closed for surveyId=${surveyId}, role=${role}`,
+     );
+   }
+ };
```

This won't change behavior, just makes real failures easier to spot in the pm2 log going forward.

---

## 4. Summary checklist

- [ ] Apply the `surveyFunctions.ts` patch in §1 (required — this is the actual bug).
- [ ] Run `pm2 show tracerst` and confirm `exec_mode`/`instances` (§2).
- [ ] If clustered with >1 instance, either pin to 1 instance or add shared pub/sub.
- [ ] (Optional) apply the log-noise reduction in §3.
- [ ] Redeploy, submit a test response, confirm `Broadcasting event="answer"` appears in pm2 logs
      and the Jawaban tab refreshes automatically within ~2.5s.
