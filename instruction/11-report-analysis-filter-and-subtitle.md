# Instruction 11 — Filter-Aware Report Generation (Analysis Data + Human-Readable Subtitle)

**Audience:** CLI coding agent (Claude Code) working directly in this repo.
**Primary files in scope:** `src/server/adminSurveyFunctions.ts`, `src/routes/admin/surveys.$surveyId.tsx`
**Supporting files:** `src/server/db/schema.ts` (+ new Drizzle migration), `templates/laporan-survei-template.docx`.
**Stack reminders:** Bun, TanStack Start (`createServerFn`), Drizzle/MySQL, Tailwind, all UI copy and code comments touching this feature stay in Bahasa Indonesia (match existing tone). Read `instruction/07-report-generation.md` first if you haven't touched `generateSurveyReportFn` before — this instruction extends it, it doesn't replace it.

Read this whole document before touching code.

---

## 0. Context / current state (audit, no action needed here — verified directly against the repo)

1. `buildSurveyResponseExport()` (shared helper used by `exportAdminSurveyResponsesCSVFn` and `exportAdminSurveyResponsesXLSXFn`, `src/server/adminSurveyFunctions.ts` ~line 1057) already accepts `filterQuestionId?` / `filterOptionIds?`, validates them against the survey's questions/options, and restricts the exported rows to responses whose answer to `filterQuestion` intersects `filterOptionIds`. This is the **only** place in the codebase filtering currently applies.
2. `computeSurveyStats(surveyId, userRole)` (~line 475) — used by both `getAdminSurveyAnswersStatsFn` (on-screen charts in the "Ringkasan"/"Pertanyaan" sub-tabs) and `generateSurveyReportFn` (AI narrative + docx indicators/charts) — has **no filter parameter at all**. It always aggregates every completed response. This means the on-screen charts, the chart images captured for the Word report, the AI narrative, and the indicator table in the docx are all currently unfiltered, regardless of what's selected in the "Filter CSV" bar.
3. The chart images embedded in the generated Word report are **not** produced server-side — `handleGenerateReport()` (client, `surveys.$surveyId.tsx` ~line 657) screenshots the on-screen chart SVGs (`[data-chart-card]`, rendered from `stats` in the "Ringkasan" sub-tab) via `chartElementToPngBase64`. **This means the on-screen charts must themselves reflect the selected filter before the "Generate Laporan" button is clicked**, otherwise the embedded chart images will never match the filtered narrative/indicator table no matter what we change server-side.
4. The filter UI ("Filter CSV:" bar, ~line 1522-1595) and the "Generate Laporan (Word)" button (~line 869, `onClick={handleGenerateReport}`) both live inside `subtab === "ringkasan"`, using the same `csvFilterQuestionId` / `csvFilterOptionIds` state (~line 100-101) that already drives CSV/XLSX export. We will reuse this exact state as the single source of truth for chart display, report generation, and export — do not introduce a second/parallel filter state.
5. `stats` (loaded via the route `loader` at ~line 49, not reactive to `csvFilterQuestionId`) is read in exactly 4 places in the JSX: line ~1650 (`subtab === "ringkasan" && stats`), ~1695 (`stats.filter(...).map(...)` → `ChartCard`), ~1710 (`subtab === "pertanyaan" && stats`), ~1738 (`stats.find(...)` for the selected question detail). All four will be swapped to a new `activeStats` derived value (see §6).
6. **⚠️ Correction — template does NOT yet have a subtitle placeholder.** `templates/laporan-survei-template.docx`, as currently checked into this zip, opens with a fixed `Heading1` paragraph containing the literal static text `ANALISIS KEPUASAN MAHASISWA`, immediately followed by a separate centered paragraph containing only `{survey.title}`. There is **no** `{survey.subtitle}` anywhere in `word/document.xml` — confirmed by unzipping the `.docx` and grepping its XML. This contradicts the assumption that the template was already updated. Two possibilities: the zip you're working from predates the template edit, or the edit didn't make it into this copy. **Do not silently redesign the template's visual layout** (per `instruction/07-report-generation.md` §"the agent should not attempt to generate the template's visual layout from scratch") — instead, do the minimal mechanical fix in §1 below, and flag to the user that the template in the repo needed this patch so they can confirm it matches what they intended.
7. `report_generations` table (`src/server/db/schema.ts` ~line 189) currently has no notion of "which filter produced this file" — `getLatestSurveyReportFn` (~line 1848) always returns the single most recent row for the survey, regardless of filter. Once reports become filter-aware, this needs to change too, or an admin who generates an unfiltered report and then a filtered one will see the wrong cached file offered for instant download.

---

## 1. Template — add the missing `{survey.subtitle}` placeholder

File: `templates/laporan-survei-template.docx` (rendered via `docx-templates`, confirmed in `package.json` and `adminSurveyFunctions.ts` ~line 1501-1502).

This is a small, mechanical edit — one new paragraph, no layout redesign. Follow the project's existing docx-editing pattern (unzip → edit `word/document.xml` in place → rezip; do not use a docx-generation library to rebuild the file, that would drop styles/theme/fonts):

```bash
mkdir -p /tmp/tpl && cd /tmp/tpl
unzip -q -o /path/to/repo/templates/laporan-survei-template.docx -d unpacked
```

In `unpacked/word/document.xml`, find this exact sequence near the top of `<w:body>`:

```xml
<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:jc w:val="center"/></w:pPr><w:r><w:t>ANALISIS KEPUASAN MAHASISWA</w:t></w:r></w:p><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>{survey.title}</w:t></w:r></w:p>
```

Insert a new centered paragraph for the subtitle immediately after the `{survey.title}` paragraph, styled smaller/lighter so it visually reads as a sub-heading rather than a second title (use `sz="20"` = 10pt, italic, to differentiate from the Heading1/title above it — adjust to match `styles.xml`'s existing scale if it defines a matching style like `Subtitle`, check `unpacked/word/styles.xml` for a `w:styleId="Subtitle"` first and prefer that over manual run properties if it exists):

```xml
<w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:i/><w:sz w:val="20"/></w:rPr></w:pPr><w:r><w:rPr><w:i/><w:sz w:val="20"/></w:rPr><w:t>{survey.subtitle}</w:t></w:r></w:p>
```

So the full replacement is:

```xml
<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:jc w:val="center"/></w:pPr><w:r><w:t>ANALISIS KEPUASAN MAHASISWA</w:t></w:r></w:p><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>{survey.title}</w:t></w:r></w:p><w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:i/><w:sz w:val="20"/></w:rPr></w:pPr><w:r><w:rPr><w:i/><w:sz w:val="20"/></w:rPr><w:t>{survey.subtitle}</w:t></w:r></w:p>
```

Rezip without changing compression/structure of the other parts:

```bash
cd /tmp/tpl/unpacked
zip -q -r -X /path/to/repo/templates/laporan-survei-template.docx word/document.xml
```

Sanity check before moving on — reopen the zip and confirm exactly one occurrence of each placeholder:

```bash
unzip -p /path/to/repo/templates/laporan-survei-template.docx word/document.xml | grep -o "{survey\.[a-zA-Z]*}"
# expect: {survey.title}  {survey.subtitle}  {survey.periodLabel}
```

If `styles.xml` turns out to define a proper `Subtitle` style, redo the inserted paragraph as `<w:p><w:pPr><w:pStyle w:val="Subtitle"/><w:jc w:val="center"/></w:pPr><w:r><w:t>{survey.subtitle}</w:t></w:r></w:p>` instead of manual run properties, so it stays consistent with whatever the user already designed for the rest of the document.

---

## 2. Server — shared filter-scope helper (`src/server/adminSurveyFunctions.ts`)

Add this near the existing `slugify` helper (~line 1049, just above `buildSurveyResponseExport`). It turns a resolved filter into the human-readable subtitle string, e.g. `"PPDGS Bedah Mulut"` for a single value, `"PPDGS Bedah Mulut, PPDGS Konservasi Gigi"` for multiple, or `"Seluruh Data Responden"` when no filter is active. This keeps the wording identical everywhere it's used (chart preview, docx subtitle, Groq prompt).

```ts
// Human-readable description of the currently applied response filter —
// used as the docx subtitle, the Groq prompt context line, and the
// on-screen "cakupan data" preview. Keep this the single source of wording.
function buildFilterSubtitle(
	filterQuestion: { title: string } | undefined,
	filterOptions: { label: string }[],
): string {
	if (!filterQuestion || filterOptions.length === 0) {
		return "Seluruh Data Responden";
	}
	return filterOptions.map((o) => o.label).join(", ");
}
```

---

## 3. Server — make `computeSurveyStats` filter-aware

File: `src/server/adminSurveyFunctions.ts`, function starts at line 475.

### 3.1 Signature change

```ts
async function computeSurveyStats(
	surveyId: number,
	userRole: "admin" | "visitor",
	filter?: { filterQuestionId?: number; filterOptionIds?: number[] },
) {
```

### 3.2 Resolve + validate the filter, then restrict `allAnswers`

Right after `surveyOptions` is fetched (before the existing `const allAnswers = ...` block at ~line 504), resolve and validate the filter against this survey's actual questions/options — mirror the validation already done inside `buildSurveyResponseExport` (~line 1090-1113) so behavior (and error messages) stay identical whether the filter is used for export or for stats/report:

```ts
let filterQuestion: (typeof surveyQuestions)[number] | undefined;
let filterOptions: (typeof surveyOptions)[number][] = [];

if (
	filter?.filterQuestionId != null &&
	filter.filterOptionIds &&
	filter.filterOptionIds.length > 0
) {
	filterQuestion = surveyQuestions.find((q) => q.id === filter!.filterQuestionId);
	filterOptions = surveyOptions.filter(
		(o) =>
			filter!.filterOptionIds!.includes(o.id) &&
			o.questionId === filter!.filterQuestionId,
	);
	if (!filterQuestion || filterOptions.length === 0) {
		throw new Error("Filter pertanyaan/nilai tidak valid untuk survei ini.");
	}
	if (filterQuestion.type === "grid") {
		throw new Error(
			"Filter berdasarkan pertanyaan tipe Kisi Pilihan Ganda (Matrix) belum didukung.",
		);
	}
}
```

Then, immediately after the existing `allAnswers` query (~line 505-524), narrow it in-memory to only the responses matching the filter — same intersection logic as `buildSurveyResponseExport` (~line 1141-1156), just reused here so grid/multiple_choice/checkboxes/text aggregation all inherit the restriction for free since they all derive from `allAnswers`:

```ts
let scopedAnswers = allAnswers;
if (filterQuestion && filterOptions.length > 0) {
	const filterOptionIdSet = new Set(filterOptions.map((o) => o.id));
	const matchingResponseIds = new Set(
		allAnswers
			.filter((a) => a.questionId === filterQuestion!.id)
			.filter((a) => {
				const optIds = a.valueOptionIds as number[] | null;
				return !!optIds && optIds.some((id) => filterOptionIdSet.has(id));
			})
			.map((a) => a.responseId),
	);
	scopedAnswers = allAnswers.filter((a) => matchingResponseIds.has(a.responseId));
}
```

Replace every subsequent use of `allAnswers` **inside the `stats` aggregation** (the `qAnswers = allAnswers.filter((a) => a.questionId === q.id)` call at ~line 529, and the equivalent ones used for `linear_scale`/`grid`/text aggregation further down) with `scopedAnswers` instead. Do **not** rename the function's returned `allAnswers` field yet — see §3.4.

### 3.3 Filtered response count

Also fetch the plain completed-response count for this survey/filter (mirrors `buildSurveyResponseExport`'s `filteredResponses.length`, needed so the "Total Jawaban" card and the report's `responseCount` line stay consistent with whatever subset is being analyzed). Add this near the top, alongside the other queries:

```ts
const allCompletedResponses = await db
	.select({ id: responses.id })
	.from(responses)
	.where(and(eq(responses.surveyId, surveyId), eq(responses.status, "completed")));

let responseCount = allCompletedResponses.length;
if (filterQuestion && filterOptions.length > 0) {
	const filterOptionIdSet = new Set(filterOptions.map((o) => o.id));
	const matchingResponseIds = new Set(
		allAnswers
			.filter((a) => a.questionId === filterQuestion!.id)
			.filter((a) => {
				const optIds = a.valueOptionIds as number[] | null;
				return !!optIds && optIds.some((id) => filterOptionIdSet.has(id));
			})
			.map((a) => a.responseId),
	);
	responseCount = allCompletedResponses.filter((r) =>
		matchingResponseIds.has(r.id),
	).length;
}
```

(You can compute `matchingResponseIds` once and reuse it for both §3.2 and §3.3 instead of twice — just place it before both usages.)

### 3.4 Return shape

Update the `return` at the end of `computeSurveyStats` (currently `return { stats, surveyQuestions, surveyOptions, allAnswers, surveySections, firstSectionId };`) to also expose the resolved filter, the human-readable subtitle, and the filtered response count — every caller needs these three, so compute them once here instead of re-deriving them at each call site:

```ts
return {
	stats,
	surveyQuestions,
	surveyOptions,
	allAnswers: scopedAnswers,
	surveySections,
	firstSectionId,
	filterQuestion,
	filterOptions,
	subtitle: buildFilterSubtitle(filterQuestion, filterOptions),
	responseCount,
};
```

`allAnswers` now returns the **scoped** set — check the two existing call sites (`getAdminSurveyAnswersStatsFn` at ~line 679 and `generateSurveyReportFn` at ~line 1540-1546-ish) to confirm nothing downstream relied on the old unfiltered `allAnswers` for a purpose other than per-question aggregation. In `generateSurveyReportFn`, the Groq prompt loop (§5) and the indicator/chart loop both iterate per-question and are meant to reflect the filtered scope, so this is the correct behavior — not a regression.

---

## 4. Server — `getAdminSurveyAnswersStatsFn` (on-screen charts)

File: `src/server/adminSurveyFunctions.ts`, ~line 677.

### 4.1 Validator + handler

Current implementation takes a bare `surveyId` as the validator payload (`.validator((surveyId: number) => surveyId)`) — this becomes a structured object:

```ts
export const getAdminSurveyAnswersStatsFn = createServerFn({ method: "GET" })
	.validator(
		(data: {
			surveyId: number;
			filterQuestionId?: number;
			filterOptionIds?: number[];
		}) => data,
	)
	.handler(async ({ data }) => {
		const user = await assertUser();
		const { stats, subtitle, responseCount } = await computeSurveyStats(
			data.surveyId,
			user.role,
			{
				filterQuestionId: data.filterQuestionId,
				filterOptionIds: data.filterOptionIds,
			},
		);
		return { stats, subtitle, responseCount };
	});
```

This is a breaking signature change — there are exactly **two** callers today (`src/routes/admin/surveys.$surveyId.tsx`, loader ~line 49 and the filter-refetch effect added in §6), both updated in §6.

---

## 5. Server — `generateSurveyReportFn` (AI narrative + docx)

File: `src/server/adminSurveyFunctions.ts`, ~line 1486.

### 5.1 Validator

Add the same two optional filter fields already used by the CSV/XLSX exports:

```ts
export const generateSurveyReportFn = createServerFn({ method: "POST" })
	.validator(
		(data: {
			surveyId: number;
			charts: { questionId: number; label: string; imageBase64: string }[];
			filterQuestionId?: number;
			filterOptionIds?: number[];
		}) => data,
	)
	.handler(async ({ data: { surveyId, charts, filterQuestionId, filterOptionIds } }) => {
```

### 5.2 Feed the filter into `computeSurveyStats`, drop the old separate response-count query

Replace the existing standalone `responseCountResult` query (~line 1528-1537, `select count(*) from responses where ...`) — it's now redundant since `computeSurveyStats` returns the correctly-scoped `responseCount`. Update the `computeSurveyStats` call:

```ts
const {
	stats,
	surveyQuestions,
	surveyOptions,
	allAnswers,
	firstSectionId,
	filterQuestion,
	filterOptions,
	subtitle,
	responseCount,
} = await computeSurveyStats(surveyId, user.role, { filterQuestionId, filterOptionIds });
```

Delete the old `responseCountResult`/`responseCount` block entirely — `responseCount` now comes from `computeSurveyStats`.

### 5.3 Tell the AI what scope it's analyzing

In the Groq prompt builder (~line 1618-1621, right after `Judul Survei:` and before the `Periode:` line), add the scope line so the model doesn't write as if it's summarizing the whole population when it's actually looking at one Program Studi (or whatever question was filtered on):

```ts
let userPrompt = `Berikut adalah data hasil survei:\n\n`;
userPrompt += `Judul Survei: ${survey.title}\n`;
userPrompt += `Cakupan Data: ${subtitle}\n`;
if (survey.periodValue) {
	userPrompt += `Periode: ${survey.periodValue} s/d ${survey.periodValueEnd || ""}\n`;
}
userPrompt += `Jumlah Responden: ${responseCount} orang\n\n`;
```

(Everything after this in the prompt-building loop already reads from `surveyQuestions`/`allAnswers`/`stats`, which are already scoped by `computeSurveyStats` — no further change needed there.)

### 5.4 Populate `survey.subtitle` in the docx data payload

The `data` object passed to `createReport` (~line 1807) currently only sets `survey: { title, periodLabel }` — add `subtitle` (this is what §1's new template placeholder consumes):

```ts
const data = {
	survey: {
		title: survey.title,
		subtitle,
		periodLabel,
	},
	responseCount,
	overallMean: overallMeanVal > 0 ? overallMeanVal.toFixed(2) : "-",
	overallCategory: overallCategoryVal,
	pendahuluan: analysis.pendahuluan,
	kesimpulan: analysis.kesimpulan,
	indicators: indicatorsData,
	charts: chartsData,
	interpretationParagraphs: interpretationParagraphsData,
	recommendations: analysis.recommendations || [],
};
```

### 5.5 Filename suffix (consistency with CSV/XLSX)

Right before building `filenameVal` (~line 1830), add the same slug suffix pattern already used in `buildSurveyResponseExport` (~line 1280):

```ts
const filenameSuffix =
	filterQuestion && filterOptions.length > 0
		? `_${slugify(filterQuestion.title)}-${filterOptions.map((o) => slugify(o.label)).join("+")}`
		: "";
const filenameVal = `Laporan_Survei_${survey.slug}${filenameSuffix}.docx`;
```

### 5.6 Store the filter scope on the generated record (needed for §7)

Compute a normalized `filterKey` — a single deterministic string identifying "no filter" vs a specific question+values combination, sorted so option order doesn't matter:

```ts
const filterKey =
	filterQuestion && filterOptions.length > 0
		? `${filterQuestion.id}:${filterOptions.map((o) => o.id).sort((a, b) => a - b).join(",")}`
		: "";
```

Update the `db.insert(reportGenerations)` call (~line 1833-1838) to include it:

```ts
await db.insert(reportGenerations).values({
	surveyId,
	userId,
	fileBase64: base64Data,
	fileName: filenameVal,
	filterKey,
});
```

**Do not** scope `assertReportRateLimit` (~line 1458, the 10-minute cooldown) by `filterKey`. Keep it exactly as-is — global per `surveyId` + `userId` regardless of filter. The cooldown exists to control Groq API cost/abuse; scoping it per-filter would let an admin bypass it just by toggling the filter dropdown.

---

## 6. Server — schema + migration for `report_generations.filter_key`

File: `src/server/db/schema.ts`, `reportGenerations` table (~line 189-200).

```ts
export const reportGenerations = mysqlTable("report_generations", {
	id: int("id").autoincrement().primaryKey(),
	surveyId: int("survey_id")
		.references(() => surveys.id, { onDelete: "cascade" })
		.notNull(),
	userId: int("user_id")
		.references(() => users.id, { onDelete: "cascade" })
		.notNull(),
	generatedAt: timestamp("generated_at").notNull().defaultNow(),
	fileBase64: mediumtext("file_base_64"),
	fileName: varchar("file_name", { length: 255 }),
	filterKey: varchar("filter_key", { length: 255 }).notNull().default(""),
});
```

Generate and apply the migration (per `package.json` scripts):

```bash
bun run db:generate
bun run db:migrate
```

Verify the generated SQL is an additive `ALTER TABLE report_generations ADD COLUMN filter_key varchar(255) NOT NULL DEFAULT ''` — it should not touch existing rows' data (existing rows will simply get `filter_key = ''`, i.e. treated as "unfiltered", which is correct since they were all generated before this feature existed).

---

## 7. Server — `getLatestSurveyReportFn` (filter-aware cache lookup)

File: `src/server/adminSurveyFunctions.ts`, ~line 1848.

```ts
export const getLatestSurveyReportFn = createServerFn({ method: "GET" })
	.validator(
		(data: {
			surveyId: number;
			filterQuestionId?: number;
			filterOptionIds?: number[];
		}) => data,
	)
	.handler(async ({ data }) => {
		await assertAdmin();

		const filterKey =
			data.filterQuestionId != null && data.filterOptionIds && data.filterOptionIds.length > 0
				? `${data.filterQuestionId}:${[...data.filterOptionIds].sort((a, b) => a - b).join(",")}`
				: "";

		const [latest] = await db
			.select({
				id: reportGenerations.id,
				fileName: reportGenerations.fileName,
				fileBase64: reportGenerations.fileBase64,
				generatedAt: reportGenerations.generatedAt,
			})
			.from(reportGenerations)
			.where(
				and(
					eq(reportGenerations.surveyId, data.surveyId),
					eq(reportGenerations.filterKey, filterKey),
				),
			)
			.orderBy(desc(reportGenerations.generatedAt))
			.limit(1);

		if (!latest || !latest.fileBase64) return null;

		return {
			id: latest.id,
			fileName: latest.fileName || "Laporan_Survei.docx",
			base64: latest.fileBase64,
			generatedAt: latest.generatedAt.toISOString(),
		};
	});
```

This is also a breaking signature change (`surveyId: number` → `data: {...}`) — two callers today, both in `surveys.$surveyId.tsx` (~line 145 and ~line 740), updated in §8.4.

---

## 8. Client — `src/routes/admin/surveys.$surveyId.tsx`

### 8.1 Loader — new validator shape for the initial (unfiltered) stats fetch

Line ~49, currently `stats = await getAdminSurveyAnswersStatsFn({ data: surveyId });`:

```ts
stats = await getAdminSurveyAnswersStatsFn({ data: { surveyId } });
```

### 8.2 `activeStats` — filtered stats decoupled from the loader

The loader is not reactive to `csvFilterQuestionId`/`csvFilterOptionIds` (they're plain `useState`, not search params), so introduce a small client-side refetch instead of moving the filter into the URL (keeps this change scoped, doesn't touch the route's `validateSearch`/`loaderDeps`).

Add near the other response-tab state (next to `csvFilterOptionIds`, ~line 101):

```ts
const [activeStats, setActiveStats] = useState(stats);
const [isLoadingStats, setIsLoadingStats] = useState(false);
```

Add an effect that re-fetches whenever the filter changes, but only while a chart-showing sub-tab is active (keep it simple and fetch whenever `tab === "responses"`, since both "ringkasan" and "pertanyaan" consume `activeStats` and switching sub-tabs shouldn't need a network round trip):

```ts
useEffect(() => {
	if (tab !== "responses" || user?.role === "visitor") return;
	let cancelled = false;
	setIsLoadingStats(true);
	getAdminSurveyAnswersStatsFn({
		data: {
			surveyId,
			filterQuestionId: csvFilterQuestionId ? Number(csvFilterQuestionId) : undefined,
			filterOptionIds:
				csvFilterOptionIds.length > 0 ? csvFilterOptionIds.map(Number) : undefined,
		},
	})
		.then((res) => {
			if (!cancelled) setActiveStats(res);
		})
		.catch((err) => {
			if (!cancelled) toast.error(err.message || "Gagal memuat statistik terfilter.");
		})
		.finally(() => {
			if (!cancelled) setIsLoadingStats(false);
		});
	return () => {
		cancelled = true;
	};
	// eslint-disable-next-line react-hooks/exhaustive-deps
}, [surveyId, tab, csvFilterQuestionId, csvFilterOptionIds]);
```

Note `getAdminSurveyAnswersStatsFn` now returns `{ stats, subtitle, responseCount }` (§4), not a bare array — `activeStats` is this whole object. Update the 4 JSX read sites (§0 point 5) accordingly:

- Line ~1650: `{subtab === "ringkasan" && activeStats && (`
- `{detail.responseCount}` → `{activeStats?.responseCount ?? detail.responseCount}` (so the "Total Jawaban" card reflects the filtered count, not the survey-wide total, whenever a filter is active)
- Line ~1695: `{activeStats.stats.filter((stat: any) => !stat.redacted).map((stat: any) => (`
- `responseCount={...}` prop into `ChartCard` → simplify to `responseCount={activeStats.responseCount}`
- Line ~1710: `{subtab === "pertanyaan" && activeStats && (() => {`
- Line ~1738: `const selectedStat = activeStats.stats.find((s: any) => s.questionId === activeQid);`

Optionally show a subtle loading indicator (e.g. dim the chart area or a small spinner) while `isLoadingStats` is true, so switching the filter doesn't feel like a silent no-op while the request is in flight — not required, but recommended given `ChartCard` re-renders synchronously off `activeStats`.

### 8.3 Filter-scope preview + wiring into `handleGenerateReport`

Right after the filter bar (~line 1595, after the "Reset" button at ~1581-1595, before the export menu at ~1597), add a small human-readable preview so the admin sees exactly what will end up as the docx subtitle **before** they generate:

```tsx
{activeStats?.subtitle && (
	<span className="text-xs text-[#434652] italic whitespace-nowrap">
		Cakupan: <strong>{activeStats.subtitle}</strong>
	</span>
)}
```

Update `handleGenerateReport` (the call to `generateSurveyReportFn` at ~line 708) to send the current filter:

```ts
const res = await generateSurveyReportFn({
	data: {
		surveyId,
		charts,
		filterQuestionId: csvFilterQuestionId ? Number(csvFilterQuestionId) : undefined,
		filterOptionIds:
			csvFilterOptionIds.length > 0 ? csvFilterOptionIds.map(Number) : undefined,
	},
});
```

Also update the `fetchLatestReport()` call right after a successful generation (~line 740) — see §8.4, it needs the filter too.

### 8.4 `fetchLatestReport` — filter-aware

Currently `const report = await getLatestSurveyReportFn({ data: surveyId });` (~line 145):

```ts
const fetchLatestReport = async () => {
	try {
		const report = await getLatestSurveyReportFn({
			data: {
				surveyId,
				filterQuestionId: csvFilterQuestionId ? Number(csvFilterQuestionId) : undefined,
				filterOptionIds:
					csvFilterOptionIds.length > 0 ? csvFilterOptionIds.map(Number) : undefined,
			},
		});
		setLatestReport(report);
	} catch (err) {
		console.error("Gagal memuat laporan terakhir:", err);
	}
};
```

Add `csvFilterQuestionId` and `csvFilterOptionIds` to the mount-time effect's dependency array (~line 153-154, currently `useEffect(() => { fetchLatestReport(); }, [surveyId]);`) so switching the filter also re-checks whether a matching cached report exists, and correctly clears/hides the "Unduh Laporan Terakhir" button when there is none for the newly selected scope (since `getLatestSurveyReportFn` now returns `null` for a filter combination that's never been generated):

```ts
useEffect(() => {
	fetchLatestReport();
}, [surveyId, csvFilterQuestionId, csvFilterOptionIds]);
```

---

## 9. Testing checklist

Run through this manually against a survey that has a `multiple_choice` or `dropdown` question (e.g. "Program Studi") with several options and existing responses:

1. **Template patched (§1)** — reopen `templates/laporan-survei-template.docx` in Word (or unzip and grep) and confirm it now shows the static "ANALISIS KEPUASAN MAHASISWA" heading, then `{survey.title}`, then a new smaller/italic `{survey.subtitle}` line — and that the file still opens cleanly in Word (no "repair document" prompt, which would mean the rezip broke something).
2. **No filter selected** — "Ringkasan" charts, "Total Jawaban" count, and "Generate Laporan" all behave exactly as before this change (subtitle renders as "Seluruh Data Responden", `responseCount` matches the survey total).
3. **Select a filter with one value** (e.g. "Program Studi = PPDGS Bedah Mulut") — confirm the on-screen charts in "Ringkasan" and "Pertanyaan" visibly change to reflect only that subset before generating anything.
4. **Generate Laporan while filtered** — open the resulting `.docx` and confirm: title = survey title, subtitle = the selected option label(s) exactly, indicator table + charts + AI narrative all describe only the filtered subset, `Jumlah responden` line matches the filtered count (not the survey total).
5. **Switch the filter to a different value, generate again** — confirm the filename differs (suffix changes) and does not silently overwrite/collide with the previous filtered report in `report_generations`.
6. **Reset filter, click "Unduh Laporan Terakhir"** — confirm it does *not* offer the filtered report generated in step 4/5; it should show nothing (or the last unfiltered report) instead.
7. **Re-select the exact same filter used in step 4** — confirm "Unduh Laporan Terakhir" now reappears and downloads that exact cached file instantly, without hitting Groq again.
8. **Cooldown check** — generating a filtered report immediately after an unfiltered one (or vice versa) within the same 10-minute window still hits the rate limit (confirms §5.6's note that `filterKey` must NOT be part of `assertReportRateLimit`).
9. **CSV/XLSX export still works unchanged** — confirm `buildSurveyResponseExport` wasn't touched and both exports still behave exactly as before.
