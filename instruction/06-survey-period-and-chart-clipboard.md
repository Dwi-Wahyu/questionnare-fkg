# Instruction 06 — Survey Period (input + filter) & Copy Chart as Image

**Addendum to `05-responses-tab-revamp.md`** — read that file first; this one assumes the Ringkasan tab and chart-selection logic it describes already exist (or are being built in the same pass).

Two independent features:
- **§A — Survey Period**: a new field on the survey itself (when it was/is conducted), settable as either a whole month or an exact date, plus a matching filter on the survey list.
- **§B — Copy chart as image**: a "copy to clipboard" action on every chart in the Ringkasan (and Pertanyaan) tab so a chart can be pasted as an image into Word/Slack/email/etc.

---

## §A. Survey Period

### A.1 Schema change — `src/server/db/schema.ts`

Add two columns to `surveys`:

```ts
export const surveys = mysqlTable("surveys", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 150 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  bannerUrl: mediumtext("banner_url"),
  category: varchar("category", { length: 100 }).notNull(),
  // NEW — survey period:
  periodType: mysqlEnum("period_type", ["month", "date"]).notNull().default("month"),
  // "month" -> stored as "YYYY-MM" (e.g. "2025-07")
  // "date"  -> stored as "YYYY-MM-DD" (e.g. "2025-07-15")
  periodValue: varchar("period_value", { length: 10 }),
  status: mysqlEnum("status", ["draft", "published", "archived"]).notNull().default("draft"),
  createdBy: int("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});
```

`periodValue` is nullable — older surveys created before this feature ships simply have no period until an admin sets one; don't backfill.

After editing `schema.ts`, generate the migration the same way the existing `drizzle/000x_*.sql` files were produced (do not hand-write SQL): run the project's Drizzle Kit generate command (check `package.json` scripts / `drizzle.config.ts` — likely `bun run db:generate` or `bunx drizzle-kit generate`) and commit the resulting migration file alongside the schema change. Follow the existing numbering (`0003_...sql`).

### A.2 Why "month OR exact date" (not a date range)

Per spec: the period picker has two modes, not a start/end range —
- **Bulan (month)**: native `<input type="month" />`, stores `"YYYY-MM"`. Use this for recurring periodic surveys tied to a whole month/semester snapshot (matches how the seed "Survei Kepuasan Mahasiswa 2025" data is period-labeled, e.g. "Juli 2025").
- **Tanggal Spesifik (exact date)**: native `<input type="date" />`, stores `"YYYY-MM-DD"`. Use this when a survey is tied to a single event/day.

A segmented toggle (two buttons, "Bulan" / "Tanggal Spesifik") switches `periodType` and swaps which input renders. Switching modes clears `periodValue` (don't try to convert a date into a month or vice versa — just reset and let the admin re-pick).

### A.3 Server functions — `src/server/adminSurveyFunctions.ts`

Extend the validators/handlers of the two functions that already write survey fields:

- `createAdminSurveyFn` — add `periodType: "month" | "date"` and `periodValue?: string` to the validator input, pass through to the `insert`.
- `updateAdminSurveySettingsFn` — same two fields added to validator + `update().set()`.
- `getAdminSurveysListFn` — add `periodType` and `periodValue` to the `select({...})` projection (needed by the list-page filter).
- `getAdminSurveyDetailFn` — `survey` is already `select().from(surveys)` (whole row), so `periodType`/`periodValue` come through automatically — no change needed there beyond the schema update.

Validate `periodValue` server-side against a simple regex matching the chosen `periodType` (`^\d{4}-\d{2}$` for month, `^\d{4}-\d{2}-\d{2}$` for date) before insert/update; reject with a clear Indonesian error message otherwise (defense in depth — the native inputs already constrain the format, but server functions shouldn't trust client formatting).

### A.4 UI — survey creation (`src/routes/admin/surveys.new.tsx`)

Add a "Periode Survei" field group next to "Kategori Survei", following the existing field styling in that file:

```tsx
const [periodType, setPeriodType] = useState<"month" | "date">("month");
const [periodValue, setPeriodValue] = useState("");
```

```tsx
<div className="flex flex-col gap-1.5">
  <label className="text-sm font-bold text-[#1a1b21]">Periode Survei</label>
  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 w-fit">
    <button type="button"
      onClick={() => { setPeriodType("month"); setPeriodValue(""); }}
      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${periodType === "month" ? "bg-white shadow-sm text-[#002972]" : "text-[#747683]"}`}>
      Bulan
    </button>
    <button type="button"
      onClick={() => { setPeriodType("date"); setPeriodValue(""); }}
      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${periodType === "date" ? "bg-white shadow-sm text-[#002972]" : "text-[#747683]"}`}>
      Tanggal Spesifik
    </button>
  </div>
  <input
    type={periodType === "month" ? "month" : "date"}
    value={periodValue}
    onChange={(e) => setPeriodValue(e.target.value)}
    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-sm text-[#1a1b21] focus:border-[#002972] focus:ring-1 focus:ring-[#002972] focus:bg-white outline-none transition-colors"
  />
</div>
```

Pass `periodType, periodValue` into the `createAdminSurveyFn` call. This field is **optional** at creation (admins can set it later from Settings).

### A.5 UI — survey settings (`src/routes/admin/surveys.$surveyId.tsx`, Settings tab)

Same toggle + input pattern, inserted into the existing settings `<form>` (near "Kategori Survei", ~line 1194-1218), wired to new `settingsPeriodType`/`settingsPeriodValue` state, hydrated from `detail.survey.periodType`/`periodValue` in the existing `useEffect` that seeds settings state (~line 62-74), included in the `updateAdminSurveySettingsFn` payload in `handleSaveSettings`, and disabled for `user?.role === "visitor"` like every other settings field in that form.

Also surface the period as a small read-only badge/line near the survey title at the top of the detail page (all tabs), e.g. next to the status badge: `📅 Juli 2025` (format `periodType === "month"` as `"MMMM yyyy"` in `id-ID` locale; format `"date"` as `dateStyle: "long"` in `id-ID`).

### A.6 UI — survey list filter (`src/routes/admin/surveys.index.tsx`)

Add a third filter control next to the existing search input and status `<Select>`:

- A small mode toggle (Bulan / Tanggal) — reuse the same segmented-button pattern from A.4.
- The matching native input (`type="month"` or `type="date"`), empty by default (`""` = no period filter applied).
- A small "×" clear button when a period filter is active.

Filter matching logic (client-side, alongside the existing `matchesSearch`/`matchesStatus` in `filteredSurveys`):

```ts
const matchesPeriod = (() => {
  if (!periodFilterValue) return true; // no filter set
  if (!s.periodValue) return false; // survey has no period set, excluded when filtering

  if (periodFilterMode === "month") {
    // survey's own month, regardless of whether it was stored as "month" or "date" type
    const surveyMonth = s.periodType === "date" ? s.periodValue.slice(0, 7) : s.periodValue;
    return surveyMonth === periodFilterValue; // periodFilterValue is "YYYY-MM"
  }

  // periodFilterMode === "date": exact-date surveys must match exactly;
  // month-type surveys match if the filtered date falls within that month
  if (s.periodType === "date") return s.periodValue === periodFilterValue;
  return periodFilterValue.startsWith(s.periodValue); // "YYYY-MM-DD".startsWith("YYYY-MM")
})();
```

`return matchesSearch && matchesStatus && matchesPeriod;` in the existing filter chain.

---

## §B. Copy chart as image (clipboard)

Applies to **every chart rendered in the Ringkasan sub-tab**, and the single chart shown in the **Pertanyaan sub-tab**, as introduced in `05-responses-tab-revamp.md` §3.3/§3.4. Does not apply to the plain text-answer lists (no chart there).

### B.1 New utility — `src/lib/copyChartImage.ts`

```ts
export async function copyElementChartAsPng(containerEl: HTMLElement): Promise<void> {
  const svg = containerEl.querySelector("svg");
  if (!svg) throw new Error("Grafik tidak ditemukan.");

  const { width, height } = svg.getBoundingClientRect();
  const scale = 2; // export at 2x for crisper paste

  // Clone so we don't mutate the live chart, inline computed styles Recharts
  // relies on CSS classes/vars for (fills use var(--chart-N) etc via className,
  // so make sure those CSS custom properties are inherited — cloning inside the
  // same document preserves inherited custom properties from ChartStyle).
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  const serialized = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = svgUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas tidak didukung.");

    // White background — charts have a transparent SVG background, and most
    // paste targets (Word, email, Slack) render transparent PNGs on a dark
    // or checkered background, which looks broken. Force white.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);

    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Gagal membuat gambar."))), "image/png"),
    );

    if (!navigator.clipboard || !("write" in navigator.clipboard) || typeof ClipboardItem === "undefined") {
      // Fallback: trigger a PNG download instead of clipboard write
      const dlUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = dlUrl;
      link.download = "chart.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(dlUrl);
      throw new Error("FALLBACK_DOWNLOAD"); // let caller show a different toast
    }

    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
```

Notes:
- Clipboard image write (`ClipboardItem`) requires a secure context (HTTPS) and is not supported in every browser (notably older Firefox) — the fallback above downloads the PNG instead so the feature degrades gracefully rather than throwing an unhandled error.
- Keep this in `src/lib/` (not inline in the route file) since it has no JSX and is reusable across both tabs.

### B.2 Wire-up in the chart cards

In every chart card built per §3.3 of `05-responses-tab-revamp.md`, wrap the `ChartContainer` in a `ref`-tracked div and add a small icon button in the card header (next to the existing question title):

```tsx
const chartRef = useRef<HTMLDivElement>(null);
const [copyState, setCopyState] = useState<"idle" | "copied" | "downloaded">("idle");

const handleCopyChart = async () => {
  if (!chartRef.current) return;
  try {
    await copyElementChartAsPng(chartRef.current);
    setCopyState("copied");
    toast.success("Grafik disalin ke clipboard. Tempel (Ctrl+V) di dokumen lain.");
  } catch (err: any) {
    if (err?.message === "FALLBACK_DOWNLOAD") {
      setCopyState("downloaded");
      toast.info("Browser Anda tidak mendukung salin gambar langsung — grafik diunduh sebagai PNG.");
    } else {
      toast.error(err?.message || "Gagal menyalin grafik.");
    }
  } finally {
    setTimeout(() => setCopyState("idle"), 2000);
  }
};
```

```tsx
<button
  type="button"
  onClick={handleCopyChart}
  title="Salin grafik sebagai gambar"
  className="p-1.5 rounded-lg border border-slate-200 text-[#434652] hover:bg-slate-50 hover:text-[#0b3e9c] transition-colors"
>
  <span className="material-symbols-outlined text-sm block">
    {copyState === "copied" ? "check" : copyState === "downloaded" ? "download" : "content_copy"}
  </span>
</button>
```

Place this button in the same header row as each chart card's title (the `<div className="py-4 px-6 border-b ... flex justify-between items-center">` block from the existing Ringkasan card markup) — right-aligned, next to where `detail.responseCount` respon count text sits.

`chartRef` must wrap only the chart itself (the `ChartContainer`/`data-slot="chart"` div), not the surrounding card chrome, header, or legend-outside-svg elements — otherwise the exported PNG includes UI chrome the user didn't ask for. If a legend is rendered as an HTML list outside the SVG (rather than via Recharts' in-SVG `ChartLegend`), either (a) prefer the in-SVG `ChartLegend`/`ChartLegendContent` from `chart.tsx` so it's captured automatically, or (b) exclude the external legend from the copy scope and accept the SVG-only export — do not attempt to composite HTML + SVG into one canvas image, that's substantially more complex than this feature warrants.

### B.3 Apply to Pertanyaan tab

The single larger chart in the Pertanyaan tab (§3.4 of the previous doc) gets the same `chartRef` + copy button treatment, placed next to the question title above the chart.

### B.4 Manual verification

1. Click the copy icon on a bar chart, a line chart, a horizontal bar chart, and a grid grouped-bar chart (one of each kind from the decision table) → paste (Ctrl+V) into a Word doc / email draft → confirm each pastes as a crisp, white-background PNG matching what's on screen (colors, labels, legend if in-SVG).
2. Test in a browser/context without Clipboard `write` support (or temporarily stub it out) → confirm it falls back to a PNG download instead of a silent failure or unhandled promise rejection.
3. Confirm the exported image does not include the card's outer border/header/copy-button itself — only the chart.
