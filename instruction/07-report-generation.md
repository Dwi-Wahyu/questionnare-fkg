# Instruction 07 — Automatic Survey Report Generation (docx + charts + Groq narrative)

**Addendum to `05-responses-tab-revamp.md` and `06-survey-period-and-chart-clipboard.md`** — read both first. This doc assumes:
- The Ringkasan tab's chart-selection logic (bar/line/horizontal-bar per question) from `05` already exists.
- The `copyElementChartAsPng` clipboard utility from `06` §B already exists — this doc **reuses it**, doesn't reinvent chart rasterization.
- `periodType`/`periodValue` from `06` §A already exist on `surveys`.

**Audit first:** before writing any code, grep the repo for whether any of the following already exist (a report route, a `reports`/`reportGenerations` table, a Groq client wrapper, `docx-templates` in `package.json`). This doc assumes none of it exists yet. If some pieces already exist, adapt instead of duplicating.

Three parts:
- **§A — Chart auto-embed**: charts get rasterized client-side and sent to the server so they land inside the generated `.docx` automatically, no manual paste.
- **§B — Rate limit**: 10 minutes cooldown per survey per admin, bypassed only when `ENVIRONMENT=DEVELOPMENT`.
- **§C — Schema + migration**: new tables/columns needed, with the exact migration commands to run.

---

## §A. Chart auto-embed into the generated report

### A.1 Why client-side capture, not server-side rendering

The server (Bun, no headless browser in this stack) can't render the same Recharts/SVG DOM the browser renders. Rather than standing up a separate headless-rendering pipeline, **reuse what already works**: `copyElementChartAsPng` from `06` §B already knows how to clone a chart's SVG and rasterize it to a PNG with a white background. The report-generation flow calls that same utility for every visible chart in the Ringkasan tab, collects the resulting PNGs as base64, and sends them alongside the report request. Server never touches chart rendering — it only receives finished images.

### A.2 Client — capture step (`src/routes/admin/surveys.$surveyId.tsx`, Ringkasan tab)

Refactor `copyElementChartAsPng` (if it currently only returns a `Blob` for clipboard) into two layers:

```ts
// src/lib/chart-export.ts (extend existing file from doc 06, don't duplicate)
async function chartElementToPngBlob(chartEl: HTMLElement): Promise<Blob> {
  // existing clone-SVG + white-background canvas logic from 06 §B, unchanged
}

export async function copyElementChartAsPng(chartEl: HTMLElement) {
  const blob = await chartElementToPngBlob(chartEl);
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

export async function chartElementToPngBase64(chartEl: HTMLElement): Promise<string> {
  const blob = await chartElementToPngBlob(chartEl);
  const buf = await blob.arrayBuffer();
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
```

In the "Generate Laporan" action handler, before calling the server function, walk every chart card currently rendered in the Ringkasan tab (same DOM query the copy-icon buttons from `06` already use to locate each chart's SVG container) and build:

```ts
const charts: { questionId: number; label: string; imageBase64: string }[] = [];
for (const card of chartCardEls) {
  const svgEl = card.querySelector("svg");
  if (!svgEl) continue;
  charts.push({
    questionId: Number(card.dataset.questionId),
    label: card.dataset.chartLabel ?? "",
    imageBase64: await chartElementToPngBase64(svgEl.closest("[data-chart-root]") as HTMLElement ?? svgEl),
  });
}
```

Adjust the selector to whatever the actual chart card markup exposes (`data-question-id` may not exist yet — add it to the chart card wrapper in the Ringkasan tab if missing, it's needed to map each image back to its question in §A.4).

Show a loading state on the "Generate Laporan" button while this capture step + the server call run — capturing several charts as canvas ops is not instant.

### A.3 Server — accept images, don't regenerate them

`generateSurveyReportFn` (new, see §A.5) accepts `charts` as part of its validated input — plain base64 PNG strings, capped (reject anything absurdly large, e.g. > 5MB total, with a clear Indonesian error) so a malformed client payload can't blow up memory.

### A.4 docx-templates — image module wiring

`docx-templates` supports an `additionalJsContext`-driven image insertion via its `Image` helper passed through the template's `getImage`/`getSize` callbacks. Structure the template (`.docx` authored in Word, one placeholder per chart slot) like:

```
{{#each indicators}}
{{title}}
{INS chartImage}
{{/each}}
```

Server-side call shape:

```ts
import createReport from "docx-templates";

const buffer = await createReport({
  template: templateBuffer, // read from a checked-in .docx template asset
  data: {
    indicators: indicatorsWithNarrative.map((ind) => ({
      title: ind.questionLabel,
      chartImage: ind.chartImageBase64
        ? {
            width: 14, // cm — tune to template's content width
            height: 8,
            data: Buffer.from(ind.chartImageBase64, "base64"),
            extension: ".png",
          }
        : undefined,
    })),
  },
  cmdDelimiter: ["{", "}"],
});
```

Match `charts[].questionId` from §A.2 to each indicator's `questionId` when assembling `indicatorsWithNarrative` (§A.5) — a question with no matching captured chart (e.g. open-ended text question, which doesn't render as a chart) simply omits `chartImage`, and the template loop should tolerate a missing image (render just the title/narrative text for that indicator, no broken image placeholder).

If `docx-templates` isn't in `package.json` yet, add it (`bun add docx-templates`) — do not use `docxtemplater` per the earlier architecture decision.

### A.5 Full report assembly order

1. Server receives `{ surveyId, charts }`.
2. Check rate limit (§B) — **before** doing any Groq call or heavy work, so an abusive/repeated click fails fast and cheap.
3. Load survey + questions + sections, exclude personal-info section (same `isPersonalInfoQuestion` rule from `05` §1 — reuse it, don't reimplement).
4. Compute per-question aggregates (reuse `getAdminSurveyAnswersStatsFn`'s aggregation logic from `05` §2.2 — extract the shared computation into a plain function both the stats endpoint and the report endpoint call, rather than duplicating the query).
5. For scale questions, derive threshold buckets from `questionOptions.value` (per the bucketing logic discussed earlier this session — midpoints between sorted numeric `value`s, label taken from the nearest option's `label`).
6. Build the Groq payload: aggregates + bucket labels + open-ended theme summaries only, no raw per-respondent answers, no personal-info section at all.
7. Call Groq (`llama-3.3-70b-versatile`) once with the system context prompt, get back per-indicator narrative paragraphs.
8. Zip narratives + matching `chartImage` (from `charts[]`, matched by `questionId`) into the `indicators` array from §A.4.
9. Render via `docx-templates`, return the buffer as a downloadable file (`Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`).
10. Record the generation (§B) only after a **successful** render — a failed attempt (Groq error, template error) shouldn't burn the admin's 10-minute window.

---

## §B. Rate limit — 10 minutes per survey per admin, dev override

### B.1 Rule

- Key the cooldown on `(surveyId, userId)` — not global — so one admin generating a report doesn't block another admin, and one survey's reports don't block reports on a different survey.
- Window: 10 minutes since the **last successful** generation for that key (per A.5 step 10).
- Bypass entirely when `process.env.ENVIRONMENT === "DEVELOPMENT"` — check this first, before touching the rate-limit table at all, so local dev never even writes a throttle record.

Verify the actual env var name/convention already used in the project (check existing `.env.example` / how other server functions branch on environment) before assuming it's literally `ENVIRONMENT` — some of your other projects use `NODE_ENV` or a custom `APP_ENV`. If this project already has a convention, use that instead of introducing a second one.

### B.2 Implementation

```ts
// src/server/reportFunctions.ts
async function assertReportRateLimit(surveyId: number, userId: number) {
  if (process.env.ENVIRONMENT === "DEVELOPMENT") return;

  const [last] = await db
    .select({ generatedAt: reportGenerations.generatedAt })
    .from(reportGenerations)
    .where(and(eq(reportGenerations.surveyId, surveyId), eq(reportGenerations.userId, userId)))
    .orderBy(desc(reportGenerations.generatedAt))
    .limit(1);

  if (!last) return;

  const elapsedMs = Date.now() - last.generatedAt.getTime();
  const windowMs = 10 * 60 * 1000;
  if (elapsedMs < windowMs) {
    const remainingSec = Math.ceil((windowMs - elapsedMs) / 1000);
    throw new Error(`Tunggu ${Math.ceil(remainingSec / 60)} menit lagi sebelum generate laporan berikutnya untuk survei ini.`);
  }
}
```

Surface the remaining-cooldown message directly in the "Generate Laporan" button's error toast on the client — don't let it fail silently.

Optional but recommended: on the client, after a successful generate, disable the button and show a countdown (`10:00 → 0:00`) using the same 10-minute constant, so the admin doesn't even hit the server-side rejection in the common case. Keep the server check as the source of truth regardless (client-side countdown is UX only, matching the access-control pattern from `05` §1).

---

## §C. Schema additions + migration

### C.1 New table — `report_generations`

```ts
// src/server/db/schema.ts
export const reportGenerations = mysqlTable("report_generations", {
  id: int("id").autoincrement().primaryKey(),
  surveyId: int("survey_id")
    .references(() => surveys.id, { onDelete: "cascade" })
    .notNull(),
  userId: int("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
});
```

No `report_generations.status` or stored file — the generated `.docx` is streamed straight to the client on generation and not persisted server-side (simplest option; revisit only if you later want a "report history / re-download" feature, which would need object storage, not a DB blob).

Index `(survey_id, user_id, generated_at)` implicitly covered by the `ORDER BY ... LIMIT 1` query pattern in §B.2 — if this table grows large, add an explicit composite index, but not needed at launch.

### C.2 Migration commands — run exactly this, in order

This schema doesn't exist yet in this project, so after adding the `reportGenerations` table above to `schema.ts`:

```bash
bun run db:generate
bun run db:migrate
```

- `bun run db:generate` reads the updated `schema.ts` and produces a new `drizzle/000x_*.sql` file (Drizzle Kit diffs against the last migration, no hand-written SQL).
- `bun run db:migrate` applies it to the actual database.

Verify both script names exist in `package.json` before running (`grep -A2 '"scripts"' package.json` or just open it) — if the project uses different script names (e.g. `drizzle-kit generate` invoked directly, or a different alias), use those instead, but **still run generate then migrate as two separate steps in that order**, never hand-edit a migration file to add the table manually.

Commit the generated `.sql` migration file alongside the `schema.ts` change, same convention as `06` §A.1.

---

## §D. Environment variables to add

```
GROQ_API_KEY=...
ENVIRONMENT=DEVELOPMENT   # or PRODUCTION — confirm actual convention per §B.1 note
```

Add both to `.env.example` with a comment noting `GROQ_API_KEY` is server-only, never exposed to the client bundle.

---

## Open items for the agent to flag back (don't guess silently)

1. Actual chart-card DOM structure/selectors in the Ringkasan tab for §A.2 — if `data-question-id` doesn't already exist on the chart wrapper, add it there first.
2. Whether `ENVIRONMENT` is really the env var name this project uses, or another one is already established.
3. The `.docx` template file itself (§A.4) — this needs to be authored in Word by hand (or you) with the placeholder syntax `docx-templates` expects; the agent should not attempt to generate the template's visual layout from scratch, only wire the data into placeholders you define.
