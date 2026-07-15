# Instruction 10 — XLSX Export with Frozen Header + Column Filter (Google Forms–style), Combined Export Dropdown

**Audience:** CLI coding agent (Claude Code) working directly in this repo.
**Primary files in scope:** `src/server/adminSurveyFunctions.ts`, `src/routes/admin/surveys.$surveyId.tsx`
**Stack reminders:** Bun, TanStack Start (`createServerFn`), Drizzle/MySQL, Tailwind, all UI copy in Bahasa Indonesia. Read `instruction/05-responses-tab-revamp.md` §3.2 first — it documents the CSV export this instruction extends (`exportAdminSurveyResponsesCSVFn` / `handleDownloadCSV`).

Read this whole document before touching code.

---

## 0. Answering the underlying question first (context for the agent, not just the user)

**"Apakah frozen header + filter per kolom bisa terjadi jika ekspor sebagai CSV?" → Tidak.** CSV is a plain-text, application-agnostic format (just comma-separated values) — it has no concept of a "frozen row," a per-column filter dropdown, cell styling, or column width. Those are all features of the **spreadsheet file itself** (`.xlsx`, Office Open XML) that Excel/Google Sheets render UI around when they open the file — specifically:
- **Frozen header row** → an XLSX "pane" setting (`worksheet.views` in `exceljs`), stored in the file.
- **Per-column filter dropdown arrows** (what the screenshots show — "Urutkan A ke Z", "Filter menurut nilai", etc.) → this is an XLSX **AutoFilter** range (`worksheet.autoFilter`), also stored in the file. Google Sheets renders its own filter UI on top of it when you open an `.xlsx`, but the *capability* has to be baked into the exported file — it is not something CSV can carry at all.

So: this feature is **XLSX-only**. CSV export stays as a lightweight plain-text fallback (e.g. for pasting into other tools, diffing, or scripts) but will never get frozen headers or filter dropdowns — don't try to fake it there.

---

## 1. Current state (audit)

1. `exportAdminSurveyResponsesCSVFn` (`src/server/adminSurveyFunctions.ts`, ~line 1027-1298) does all of this in one handler:
   - Loads survey/sections/questions/options.
   - Validates/resolves the optional `filterQuestionId` + `filterOptionIds` (rejects `grid`-type filters, rejects invalid ids).
   - Loads completed responses + answers, applies the filter in memory.
   - Builds a `summaryRows` array (title, total count, exported-at, filter-applied line).
   - Builds `columnPlans: { header, resolve }[]` — "No. Respon", "Timestamp", then one column per question (grid questions expand into one column per row, with a collision-safe header when two grid questions share a row label).
   - Joins everything into a single CSV string with a UTF-8 BOM prefix.
2. Client-side, `handleDownloadCSV` (~line 519-545) calls it and triggers a `Blob` download. The trigger button (~line 1486-1497) is a single `<button>` inside the `Filter CSV:` bar, disabled when a filter question is picked but no option values are checked yet.
3. There is no `exceljs`, `xlsx`, or any spreadsheet-writing library in `package.json` yet — this needs to be added.
4. `docx-templates` (used by `generateSurveyReportFn`) is dynamically imported inside its handler specifically to avoid a client-bundling leak (see `instruction/report-generation-report.md` §D "Isomorphism & Dynamic Imports"). Follow the exact same pattern for the new spreadsheet library — do not add a static top-level `import` for it in a file that's part of the client bundle.

---

## 2. Dependency

Add `exceljs` (pure JS, actively maintained, supports frozen panes + autoFilter + cell styling + column widths — unlike the `xlsx`/SheetJS community edition, which has weaker/inconsistent support for writing views and autofilters):

```bash
bun add exceljs
```

---

## 3. Server refactor — `src/server/adminSurveyFunctions.ts`

### 3.1 Extract the shared "build export data" logic

The CSV handler currently mixes three concerns: (a) loading + filtering + validating, (b) building `columnPlans`, (c) serializing to CSV text. Only (c) is CSV-specific. Extract (a) + (b) into a private helper so the new XLSX handler doesn't duplicate ~250 lines:

```ts
// Shared by CSV and XLSX response exports — loads, filters, and shapes
// response data into column plans + summary metadata. Serialization
// (CSV text vs XLSX workbook) stays in each individual export handler.
async function buildSurveyResponseExport(data: {
	surveyId: number;
	filterQuestionId?: number;
	filterOptionIds?: number[];
}) {
	const { surveyId, filterQuestionId, filterOptionIds } = data;

	// ... move the entire body currently in exportAdminSurveyResponsesCSVFn's
	// handler from "1. Load survey, sections, questions, options" through the
	// end of "4. Build column plans" (i.e. everything up to, but NOT including,
	// "5. Generate CSV strings") into this function, unchanged.
	//
	// Return everything both serializers need:
	return {
		survey,
		filteredResponses,
		answersByResponseId,
		columnPlans, // { header, resolve }[]
		summaryLines: [
			`Ringkasan Survei — ${survey.title}`,
			`Total Respon (Selesai): ${filteredResponses.length}`,
			`Diekspor pada: ${new Date().toISOString()}`,
			...(filterQuestion && filterOptions.length > 0
				? [`Filter Diterapkan: ${filterQuestion.title} = ${filterOptions.map((o) => o.label).join(", ")}`]
				: []),
		],
		filenameSuffix,
	};
}
```

Notes:
- Keep the **authorization check** (`assertUser()` + `role !== "admin"` throw) inside this shared helper, called once — don't duplicate the role check in both export handlers.
- `summaryLines` here is a plain string array (one logical line each), not pre-joined with commas — each serializer formats it however fits its own file format (CSV puts each line as its own row; XLSX will merge-and-style them as header rows, see §3.3).
- Don't change any of the existing column-building behavior (grid expansion, collision-safe headers, `checkboxes` joining with `"; "`, etc.) — this is a pure extraction, not a rewrite.

### 3.2 Update `exportAdminSurveyResponsesCSVFn` to use the shared helper

```ts
export const exportAdminSurveyResponsesCSVFn = createServerFn({ method: "GET" })
	.validator(
		(data: { surveyId: number; filterQuestionId?: number; filterOptionIds?: number[] }) => data,
	)
	.handler(async ({ data }) => {
		const { survey, filteredResponses, answersByResponseId, columnPlans, summaryLines, filenameSuffix } =
			await buildSurveyResponseExport(data);

		const csvEscape = (val: string | null | undefined) => {
			if (val === null || val === undefined) return '""';
			return `"${String(val).replace(/"/g, '""')}"`;
		};

		const summaryRows = summaryLines.map((line) => {
			// Preserve the existing "Label,Value" comma-split behavior for the
			// count/date/filter lines, but keep the title line as a single cell.
			const idx = line.indexOf(": ");
			if (idx === -1) return line;
			return `${line.slice(0, idx)},${csvEscape(line.slice(idx + 2))}`;
		});

		const headerRow = columnPlans.map((cp) => csvEscape(cp.header)).join(",");
		const dataRows = filteredResponses.map((r, idx) => {
			const ansList = answersByResponseId.get(r.id) || [];
			return columnPlans.map((cp) => csvEscape(cp.resolve(r, idx, ansList))).join(",");
		});

		const csvContent = "\uFEFF" + [...summaryRows, "", headerRow, ...dataRows].join("\n");

		return {
			csv: csvContent,
			filename: `responses_survey_${survey.slug}${filenameSuffix}.csv`,
		};
	});
```

Double-check the reformatted `summaryRows` mapping produces **byte-identical** output to the current hardcoded `summaryRows.push(...)` calls (§0 in `instruction/05-responses-tab-revamp.md`'s audit flagged CSV correctness as a known sore spot for this app — don't regress it). If the split-on-`": "` approach is fragile (e.g. a survey title containing `": "`), keep building `summaryLines` as already-comma-formatted strings in the shared helper instead, and have the CSV handler use them as-is without re-splitting. Prefer whichever is less error-prone — this is an implementation detail, the important constraint is "CSV output must not change from what it produces today."

### 3.3 New: `exportAdminSurveyResponsesXLSXFn`

```ts
export const exportAdminSurveyResponsesXLSXFn = createServerFn({ method: "GET" })
	.validator(
		(data: { surveyId: number; filterQuestionId?: number; filterOptionIds?: number[] }) => data,
	)
	.handler(async ({ data }) => {
		const { survey, filteredResponses, answersByResponseId, columnPlans, summaryLines, filenameSuffix } =
			await buildSurveyResponseExport(data);

		// Dynamic import — same reasoning as docx-templates in generateSurveyReportFn:
		// avoid Rspack trying to bundle a server-only package into the client build.
		const ExcelJS = (await import("exceljs")).default;

		const workbook = new ExcelJS.Workbook();
		workbook.creator = "Tracer Study";
		workbook.created = new Date();

		const sheet = workbook.addWorksheet("Respon", {
			views: [], // set after we know how many summary rows precede the header
		});

		// 1. Summary block — same content as the CSV summary rows, one Excel row each.
		summaryLines.forEach((line) => {
			sheet.addRow([line]);
		});
		sheet.addRow([]); // blank separator row, matches CSV layout

		const headerRowIndex = summaryLines.length + 2; // 1-based; +1 for blank row, +1 to land on the row AFTER it
		const headerRow = sheet.addRow(columnPlans.map((cp) => cp.header));

		// 2. Header styling — bold white text on the app's navy brand color.
		headerRow.eachCell((cell) => {
			cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
			cell.fill = {
				type: "pattern",
				pattern: "solid",
				fgColor: { argb: "FF002972" }, // matches the app's existing #002972 brand navy
			};
			cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
		});
		headerRow.height = 22;

		// 3. Data rows.
		filteredResponses.forEach((r, idx) => {
			const ansList = answersByResponseId.get(r.id) || [];
			const values = columnPlans.map((cp) => cp.resolve(r, idx, ansList));
			sheet.addRow(values);
		});

		// 4. Column widths — size to content, with sane min/max so long open-text
		// answers don't blow the sheet out to an unusable width.
		sheet.columns.forEach((col, i) => {
			const headerLen = String(columnPlans[i]?.header ?? "").length;
			let maxLen = headerLen;
			col.eachCell?.({ includeEmpty: false }, (cell) => {
				const len = String(cell.value ?? "").length;
				if (len > maxLen) maxLen = len;
			});
			col.width = Math.min(Math.max(maxLen + 2, 12), 40);
		});

		// 5. Freeze panes — freeze everything from row 1 through the header row,
		// so the summary block AND the header stay pinned while scrolling data.
		sheet.views = [{ state: "frozen", xSplit: 0, ySplit: headerRowIndex }];

		// 6. AutoFilter — the actual "filter dropdown per column" feature from the
		// screenshots. Range covers header row through the last data row, NOT the
		// summary rows above it (filtering summary metadata makes no sense).
		const lastDataRowIndex = headerRowIndex + filteredResponses.length;
		const lastColLetter = sheet.getColumn(columnPlans.length).letter;
		sheet.autoFilter = {
			from: { row: headerRowIndex, column: 1 },
			to: { row: lastDataRowIndex, column: columnPlans.length },
		};

		const buffer = await workbook.xlsx.writeBuffer();

		return {
			// createServerFn responses are JSON-serialized — a raw ArrayBuffer/Buffer
			// won't survive the trip, so base64-encode it and decode on the client.
			base64: Buffer.from(buffer).toString("base64"),
			filename: `responses_survey_${survey.slug}${filenameSuffix}.xlsx`,
		};
	});
```

Notes / things to verify while implementing (don't skip — `exceljs`'s exact API surface can shift slightly between versions):
- Confirm the installed `exceljs` version's `Workbook.addWorksheet(name, { views })` vs. setting `sheet.views` after the fact both work — the snippet above sets `views: []` at creation then overwrites `sheet.views` later once `headerRowIndex` is known; simplify to a single assignment after all rows are added if that's cleaner in practice.
- Confirm `sheet.autoFilter` accepts the `{ from: {row, column}, to: {row, column} }` object form in the installed version; some `exceljs` versions prefer a string range like `"A5:M50"` — if the object form errors, build the range string instead (`` `A${headerRowIndex}:${lastColLetter}${lastDataRowIndex}` ``).
- If `filteredResponses.length === 0`, still write the header row and apply freeze/autofilter over just that single row (`to.row === headerRowIndex`) — don't crash on an empty export.
- Numeric columns ("No. Respon") and the "Timestamp" column: writing them as **plain strings** (matching current CSV behavior) is fine for a first pass and keeps `columnPlans.resolve` fully shared between both serializers. If you want proper Excel-native sorting/filtering on the timestamp (nice-to-have, matches "Google Forms–style" more closely since Forms exports real datetime cells), that requires branching per-column in the XLSX handler only (write `new Date(r.submittedAt)` with a date `numFmt` for that one column instead of using `cp.resolve`) — treat this as an optional enhancement, not a blocker, and don't let it reintroduce CSV/XLSX column-plan duplication if you do it.

---

## 4. Client changes — `src/routes/admin/surveys.$surveyId.tsx`

### 4.1 Import the new server function

Add `exportAdminSurveyResponsesXLSXFn` to the existing import block from `../../server/adminSurveyFunctions`.

### 4.2 New XLSX download handler

```ts
const handleDownloadXLSX = async () => {
	try {
		const res = await exportAdminSurveyResponsesXLSXFn({
			data: {
				surveyId,
				filterQuestionId: csvFilterQuestionId ? Number(csvFilterQuestionId) : undefined,
				filterOptionIds: csvFilterOptionIds.length > 0 ? csvFilterOptionIds.map(Number) : undefined,
			},
		});
		const byteChars = atob(res.base64);
		const byteNumbers = new Array(byteChars.length);
		for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
		const byteArray = new Uint8Array(byteNumbers);
		const blob = new Blob([byteArray], {
			type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		});
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

Keep `handleDownloadCSV` exactly as-is (§3.2 only changed its server counterpart, not the client call shape — same request payload, same response shape `{ csv, filename }`).

### 4.3 Combine both into one "Ekspor" dropdown

Replace the single "Download CSV" `<button>` (~line 1486-1497) with a small dropdown trigger + menu, reusing the **same disabled condition** it has today (`!!csvFilterQuestionId && csvFilterOptionIds.length === 0`).

There's no existing dropdown/menu pattern elsewhere in this specific route file (it hand-rolls its own UI with plain `div`/`button`, no headless-UI primitives), but `@base-ui/react` is already a project dependency (used in `src/components/ui/button.tsx`) and includes a `Menu` primitive if you'd rather not hand-roll open/close/click-outside logic — use your judgement on which fits better here; either is acceptable. If hand-rolling, the shape is:

```tsx
const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
const exportMenuRef = useRef<HTMLDivElement>(null);

useEffect(() => {
	if (!isExportMenuOpen) return;
	const handleClickOutside = (e: MouseEvent) => {
		if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
			setIsExportMenuOpen(false);
		}
	};
	document.addEventListener("mousedown", handleClickOutside);
	return () => document.removeEventListener("mousedown", handleClickOutside);
}, [isExportMenuOpen]);
```

```tsx
<div className="relative" ref={exportMenuRef}>
	<button
		type="button"
		onClick={() => setIsExportMenuOpen((v) => !v)}
		disabled={!!csvFilterQuestionId && csvFilterOptionIds.length === 0}
		className="bg-[#0b3e9c] text-white hover:bg-[#002972] disabled:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm active:scale-95 transition-transform cursor-pointer whitespace-nowrap"
	>
		<span className="material-symbols-outlined text-sm">download</span>
		<span>Ekspor</span>
		<span className="material-symbols-outlined text-sm">
			{isExportMenuOpen ? "expand_less" : "expand_more"}
		</span>
	</button>

	{isExportMenuOpen && (
		<div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-10 overflow-hidden">
			<button
				type="button"
				onClick={() => {
					setIsExportMenuOpen(false);
					handleDownloadXLSX();
				}}
				className="w-full text-left px-3 py-2 text-xs font-semibold text-[#1a1b21] hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
			>
				<span className="material-symbols-outlined text-sm">table_view</span>
				<span>Ekspor sebagai Excel (.xlsx)</span>
			</button>
			<button
				type="button"
				onClick={() => {
					setIsExportMenuOpen(false);
					handleDownloadCSV();
				}}
				className="w-full text-left px-3 py-2 text-xs font-semibold text-[#1a1b21] hover:bg-slate-50 flex items-center gap-2 cursor-pointer border-t border-slate-100"
			>
				<span className="material-symbols-outlined text-sm">description</span>
				<span>Ekspor sebagai CSV (.csv)</span>
			</button>
		</div>
	)}
</div>
```

Notes:
- Verify the `material-symbols-outlined` icon names used (`expand_more`, `expand_less`, `table_view`, `description`) actually render in this project's icon font setup (check how the font is loaded in `src/routes/__root.tsx` / global CSS — Material Symbols ships hundreds of icons but the app may be using a subset or a specific variable-font config). Swap to any equivalent already-used icon name in this file if one of these doesn't render (e.g. `download` is already proven to work).
- List **XLSX first, CSV second** in the menu — XLSX is now the richer/primary option per this feature request; CSV is the plain-text fallback.
- Don't forget to remove the now-unused standalone CSV button and its old `onClick={handleDownloadCSV}` wiring at the old location once replaced by the dropdown.

---

## 5. Manual verification checklist

1. As **admin**, open a survey's responses tab → click "Ekspor" → confirm a dropdown opens with "Ekspor sebagai Excel (.xlsx)" and "Ekspor sebagai CSV (.csv)", XLSX listed first.
2. Click outside the open dropdown → confirm it closes without triggering either export.
3. Export XLSX → open in Excel or Google Sheets → confirm: (a) the header row (and summary rows above it) stay pinned when scrolling down through responses, (b) every header cell has a filter dropdown arrow (Data → confirm "Sort A→Z / Sort Z→A / Filter by value" appear, matching the reference screenshots), (c) header cells are bold with the navy fill color, (d) column widths are reasonable (no column squished to unreadable width, no column absurdly wide from one long outlier answer).
4. Export XLSX with a CSV-style filter applied (`csvFilterQuestionId` + `csvFilterOptionIds` set) → confirm only matching responses appear and the filter-applied line shows correctly in the summary rows.
5. Export CSV (the existing path) → open the file → confirm it is **byte-for-byte unchanged** from before this instruction (same summary rows, same header row, same data rows) — this refactor must not alter CSV output, only add XLSX alongside it.
6. Export XLSX on a survey with zero completed responses → confirm it doesn't throw and produces a workbook with just the summary rows + header row.
7. Export XLSX on a survey with a `grid` question whose row labels collide with another question (the "duplicate grid row label" case documented in the CSV logic) → confirm the disambiguated header (`"{question title} — {row label}"`) still appears correctly in the XLSX header row.
8. Re-run `bun run build` → confirm no client-bundle leak warnings/errors from the `exceljs` dynamic import (mirroring the same check done for `docx-templates` per `instruction/report-generation-report.md` §3).

---

## 6. Explicitly out of scope for this task

- Any change to `generateSurveyReportFn` / the Word (.docx) report feature — unrelated export pipeline, do not touch.
- Native Excel cell types for every column (dates, numbers) beyond the optional Timestamp enhancement mentioned in §3.3 — the rest of the columns stay text, matching current CSV semantics, to keep `columnPlans` fully shared.
- Adding a general-purpose `@base-ui/react` Menu usage convention across the rest of the app — scope the dropdown implementation to this export button only; a broader migration (if desired) is a separate follow-up.
- Server-side XLSX caching/persistence (unlike the Word report's `report_generations` cache table) — every XLSX export request regenerates the file on demand; this is fast enough (same data volume as the existing CSV export) not to need caching.
