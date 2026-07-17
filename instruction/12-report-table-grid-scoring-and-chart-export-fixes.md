# Instruction 12 — Report Table Structure, Grid-Question Scoring, and Chart Export Fixes

**Audience:** CLI coding agent (Claude Code) working directly in this repo.
**Primary files in scope:** `src/server/adminSurveyFunctions.ts`, `src/routes/admin/surveys.$surveyId.tsx`, `src/lib/copyChartImage.ts`, `templates/laporan-survei-template.docx`.
**Builds on:** `instruction/11-report-analysis-filter-and-subtitle.md`. Read that first — this instruction assumes the filter/subtitle work is already in place and fixes four regressions/gaps found by comparing a real generated report (`Laporan_Survei_kepuasan-mahasiswa.docx`) against a known-good reference report (`Analisis_Kepuasan_Prodi_Dokter_Gigi.docx`).
**Stack reminders:** same as Instruction 11 — Bun, TanStack Start, Drizzle/MySQL, Tailwind, Bahasa Indonesia copy/comments, `docx-templates` for rendering.

Read this whole document before touching code. **Re-confirm every line number below against the current repo state before editing** — they come from a source audit done earlier in this session and may have shifted since.

---

## 0. Summary of the four problems (confirmed by direct audit)

1. **§3 "Hasil Analisis" table is structurally broken.** The reference doc has one table row per indicator (3 cells: Indikator / Nilai Rata-rata / Kategori). The actual generated doc's table has only **one** giant data row containing 29 flattened cells, with mean/category values shifted relative to their labels (values show as `-` and appear one indicator off from where they should be).
2. **Grid-type questions never get a mean/category.** The indicators shown in the reference report (e.g. "Keandalan dan kemampuan dosen dalam memberikan pelayanan...") are **grid rows**, but the mean-computation loop only handles `linear_scale`/`multiple_choice` questions — grid questions are skipped entirely, so every grid-row indicator falls back to `"-"`. This is the "kategorisasi masih abu-abu" the user is describing.
3. **Pie chart legend is missing from the exported image, and the pie is squished narrower than it renders on screen.**
4. **Horizontal bar chart labels overlap** when category labels are long, instead of wrapping onto multiple lines with breathing room between bars.

---

## 1. Fix the table structure (`templates/laporan-survei-template.docx`)

### 1.1 Diagnosis

The template's §3 table currently has the `{FOR indicator IN indicators}` / `{END-FOR indicator}` commands embedded **inline inside the same paragraph runs** as the field placeholders, all within a single `<w:tr>`:

- Indikator cell: `{FOR indicator IN indicators}{$indicator.label}`
- Nilai Rata-rata cell: `{$indicator.mean}`
- Kategori cell: `{$indicator.category}{END-FOR indicator}`

This is the classic `docx-templates` row-repeat footgun (see the library's own issue tracker, e.g. "Generate columns for a table in a FOR loop"): when the `FOR`/`END-FOR` tokens sit mixed into the same run/paragraph as other field text, and especially if Word has split the command text across multiple `<w:r>` runs (autocorrect/spell-check does this constantly — this is exactly what the docx skill's `merge_runs.py` helper exists to fix), the library's common-ancestor detection can resolve the repeat unit to something narrower than the `<w:tr>`, producing the flattened/misaligned cell soup we're seeing instead of N repeated rows.

### 1.2 Fix procedure

1. `unzip templates/laporan-survei-template.docx -d /tmp/tpl` (do **not** hand-edit the `.docx` directly — see `/mnt/skills/public/docx/SKILL.md`, "Edit an existing document").
2. Run the skill's `merge_runs.py` against `word/document.xml` first, so every field command is guaranteed to live in a single contiguous `<w:r>` run before you touch anything:
   ```
   python /mnt/skills/public/docx/scripts/merge_runs.py /tmp/tpl/word/document.xml
   ```
3. Locate the §3 table's data row (`<w:tr>` containing `{$indicator.label}` / `{$indicator.mean}` / `{$indicator.category}`).
4. Restructure so `{FOR indicator IN indicators}` and `{END-FOR indicator}` are **each alone in their own paragraph**, in the first and third cell of that **same single row**, immediately adjacent to (but in a separate `<w:p>` from) the field placeholders:
   - Cell 1 (Indikator): paragraph 1 = `{FOR indicator IN indicators}` (own `<w:p>`), paragraph 2 = `{$indicator.label}`.
   - Cell 2 (Nilai Rata-rata): `{$indicator.mean}` (unchanged).
   - Cell 3 (Kategori): paragraph 1 = `{$indicator.category}`, paragraph 2 = `{END-FOR indicator}` (own `<w:p>`).
5. Re-zip: `cd /tmp/tpl && zip -r -X ../laporan-survei-template.docx . -x '.*'` and copy back into `templates/`.
6. **Verify before wiring into the server**: write a small throwaway Node script using `docx-templates` directly (see `instruction/07-report-generation.md` §A.4 for the calling convention already used in this repo) with a fake `indicators` array of 3–4 items with distinct label/mean/category values, render it, `pandoc -t markdown` the result, and confirm you get **N separate table rows** with correctly aligned label→mean→category — not one row with flattened cells. Do not proceed to §2 until this passes.
7. Delete the throwaway script when done.

---

## 2. Compute scores for grid-question indicators (server)

### 2.1 Diagnosis

In `generateSurveyReportFn` (`src/server/adminSurveyFunctions.ts`, audited around line ~1486 for the handler and ~1550–1620 for the per-question mean loop):

- The mean-computation loop only branches on `q.type === "linear_scale" || q.type === "multiple_choice"` (audited ~line 1563). Grid questions are never visited here, so `allMeans` never contains an entry for a grid row.
- `indicatorsData.push({ label: q.title, mean: meanItem ? ... : "-", category: meanItem ? ... : "-" })` (audited ~line 1779) therefore always falls back to `"-"` for every grid row, because `meanItem` is always `undefined` for those questions.
- Contrast with `computeSurveyStats`'s **own** grid handling (audited ~line 534–620), which already knows how to walk `qOptions.filter(o => o.group === "row")` / `.filter(o => o.group === "column")` and match `ans.valueGrid[rowOptionId] = columnOptionId` — that logic (for the on-screen matrix table) needs a numeric-mean sibling for the report.

### 2.2 Fix

Add a grid-aware branch to the mean-computation loop (same loop that builds `allMeans` / feeds `indicatorsData`, and reuse for `linearScaleMeans`/`overallMeanVal` too):

```ts
if (q.type === "grid") {
  const rowOptions = qOptions.filter((o) => o.group === "row");
  const colOptions = qOptions.filter((o) => o.group === "column");
  const numericCols = colOptions
    .map((o) => ({ id: o.id, val: o.value ? Number.parseFloat(o.value) : Number.parseFloat(o.label) }))
    .filter((o) => !Number.isNaN(o.val));

  for (const row of rowOptions) {
    let sum = 0;
    let count = 0;
    for (const ans of qAnswers) {
      const gridVal = ans.valueGrid as Record<string, number> | null;
      if (!gridVal) continue;
      const colId = gridVal[String(row.id)];
      const col = numericCols.find((c) => c.id === colId);
      if (col) {
        sum += col.val;
        count++;
      }
    }
    if (count > 0) {
      const mean = sum / count;
      allMeans.push({
        questionId: q.id,          // keep parent question id for chart-matching (§3.2)
        rowOptionId: row.id,       // new — disambiguates rows under the same question
        type: "grid_row",
        label: row.label,          // the grid row IS the indicator label, not q.title
        mean,
        category: getScoreCategory(mean), // see §2.3 — do not use getScaleBucket here
      });
    }
  }
}
```

Then in the `indicatorsData` build loop (~line 1773 onward), for grid questions push **one indicator per grid row** (using the new `allMeans` entries keyed by `rowOptionId`) instead of one indicator per question. Non-grid questions keep the existing single-indicator-per-question behavior.

Also extend the `allMeans`/`type: string` shape wherever it's declared (the loop's local array literal type around line ~1550) to accept `"grid_row"` alongside the existing linear_scale/multiple_choice tracking, and make sure §on-screen chart matching (`charts.find(c => c.questionId === q.id)`, ~line 1785) still works per-question (grid charts stay one-per-question; only the **table** breaks grids into per-row indicators).

### 2.3 Simplify categorization ("totalkan saja skor")

Replace `getScaleBucket` (audited ~line 1428–1455, the closest-numeric-option-label matcher) as the source of indicator/overall categories. It's fragile — it silently returns `"-"` whenever a question's options don't parse to numbers, which is the direct cause of the "abu-abu" (unclear/inconsistent) categorization the user is seeing, and it can't produce a single consistent category across mixed scales (grid columns vs. linear_scale options).

Add a fixed-interval helper instead, matching the reference report's observed thresholds (mean 3.35 → "Sangat Baik", 3.26 → "Sangat Baik" — consistent with a standard 1–4 LAM-PTKes/BAN-PT-style split):

```ts
function getScoreCategory(mean: number): string {
  if (mean >= 3.25) return "Sangat Baik";
  if (mean >= 2.5) return "Baik";
  if (mean >= 1.75) return "Cukup";
  return "Kurang";
}
```

**Verify the 1–4 assumption first**: grep the actual `linear_scale`/grid column option `value`s in this survey's data (`questionOptions.value`) to confirm the scale really runs 1–4, not 1–5. If some surveys use a 1–5 scale, make the thresholds proportional to `optionMin`/`optionMax` instead of hardcoding 1.00–4.00, e.g. `Kurang: [min, min+0.75*range/4*1]`... — but do not over-engineer this if every survey question option set audited so far is 1–4; a hardcoded 1–4 table is fine as a first pass, just leave a `// TODO: parameterize by scale if a 1-5 survey shows up` comment.

Use `getScoreCategory()` for:
- each grid-row indicator's `category` (§2.2),
- each linear_scale/multiple_choice indicator's `category` (replacing the `getScaleBucket(mean, qOptions)` call at ~line 1592),
- `overallCategoryVal` (replacing `getScaleBucket(overallMeanVal, firstQOptions)` at ~line 1613) — now computed the same way regardless of which question type happened to be first, removing the "depends on the first linear_scale question's option set" fragility.

You can delete `getScaleBucket` entirely once nothing references it — grep first to confirm no other caller (e.g. `getAdminSurveyAnswersStatsFn` or the client) uses it for on-screen display; if it does, leave it for that path and only redirect the **report** path to `getScoreCategory`.

---

## 3. Chart export fixes (`src/lib/copyChartImage.ts`, `surveys.$surveyId.tsx`)

### 3.1 Pie chart: missing legend + squished width

**Diagnosis:**
- `chartElementToPngBlob` (`copyChartImage.ts`) only serializes the largest `<svg>` found in the container (picks by bounding-box area). The pie chart's legend is deliberately rendered as a plain HTML `<div>` **outside** the SVG (comment in `ChartCard`, ~line 2972: "Legend rendered outside SVG so it is never clipped by the fixed-height viewport") — so the capture path never sees it, and it's silently dropped from the exported PNG.
- The pie's squished width comes from the server always requesting a fixed `image: { width: 14, height: 8 }` cm box for every chart (`adminSurveyFunctions.ts` ~line 1790, inside the `chartsData.push(...)` block) regardless of the chart's actual/natural aspect ratio. A roughly-square pie gets force-stretched into a 14:8 landscape box.

**Fix:**
1. Confirm what attribute/class `chartElementToPngBlob` already scans for legend items (it references something like `data-legend-item` / `.recharts-legend-item` based on this session's audit — re-check the actual function body, only partially read so far). Add that same attribute to the pie chart's custom HTML legend markup in `ChartCard` so the **existing** capture logic picks it up, rather than writing new capture code.
2. If the legend still isn't compositable that way (e.g. it needs actual pixels, not just a DOM flag), rasterize the whole `data-chart-root` container (SVG + legend div together) onto one `<canvas>` instead of the SVG alone — draw the SVG via `Image`/`XMLSerializer` as today, then draw each legend swatch+label as canvas text/rect beneath it, sized to match the container's actual on-screen legend layout.
3. Stop hardcoding `{ width: 14, height: 8 }` for every chart on the server. Extend the client payload (`charts[]` sent to `generateSurveyReportFn`) to include the captured image's actual pixel `width`/`height` (or precomputed cm width/height) per chart. On the server, compute the docx-templates image box preserving aspect ratio, e.g. fit to a max width of 14cm and derive height as `14 * (pxHeight / pxWidth)`, with a sane max height cap (e.g. 12cm) for pathologically tall charts (see §3.2).
4. Before capturing, wait for layout to fully settle (e.g. two `requestAnimationFrame` ticks, or `await new Promise(r => setTimeout(r, 50))`) after switching to/rendering the chart, since `handleGenerateReport` currently queries `document.querySelectorAll("[data-chart-card]")` and reads `getBoundingClientRect()` immediately, which can race Recharts' `ResizeObserver` and capture a not-yet-settled (narrower) width.

### 3.2 Horizontal bar chart: overlapping long labels

**Diagnosis:** the horizontal bar chart used for grid/matrix questions renders a `<YAxis type="category">` with a fixed container height; when category labels are long, Recharts compresses per-row spacing and labels overlap instead of wrapping.

**Fix:**
1. Make the chart's height a function of category count instead of a fixed value: `height = Math.max(300, categories.length * ROW_HEIGHT)`, with `ROW_HEIGHT` around 48–60px (enough for a 2–3 line wrapped label at the current font size).
2. Replace the default Y-axis tick with a custom `tick` render function that manually wraps long labels across multiple `<tspan y-offset>` lines (word-wrap at ~20–25 chars) instead of relying on Recharts' single-line default, so labels never truncate or overlap — they simply take more vertical room, which is now available per point 1.
3. The existing max-height/scroll wrapper (capped ~1200px, scrollable at 600px) is fine for on-screen viewing but must **not** apply during report-export capture — for the export capture path specifically, temporarily remove the height cap / `overflow` clipping (or render an export-only full-height clone) so the captured PNG shows every label, uncropped. Restore the on-screen capped styling immediately after capture.
4. Feed the resulting (now taller) chart's real pixel dimensions through the same aspect-ratio-preserving path from §3.1.3, so a tall bar chart isn't squashed into the same 14×8cm box as everything else.

---

## 4. Testing checklist

1. **Table structure:** generate a report for a survey with ≥3 grid-row indicators + ≥2 linear_scale questions. Open the resulting `.docx` in Word (or `pandoc -t markdown`) and confirm §3 has one row per indicator, each with correctly aligned label/mean/category (no shifted/duplicated values, no `-` for grid rows that have answers).
2. **Grid scoring:** for a grid question with known answers, hand-compute the expected mean for one row and confirm it matches the exported value; confirm category matches the §2.3 thresholds.
3. **Overall category:** confirm `overallCategory` in §3's summary sentence is consistent with `overallMean` under the new fixed thresholds regardless of which question type appears first in the survey.
4. **Pie chart:** export a report containing a pie-chart question; confirm the legend appears in the embedded image and the pie is round (not squished) in the `.docx`.
5. **Horizontal bar chart:** export a report for a grid question with long category labels; confirm every label is fully visible, wrapped onto multiple lines, with visible spacing between bars (no overlap) in the embedded image.
6. **Regression:** re-run Instruction 11's filter/subtitle checklist to confirm none of the above changes broke filter-scoped report generation.
7. **Template integrity:** after the §1 XML patch + rezip, open the template in Word directly (not just via docx-templates output) to confirm it isn't corrupted and still opens cleanly.
