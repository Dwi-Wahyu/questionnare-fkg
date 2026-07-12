# Report: Automatic Survey Report Generation Implementation

This report documents the implementation of the **Automatic Survey Report Generation** feature in the Tracer Study application, adhering to the specifications in `07-report-generation.md` and integrating them with the existing codebase structures.

---

## 1. Summary of Changes Made

### A. Database Schema Addition & Migration
- Added the `report_generations` table to `src/server/db/schema.ts` to log successful generation attempts by survey and user.
- Generated the migration schema using `drizzle-kit generate` (resulting in `drizzle/0005_blue_mercury.sql`).
- Successfully applied the migration to the live MySQL database using `bun run db:migrate`.

### B. Client-side Chart Extraction & UI Refactoring (`src/lib/copyChartImage.ts`)
- Split the SVG-to-canvas rendering function `copyElementChartAsPng` into a two-layered utility:
  1. `chartElementToPngBlob`: Handles cloning the live SVG element, copying all computed styling (fill, stroke, opacity, typography), applying a white backdrop, scaling it at 2x for high resolution, and returning a `Blob`.
  2. `copyElementChartAsPng`: Reuses the blob to write to the system clipboard (or download as fallback).
  3. `chartElementToPngBase64`: Converts the blob to a standard base64 string for transmission.

### C. Server-side Statistics & Narrative Generation (`src/server/adminSurveyFunctions.ts`)
- **Shared Query Refactoring**: Extracted the statistics computation query block from `getAdminSurveyAnswersStatsFn` into a private helper function `computeSurveyStats`. Both the charts statistics endpoint and the new `generateSurveyReportFn` now call this helper, ensuring database query efficiency and avoiding duplication.
- **Midpoint Bucketing Logic**: Implemented `getScaleBucket` to determine bucket classification for scale scores based on the midpoints of option values.
- **Groq AI Integration**: Integrated direct HTTP fetch to Groq's Chat Completion API with the `llama-3.3-70b-versatile` model. We pass aggregated statistics (excluding personal info), scale bucketing labels, and open-ended text answers. Groq returns a structured JSON object containing introductory narrative, per-indicator narrative paragraphs, conclusion, and action items.
- **`docx-templates` Integration**: Loaded the checks-in `.docx` template (`templates/laporan-survei-template.docx`) and populated the fields:
  - Text metadata (`survey.title`, `survey.periodLabel`, `responseCount`).
  - Average stats indicators (`overallMean`, `overallCategory`).
  - Loop loops (`indicators`, `charts` with base64 PNG image stream, `interpretationParagraphs`, `recommendations`).
- **Isomorphism & Dynamic Imports**: Discovered and resolved a bundling leak where importing server-side modules (`node:fs`, `node:path`, `docx-templates`) globally caused Rspack to attempt packaging them on the client. Dynamically imported these modules within the server function handler and removed the `export` keyword on the DB query helper. The project now compiles with zero errors.

### D. User Interface Enhancements (`src/routes/admin/surveys.$surveyId.tsx`)
- Appended `data-chart-card`, `data-question-id`, and `data-chart-label` attributes to the `ChartCard` component layout to facilitate DOM querying.
- Implemented a "Generate Laporan (Word)" button in the Admin Responses tab under the "Ringkasan" subtab (restricted to `admin` role).
- Added a premium client-side countdown timer for the 10-minute rate limit cooldown. The button turns into a disabled state displaying `Tunggu MM:SS` when active.
- Added a loading state with a spinning icon and text `Mengekspor...` during SVG capturing and server processing.

---

## 2. Technical Implementation Details

### Cooldown Check (`assertReportRateLimit`)
Enforces a 10-minute cooldown based on `(surveyId, userId)` so that admins don't block each other. It is bypassed in DEVELOPMENT mode:
```typescript
async function assertReportRateLimit(surveyId: number, userId: number) {
	if (process.env.ENVIRONMENT === "DEVELOPMENT") return;

	const [last] = await db
		.select({ generatedAt: reportGenerations.generatedAt })
		.from(reportGenerations)
		.where(
			and(
				eq(reportGenerations.surveyId, surveyId),
				eq(reportGenerations.userId, userId),
			),
		)
		.orderBy(desc(reportGenerations.generatedAt))
		.limit(1);

	if (!last) return;

	const elapsedMs = Date.now() - last.generatedAt.getTime();
	const windowMs = 10 * 60 * 1000;
	if (elapsedMs < windowMs) {
		const remainingSec = Math.ceil((windowMs - elapsedMs) / 1000);
		throw new Error(
			`Tunggu ${Math.ceil(remainingSec / 60)} menit lagi sebelum generate laporan berikutnya untuk survei ini.`,
		);
	}
}
```

### Dynamic Imports to Avoid Client-Side Bundling Leaks
```typescript
const docxTemplates = await import("docx-templates");
const createReport = docxTemplates.default || docxTemplates.createReport;
const fs = await import("node:fs");
const path = await import("node:path");
```

### DOM Selector and Image Capture
```typescript
const chartCardEls = document.querySelectorAll("[data-chart-card]");
const charts = [];
for (const card of chartCardEls) {
	const svgEl = card.querySelector("svg");
	if (!svgEl) continue;
	const qId = Number(card.getAttribute("data-question-id"));
	const label = card.getAttribute("data-chart-label") || "";
	const rootEl = svgEl.closest("[data-chart-root]") || svgEl;
	const imageBase64 = await chartElementToPngBase64(rootEl);
	charts.push({ questionId: qId, label, imageBase64 });
}
```

---

## 3. Verification & Build Results
- Successfully ran `bun run build` to compile both SSR and client assets.
- Production Rspack builds pass cleanly, verifying that the client bundling leak has been completely eliminated.
- Database changes (`report_generations`) are fully synced with the local MySQL server.

---

## 4. Cache & Quick Download Enhancements (Addendum)

### A. Client-Side Crash Fix
Resolved a client-side crash `TypeError: toast.info is not a function`. The standard `useToast` component was updated to include support for the `info` type toast, and the corresponding `.toast-info` style classes with a brand-consistent blue colored indicator border were added to `src/styles.css`.

### B. Report Caching & Database Storage
- Updated the `report_generations` table to include two new columns: `file_base_64` (mediumtext) and `file_name` (varchar 255) to persist the actual generated report data.
- When generating reports via `generateSurveyReportFn`, the successfully generated Word buffer is encoded to base64 and saved directly to the database.

### C. Direct Download UI ("Unduh Laporan Terakhir")
- Added a new server function `getLatestSurveyReportFn` to retrieve the latest cached report from the database for the given survey.
- On the Ringkasan tab, the client checks for the presence of a previously generated report. If one exists, it renders a sky-blue **Unduh Laporan Terakhir** button next to the **Generate Laporan (Word)** button.
- Clicking this button fetches the base64 string from the database and downloads it instantly, entirely bypassing the Groq AI narrative generation and SVG-to-canvas rendering steps.

---

## 5. Chart SVG Rendering Fix (Addendum)

### A. The Issue
When charts were rasterized and embedded into the `.docx` file, they rendered as solid blue blocks instead of showing coordinate axes, grids, and individual bar/line details. 

### B. Root Cause
In SVG, the default `fill` property inherits from the parent container. In the browser, elements like grid lines, backgrounds, and axis paths are explicitly styled as `fill: none` or `fill: transparent` via class selectors. 
However, when the computed style copy loop ran, it skipped copying `fill: none` and `fill: transparent` to the inline style of the cloned elements because it checked:
`style.fill !== "none" && style.fill !== "rgba(0, 0, 0, 0)"`
Because these were skipped, the cloned SVG elements did not have inline `fill` styles defined. When loaded in an isolated `Image` context (without stylesheets), these elements defaulted to inheriting the primary blue text color from the parent container, filling the entire chart layout with solid blue.

### C. Solution
Updated the style copy loop in [copyChartImage.ts](file:///home/dwiwahyuilahi/Personal/Projects/FKG/tracert-study/source-code/src/lib/copyChartImage.ts) to explicitly set `cloned.style.fill = "none"` and `cloned.style.stroke = "none"` when their computed values resolve to `none`, `transparent`, or `rgba(0, 0, 0, 0)`.
Additionally, copied the computed `strokeWidth` and `strokeDasharray` to preserve gridline line weights and dash styles (e.g. `stroke-dasharray="3 3"`).

### D. Tiny Legend SVG Issue (Addendum 2)
- **Problem**: In the final generated document, the embedded chart image was rendering as a tiny 28x28 pixel solid blue square (often resolving to less than 1KB file size).
- **Cause**: Recharts renders tiny legend marker icons using nested `<svg>` (which also use the `.recharts-surface` class) inside the chart card container. Since the legend is rendered at the top of the card container, standard query selectors like `querySelector("svg")` or `querySelector("svg.recharts-surface")` matched the tiny legend marker SVG instead of the main chart visualization.
- **Fix**: Updated both the client-side canvas capturing function in [copyChartImage.ts](file:///home/dwiwahyuilahi/Personal/Projects/FKG/tracert-study/source-code/src/lib/copyChartImage.ts) and the report generator DOM walker in [surveys.$surveyId.tsx](file:///home/dwiwahyuilahi/Personal/Projects/FKG/tracert-study/source-code/src/routes/admin/surveys.$surveyId.tsx) to query all `<svg>` elements inside the card, calculate their bounding box visual area (`width * height`), and select the one with the largest area. This mathematically guarantees the main chart SVG (which has a visual area of >100,000 pixels) is selected over the tiny legend marker SVGs (which have a visual area of 196 pixels).




