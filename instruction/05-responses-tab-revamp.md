# Instruction 05 — Survey Detail "Jawaban" Revamp (Ringkasan / Pertanyaan / Individual) + Real CSV Export

**Audience:** CLI coding agent (Claude Code) working directly in this repo.
**Primary file in scope:** `src/routes/admin/surveys.$surveyId.tsx`
**Supporting files:** `src/server/adminSurveyFunctions.ts`, `src/components/ui/chart.tsx` (read-only, already exists), `docs/chart/examples/*.ts` (reference only, do not import from `docs/`)
**Stack reminders:** Bun, TanStack Start (`createServerFn`), Drizzle/MySQL, Tailwind, shadcn `chart.tsx` + Recharts 3, all UI copy in Bahasa Indonesia (match existing tone).

Read this whole document before touching code — later sections depend on decisions made in earlier ones (esp. §1 "personal info" convention and §2 data contracts).

---

## 0. Findings from current-code audit (context, no action needed here)

1. **The existing "Download CSV" button does not export real data.** `handleDownloadCSV` in `surveys.$surveyId.tsx` (~line 298-384) builds rows by looping `1..responseCount` and, for every row, re-picks the **modal (most common) aggregated answer** for choice questions and a **random** answer from the aggregated text pool for text questions. It never joins back to an actual `responseId`. This means every synthetic row mixes fields from different real respondents, and for grid questions every row is byte-for-byte identical. This is the root cause of the mismatch between `responses_survey_kepuasan-mahasiswa-2025.csv` (app export) and the real Google Forms export — confirmed by inspecting the app CSV: the entire "Evaluasi Layanan dan Kinerja" grid column has the **exact same text for every single respondent row**, which is statistically impossible for real data and only explained by the mode-repetition bug described above.
2. **Structural mismatch vs Google Forms CSV:** Google Forms gives one column per grid **row** (8 separate Likert columns for "Evaluasi Layanan dan Kinerja"), plus a `Timestamp` column, totaling 22 columns. The app CSV collapses the whole grid question into a single flattened text cell ("`RowLabel: Answer | RowLabel: Answer | …`"), giving only 12 columns and no timestamp.
3. **Row-count mismatch (124 in Google Forms vs 127 in app export):** the app only counts `responses.status = 'completed'`, while the Google Form sheet records every submitted row unconditionally. There may also be edited/duplicate submissions handled differently between the two systems (the app's `submitResponseFn` overwrites by `clientDraftId`, Google Forms creates a new row per submission unless "edit response" was used). This cannot be fully reconciled without inspecting the raw `responses`/`answers` tables directly — flag it to the user rather than silently "fixing" the count.
4. **The Google Forms sheet has a manually-authored summary block** (rows 1-4: `TOTAL RESPON`, `SANGAT BAIK =`, `BAIK =`, `CUKUP =`, `KURANG =` with per-column counts) above the real header/data. This is **not** an automatic Google Forms feature — it's a `COUNTIF`-style summary the spreadsheet owner built manually in the linked Sheet. We replicate the *effect* (a prepended summary block) using our own aggregated stats, not by reverse-engineering Google's formulas.
5. `getAdminSurveyResponsesListFn` (server, ~line 330) already exists and is paginated but is **currently unused** by the frontend — it's the right base for the new "Individual" tab, but needs a companion "response detail" endpoint (§2.3).
6. There is no existing convention for "which questions are personal info" — derive it structurally: **all questions belonging to the survey's first section (lowest `order` in `sections`) are treated as personal-info fields** (this matches the seed data: name/NIM/phone/email/prodi always live in section 1, "Informasi Pribadi" / "Identitas Responden"). Do not hardcode question titles like "nama"/"email" — use the section-based rule everywhere (charts, CSV, individual view, question selector).

---

## 1. Access-control rule (apply everywhere in this feature)

Define once, reuse everywhere (server-side is the source of truth; client-side hiding is UX only):

```ts
// src/server/adminSurveyFunctions.ts
function isPersonalInfoQuestion(question: { sectionId: number }, firstSectionId: number) {
  return question.sectionId === firstSectionId;
}
```

Rules for `role === "visitor"`:
- Any answer value belonging to a personal-info question (per rule above) must **never be sent to the client** — mask server-side (`null` / `"[disembunyikan]"`), not just hidden in the UI. Applies to: `Ringkasan` chart data, `Pertanyaan` tab per-question answers, `Individual` tab per-response answers, and the paginated response list (`nama`/`nim` columns).
- CSV export server function must **reject visitor role outright** (`throw new Error("Akses ditolak...")`) — do not attempt a "redacted CSV"; the button should not even render for visitors.
- Admin (`role === "admin"`) sees everything, unchanged.

---

## 2. Server changes — `src/server/adminSurveyFunctions.ts`

### 2.1 Shared helper

Add near the top (after `assertAdmin`):

```ts
function getFirstSectionId(surveySections: { id: number; order: number }[]) {
  if (surveySections.length === 0) return null;
  return [...surveySections].sort((a, b) => a.order - b.order)[0].id;
}
```

### 2.2 Fix `getAdminSurveyAnswersStatsFn` (existing, ~line 396)

Keep its current aggregation logic (it's correct for Ringkasan/Pertanyaan charts) but:
- Accept the calling user's role (call `assertUser()` — already does) and mask `data` for personal-info questions when `role === "visitor"`: return `data: []` (or a redacted marker `{ redacted: true }`) instead of raw text answers.
- **Fix the checkbox/multi-select percentage base**: currently `percentage` is `count / totalAnswersCount` where `totalAnswersCount` sums every selection across all options (so multi-select percentages don't represent "% of respondents"). Change denominator to the number of respondents who answered the question (`qAnswers.length`) so percentages are readable in the chart legends, e.g.:

```ts
const respondentCount = qAnswers.length;
...
percentage: respondentCount > 0 ? Math.round((count / respondentCount) * 100) : 0,
```

- Add `optionCount: qOptions.length` to every non-text stat entry — the frontend chart-selection logic (§3.2) needs this to decide bar vs line vs horizontal-bar without recomputing it.

### 2.3 New: `getAdminSurveyResponseDetailFn`

Powers the **Individual** tab. Returns one response fully joined with question metadata, in question `order`, values pre-shaped per type so the frontend can render disabled/prefilled inputs directly.

```ts
export const getAdminSurveyResponseDetailFn = createServerFn({ method: "GET" })
  .validator((data: { surveyId: number; responseId: number }) => data)
  .handler(async ({ data }) => {
    const user = await assertUser();

    const [response] = await db.select().from(responses)
      .where(and(eq(responses.id, data.responseId), eq(responses.surveyId, data.surveyId), eq(responses.status, "completed")));
    if (!response) throw new Error("Respon tidak ditemukan");

    const surveySections = await db.select().from(sections).where(eq(sections.surveyId, data.surveyId)).orderBy(sections.order);
    const firstSectionId = getFirstSectionId(surveySections);

    const surveyQuestions = await db.select().from(questions).where(eq(questions.surveyId, data.surveyId)).orderBy(questions.order);
    const questionIds = surveyQuestions.map((q) => q.id);
    const surveyOptions = questionIds.length
      ? await db.select().from(questionOptions).where(inArray(questionOptions.questionId, questionIds)).orderBy(questionOptions.order)
      : [];

    const responseAnswers = await db.select().from(answers).where(eq(answers.responseId, data.responseId));

    const items = surveyQuestions.map((q) => {
      const isPersonal = firstSectionId !== null && isPersonalInfoQuestion(q, firstSectionId);
      const hidden = isPersonal && user.role === "visitor";
      const options = surveyOptions.filter((o) => o.questionId === q.id);
      const answer = responseAnswers.find((a) => a.questionId === q.id) || null;

      return {
        questionId: q.id,
        sectionId: q.sectionId,
        type: q.type,
        title: q.title,
        description: q.description,
        required: q.required,
        options,
        isPersonalInfo: isPersonal,
        hidden,
        valueText: hidden ? null : answer?.valueText ?? null,
        valueOptionIds: hidden ? null : answer?.valueOptionIds ?? null,
        valueGrid: hidden ? null : answer?.valueGrid ?? null,
      };
    });

    return {
      responseId: response.id,
      submittedAt: response.submittedAt,
      items,
    };
  });
```

### 2.4 Extend `getAdminSurveyResponsesListFn` (existing, ~line 330)

- Mask `nama`/`nim` (return `"—"`) when `user.role === "visitor"`. Get `user` from `assertUser()` (already called).
- No pagination shape changes needed — `{ responses, totalCount }` already fits the Individual tab's pager (page 1..N, `limit` e.g. 1 per page since Individual shows one full response at a time — see §3.4 for whether to fetch 1-at-a-time or a lightweight index list + separate detail call).

### 2.5 New: `exportAdminSurveyResponsesCSVFn` (replaces client-side `handleDownloadCSV`)

Server-side, admin-only, builds the **real** row-level CSV plus a Google-Forms-style summary block on top.

```ts
export const exportAdminSurveyResponsesCSVFn = createServerFn({ method: "GET" })
  .validator((surveyId: number) => surveyId)
  .handler(async ({ data: surveyId }) => {
    const user = await assertUser();
    if (user.role !== "admin") {
      throw new Error("Akses ditolak. Hanya Admin yang dapat mengekspor data.");
    }

    // 1. Load survey, sections, questions, options (ordered)
    // 2. Build a flat column plan:
    //    - "No. Respon"
    //    - "Timestamp" (responses.submittedAt)
    //    - for each question:
    //        - grid   -> one column PER ROW option, header = row option label
    //                    (if collisions across questions, prefix with question title)
    //        - others -> one column, header = question.title
    // 3. Load every completed response + all its answers (single query with joins,
    //    grouped in memory by responseId — do not N+1 query per response).
    // 4. For each response, in submittedAt order, resolve each column:
    //        - short_text/paragraph/date -> answer.valueText
    //        - multiple_choice/dropdown/linear_scale -> label of the selected option
    //          (look up via answer.valueOptionIds[0] against that question's options)
    //        - checkboxes -> option labels joined with "; "
    //        - grid -> for each row column, resolve answer.valueGrid[rowOptionId] -> column option label
    //    This must be the respondent's ACTUAL stored answer — no aggregation, no randomness.
    // 5. Build the summary block (see §2.6) from the same aggregated stats used by Ringkasan.
    // 6. Concatenate: [summaryBlockRows..., "", headerRow, ...dataRows]
    // 7. Return as a single CSV string (UTF-8, BOM prefix "\uFEFF" for Excel), plus
    //    a suggested filename. Do NOT return a Blob from the server function — return
    //    { csv: string, filename: string } and let the client construct the Blob/download
    //    (createServerFn responses are JSON-serialized).

    return { csv: "...", filename: `responses_survey_${survey.slug}.csv` };
  });
```

Implementation notes:
- Reuse the option-lookup pattern already in `getAdminSurveyAnswersStatsFn` for consistency.
- For `linear_scale`, `valueOptionIds` holds the single selected scale-point option id — same lookup as multiple_choice.
- Escape every cell per RFC 4180 (wrap in `"`, double internal quotes) — reuse the existing escaping helper pattern from the old `handleDownloadCSV` (`str.replace(/"/g, '""')`), just apply it to real values now.
- This does **not** need to respect the "hide personal info" rule beyond the role gate, since only `role === "admin"` is allowed to call it at all.

### 2.6 CSV summary block (Google-Forms-style header)

Goal: reproduce the *effect* of the manual summary rows in the reference Google Sheet (`TOTAL RESPON` + per-answer-label counts), not its exact layout. Generate it from the same aggregation `getAdminSurveyAnswersStatsFn` already computes:

```
Ringkasan Survei — <survey.title>
Total Respon (Selesai),<responseCount>
Diekspor pada,<ISO timestamp>
""
Pertanyaan,Opsi Jawaban,Jumlah,Persentase
"<question 1 title>","Sangat Baik",<count>,<pct>%
"<question 1 title>","Baik",<count>,<pct>%
...
""
<real header row>
<real data rows...>
```

Only include questions of type `multiple_choice` / `dropdown` / `linear_scale` / `checkboxes` / `grid` in the summary block (skip free-text questions — same as the Google sheet, which only summarized the Likert columns). For `grid` questions, emit one summary line per **row × column** combination (`"<question title> — <row label>"`, `<column label>`, count, pct).

---

## 3. Frontend changes — `src/routes/admin/surveys.$surveyId.tsx`

### 3.1 Route/search-param changes

Replace the single `tab` search param's `"responses"` value with a parent tab plus a sub-tab:

```ts
validateSearch: (search: Record<string, unknown>) => ({
  tab: (search.tab as string) || "questions", // "questions" | "responses" | "settings"
  subtab: (search.subtab as string) || "ringkasan", // "ringkasan" | "pertanyaan" | "individual"
  qid: search.qid ? Number(search.qid) : undefined, // selected question id, Pertanyaan tab
  page: search.page ? Number(search.page) : 1, // Individual tab pagination
}),
loaderDeps: ({ search: { tab, subtab, qid, page } }) => ({ tab, subtab, qid, page }),
loader: async ({ params, deps }) => {
  const surveyId = parseInt(params.surveyId, 10);
  const detail = await getAdminSurveyDetailFn({ data: surveyId });
  let stats = null;
  let responseDetail = null;
  let responsesIndex = null;

  if (deps.tab === "responses" && (deps.subtab === "ringkasan" || deps.subtab === "pertanyaan")) {
    stats = await getAdminSurveyAnswersStatsFn({ data: surveyId });
  }
  if (deps.tab === "responses" && deps.subtab === "individual") {
    responsesIndex = await getAdminSurveyResponsesListFn({ data: { surveyId, page: deps.page, limit: 1 } });
    const targetId = responsesIndex.responses[0]?.id;
    if (targetId) {
      responseDetail = await getAdminSurveyResponseDetailFn({ data: { surveyId, responseId: targetId } });
    }
  }

  return { detail, stats, responseDetail, responsesIndex, surveyId };
},
```

Rationale for `limit: 1` in the Individual tab: the tab is "one full response per page", so reuse the existing paginated list endpoint directly as the pager (`totalCount` gives the page count) instead of building a second index endpoint. This is simplest and matches "pagination 1 to n response" from the spec exactly.

### 3.2 Sub-tab navigation UI

Under the existing `tab === "responses"` block, add a second-level tab bar (same visual pattern as the outer tabs, slightly smaller/indented) with three links, each preserving `tab: "responses"` and setting `subtab`:

- `Ringkasan` → `subtab: "ringkasan"`
- `Pertanyaan` → `subtab: "pertanyaan"`
- `Individual` → `subtab: "individual"`

Keep the outer "Jawaban (`responseCount`)" tab label as-is; it now just switches into this sub-tab group instead of rendering the flat list directly.

The **Download CSV** button (top-right, currently always shown for `tab === "responses"`) must:
- Only render when `user?.role !== "visitor"`.
- Call the new server function and construct the blob client-side:

```ts
const handleDownloadCSV = async () => {
  try {
    const res = await exportAdminSurveyResponsesCSVFn({ data: surveyId });
    const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = res.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err: any) {
    toast.error(err.message || "Gagal mengekspor data.");
  }
};
```

Delete the entire old synthetic `handleDownloadCSV` implementation (lines ~298-384) — it is being replaced, not kept as a fallback.

### 3.3 Ringkasan sub-tab — conditional chart selection

Keep the existing "Total Jawaban" / "Status Pengumpulan" bento cards at the top, unchanged. Replace the per-question rendering block (~line 967-1133) with a chart-per-question loop that picks a chart type from `stat.type` + `stat.optionCount`:

**Decision table** (implement as a small `pickChartKind(stat)` helper):

| Question type | Option count | Chart | Reference example |
|---|---|---|---|
| `short_text` / `paragraph` / `date` | n/a | Keep existing scrollable answer list (no chart) | — |
| `multiple_choice` / `dropdown` / `linear_scale` / `checkboxes` | ≤ 4 options | Bar chart, vertical, with legend + custom value labels | `bar-chart-custom-label.ts` (combine with a `ChartLegend`/`ChartLegendContent` like `pie-with-legend.ts` for the legend part) |
| `multiple_choice` / `dropdown` / `linear_scale` / `checkboxes` | 5–8 options | Line chart (single series: option label on X axis, count on Y axis) | adapt `bar-chart-base.ts` structure but swap `<Bar>` for `<Line>`/`<LineChart>` — there's no line example in `docs/chart/examples`, follow the same `ChartContainer`/`ChartConfig` conventions used by the other examples |
| `multiple_choice` / `dropdown` / `linear_scale` / `checkboxes` | > 8 options | Horizontal bar chart | `bar-chart-horizontal.ts` |
| `grid` | any | Grouped/multiple bar chart: X axis = row labels (truncate long labels, full text in tooltip), one `<Bar>` series per column option (e.g. Sangat Baik/Baik/Cukup/Kurang) | `bar-chart-multiple.ts`, extended from 2 series to N series (one per column option, capped — see note below) |

Notes:
- All charts must use `ChartContainer` + `ChartConfig` from `src/components/ui/chart.tsx` (already implemented, do not modify it) — do not hand-roll SVG/Recharts wiring outside that wrapper, per existing project convention (`docs/chart/base.md`).
- Build `chartConfig` dynamically per question: `{ [safeKey(optionLabel)]: { label: optionLabel, color: "var(--chart-N)" } }`, cycling `--chart-1` through `--chart-5` (only 5 exist in the theme — for grid questions with more than 5 columns, cycle colors, don't crash).
- Question titles can be long — keep them in the existing `<h3>` card header (unchanged), only the chart body changes.
- For `grid`, if there are more than ~6 rows, consider `layout="vertical"` (horizontal bars) instead of grouped vertical bars so row labels stay legible — use judgement, but default to the grouped-bar approach in the table above for a first pass.
- Respect the visitor personal-info masking from §2.2 — if `stat.data` comes back redacted/empty for a personal-info question, render a small "Informasi pribadi disembunyikan untuk peninjau" notice instead of an empty chart (in practice, personal-info questions are almost always `short_text`, so this mostly affects the text-list branch, but implement the guard generically).

### 3.4 Pertanyaan sub-tab

New UI, roughly:

```
[ Select: pilih pertanyaan ▾ ]   <-- <Select> component from src/components/ui/Select.tsx,
                                       options = questions in survey order, value = qid search param
------------------------------------------------
<selected question title + description>
<same chart as Ringkasan for this one question, larger/full-width>
<below: full breakdown table — Opsi | Jumlah | Persentase, one row per option>
<for text-type questions: full scrollable/searchable list of all raw answers
 (reuse stat.data, already capped at 50 server-side — consider raising the cap
 or adding a "load more"/search input for this dedicated tab; the Ringkasan
 tab can keep the smaller inline list)>
```

Changing the `<Select>` value updates the `qid` search param via `router.navigate` (or a `<Link search={...}>` list if simpler) — no new loader call needed since `stats` already contains every question; this tab just filters client-side by `qid`. Default `qid` to the first non-personal-info question (or the very first question for admin) if none is set, so the tab isn't blank on first visit.

### 3.5 Individual sub-tab

- Header row: "Respon #`page` dari `responsesIndex.totalCount`" + Prev/Next buttons (disable at bounds) that update the `page` search param. Also add a plain numeric pager/jump-to-page input since `totalCount` can be large (matches "pagination 1 to n response" from the spec).
- Show `responseDetail.submittedAt` (formatted, e.g. `id-ID` locale) near the header.
- Render every item in `responseDetail.items` (already in question order) as a **disabled, prefilled** input matching its `type`, reusing existing form primitives where possible (check `src/components/ui/Input.tsx` and whatever the public survey-taking route `src/routes/survey.$surveySlug.tsx` uses for each question type, so the Individual view visually matches how the question was originally presented — don't reinvent new input styling):

| `type` | Rendering |
|---|---|
| `short_text` | `<input disabled value={item.valueText ?? "-"} />` |
| `paragraph` | `<textarea disabled value={item.valueText ?? "-"} />` |
| `date` | `<input type="date" disabled value={item.valueText ?? ""} />` |
| `multiple_choice` / `dropdown` | radio group / `<select disabled>`, with the option matching `valueOptionIds[0]` marked selected/checked, others unselected |
| `checkboxes` | checkbox list, boxes checked for every id in `valueOptionIds` |
| `linear_scale` | the same scale-point control used on the public form, with the matching point selected |
| `grid` | a disabled table/grid mirroring the public form's grid question, radio per row pre-selected per `valueGrid[rowOptionId] === columnOptionId` |

- If `item.hidden` is true (visitor viewing a personal-info question), render a locked placeholder instead of the input: a greyed box with a lock icon and "Informasi pribadi disembunyikan untuk peninjau" — do not render an empty/blank input that looks like the respondent left it blank.
- No "Download CSV" affordance here (that only lives in the top-right button, §3.2).

---

## 4. Manual verification checklist (run through after implementing)

1. As **admin**: open a survey with at least one `grid` question and one `checkboxes`/`multiple_choice` question with >8 options → confirm Ringkasan renders a grouped bar chart for the grid and a horizontal bar chart for the many-option question, and a bar-with-legend chart for a ≤4-option question.
2. As **admin**: Pertanyaan tab — switching the question selector updates the chart + table + (for text types) the raw answer list.
3. As **admin**: Individual tab — paginate from response 1 to the last; every question shows the *actual* stored answer for that specific respondent (spot check 2-3 responses against the DB or the `Pertanyaan` tab's raw text list).
4. As **admin**: Download CSV → open the file → confirm (a) a summary block at the top, (b) one column per grid row (not one collapsed column), (c) a `Timestamp` column, (d) values differ row-to-row for grid columns (no more identical text repeated down a column), (e) row count matches `responses.status = 'completed'` count exactly.
5. As **visitor**: confirm no Download CSV button anywhere; confirm the first section's questions (name/NIM/phone/email/etc.) show a locked placeholder in Individual tab and are excluded from the Pertanyaan tab's question selector (or shown but with values redacted — pick one behavior and apply it consistently across Ringkasan/Pertanyaan/Individual/CSV).
6. Confirm `tab=responses` deep links (`?tab=responses&subtab=individual&page=5`) work on hard refresh (loader reads all four search params).

---

## 5. Explicitly out of scope for this task

- Reconciling the exact 124 vs 127 response-count discrepancy against the historical Google Forms data — that requires inspecting the live `responses` table's `status`/timestamps directly against the original submission log, which isn't something a code change alone can resolve. Surface the "completed-only" filter as documentation/tooltip copy near the response count instead of trying to force parity.
- Rebuilding `docs/chart/*` — those are reference-only docs, not part of the app bundle; don't import from `docs/`, only copy the relevant patterns into real component code under `src/`.
- Changing the DB schema — no migration is needed; the "first section = personal info" rule is derived at query time.
