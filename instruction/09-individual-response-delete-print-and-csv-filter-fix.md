# Instruction 09 — Individual Response: Delete Entry, Print Response, & CSV Filter Select Fix

**Audience:** CLI coding agent (Claude Code) working directly in this repo.
**Primary file in scope:** `src/routes/admin/surveys.$surveyId.tsx`
**Supporting files:** `src/server/adminSurveyFunctions.ts`, `src/components/ui/ConfirmDialog.tsx` (read-only, already exists), `src/components/ui/Button.tsx` (read-only), `public/logo.webp` (read-only asset)
**Stack reminders:** Bun, TanStack Start (`createServerFn`), Drizzle/MySQL, Tailwind, all UI copy in Bahasa Indonesia (match existing tone). Read `instruction/05-responses-tab-revamp.md` first if you haven't touched this file before — this instruction builds directly on top of the "Individual" sub-tab it introduced (pager header, `responseDetail`, `responsesIndex`, `page` search param acting as a 1-based response index with `limit: 1`).

Read this whole document before touching code.

---

## 0. Context / current state (audit, no action needed here)

1. The "Individual" sub-tab (`subtab === "individual"`) renders one response at a time. Pagination is **not** page-of-a-list — `page` search param maps 1:1 to a single response via `getAdminSurveyResponsesListFn({ page, limit: 1 })`, ordered `desc(responses.submittedAt)`. So "response #5" is always the 5th most recent completed response.
2. The pager header lives at ~line 1761-1839 inside `subtab === "individual"`. The left side shows `Respon #{page} dari {responsesIndex.totalCount}`; the right side has Prev/Next + a jump-to-page number input. There is currently **no destructive action and no print action** anywhere in this header.
3. There is no `deleteAdminSurveyResponseFn` (or any per-response delete) in `src/server/adminSurveyFunctions.ts` today. `answers.responseId` has `onDelete: "cascade"` (see `src/server/db/schema.ts`), so deleting a row from `responses` automatically deletes its `answers` — no manual cleanup needed.
4. The existing delete pattern to mirror is `deleteAdminSurveyFn` (server) + `handleDeleteClick` / `handleConfirmDelete` / `<ConfirmDialog>` (client) in `src/routes/admin/surveys.index.tsx`. Reuse the same `ConfirmDialog` component and `toast` from `../../components/ui/useToast`.
5. There is no existing print implementation anywhere in the codebase (no `window.print`, no `@media print`, no `react-to-print`). This needs to be built from scratch as a client-side print, not a server-generated file — keep it lightweight, unlike the Word-report generation feature in `instruction/07-report-generation.md` (that one is a different, heavier "whole survey" AI-narrated report; do not touch or reuse `generateSurveyReportFn`).
6. **Reference PDF:** the user mentioned attaching an example PDF layout for the individual print output, but only `source-code-context.zip` was actually provided — no PDF is present in this workspace. **Before finalizing the print layout, ask the user for that reference PDF (or a screenshot of it).** If it's genuinely unavailable, fall back to the default layout specified in §3 below, which follows the same letterhead convention already used by `laporan-survei-template.docx` (logo + survey title + generation metadata) and the branding used in `src/routes/__root.tsx` / `src/routes/admin/route.tsx` (`/logo.webp`, served from `public/`).
7. `Filter CSV:` select is at ~line 1413-1499, a plain native `<select value={csvFilterQuestionId} onChange={...}>`. State binding looks structurally correct (`String(q.id) === csvFilterQuestionId` comparison, `onChange` sets the raw `e.target.value`), so this is most likely a **presentation** issue (long question titles clipped/not visibly reflected in the closed box due to `max-w-xs` + no `title` tooltip + `truncate` not applied), not a broken state bug — verify against the running app first (see §4.3) before assuming the state logic itself is wrong.

---

## 1. Server changes — `src/server/adminSurveyFunctions.ts`

### 1.1 New: `deleteAdminSurveyResponseFn`

Add near `deleteAdminSurveyFn` (after it, for readability). Admin-only (write action → `assertAdmin()`, matching every other mutation in this file).

```ts
// Delete a single response (and its cascaded answers) — Admin only
export const deleteAdminSurveyResponseFn = createServerFn({ method: "POST" })
	.validator((data: { surveyId: number; responseId: number }) => data)
	.handler(async ({ data }) => {
		await assertAdmin();

		const [existing] = await db
			.select({ id: responses.id })
			.from(responses)
			.where(
				and(
					eq(responses.id, data.responseId),
					eq(responses.surveyId, data.surveyId),
				),
			);
		if (!existing) throw new Error("Respon tidak ditemukan.");

		// FK CASCADE (answers.responseId -> responses.id) deletes the answers too.
		await db.delete(responses).where(eq(responses.id, data.responseId));

		return { success: true };
	});
```

Notes:
- Scope the `WHERE` by both `id` and `surveyId` so a stale/forged `responseId` can't delete a response belonging to a different survey.
- Do **not** restrict by `status: "completed"` here (unlike the read endpoints) — an admin should be able to delete a response regardless of status if it somehow shows up; in practice only completed ones are ever listed, so this is a defensive detail, not a required behavior change elsewhere.
- No new DB migration needed — this only adds a `DELETE`, the schema already supports cascade.

---

## 2. Client changes — Individual pager header (delete)

File: `src/routes/admin/surveys.$surveyId.tsx`.

### 2.1 Import the new server function

Add `deleteAdminSurveyResponseFn` to the existing import block from `../../server/adminSurveyFunctions` (keep the alphabetical ordering already used in that block).

### 2.2 State

Near the other dialog/loading state (e.g. next to `isDuplicateDialogOpen`, `isGeneratingReport`), add:

```ts
const [isDeleteResponseDialogOpen, setIsDeleteResponseDialogOpen] = useState(false);
const [isDeletingResponse, setIsDeletingResponse] = useState(false);
```

### 2.3 Handler

```ts
const handleConfirmDeleteResponse = async () => {
	if (!responseDetail) return;
	setIsDeletingResponse(true);
	try {
		await deleteAdminSurveyResponseFn({
			data: { surveyId, responseId: responseDetail.responseId },
		});
		toast.success("Respon berhasil dihapus.");
		setIsDeleteResponseDialogOpen(false);

		// totalCount shrinks by 1. Because pagination is offset-based (page = Nth
		// most recent response), deleting the current page's response means the
		// *next* response now naturally slides into the same offset — stay on
		// the same `page` unless it now exceeds the new total, then step back.
		const newTotal = responsesIndex.totalCount - 1;
		const nextPage = page > newTotal ? Math.max(1, newTotal) : page;
		await router.navigate({ search: (prev) => ({ ...prev, page: nextPage }) });
		await router.invalidate();
	} catch (err: any) {
		toast.error(err.message || "Gagal menghapus respon.");
	} finally {
		setIsDeletingResponse(false);
	}
};
```

Use whichever of `router.navigate` + `router.invalidate` ordering already works elsewhere in this file for similar "mutate then refresh loader data" flows (check how `handleConfirmDelete` in `surveys.index.tsx` and the settings-save handlers around line 219/274 sequence `router.invalidate()` — be consistent with that existing pattern rather than introducing a third convention). If `newTotal === 0`, the "Belum ada data jawaban yang dikirimkan." empty state (already implemented at ~line 1747-1757) should render automatically once `responsesIndex.totalCount === 0` — verify this happens without extra code.

### 2.4 UI — button placement

Restrict to `user?.role !== "visitor"` (this is a destructive admin action, same gating already used for the CSV filter bar at line 1414 and the question-editing footer at line 1353).

Inside the pager header div (~line 1762), the current structure is:

```
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 ...">
  <div>Respon #{page} dari {responsesIndex.totalCount}</div>   {/* left */}
  {submittedAt block}                                          {/* middle */}
  <div>{prev / page input / next}</div>                        {/* right: pager controls */}
</div>
```

The user wants the delete (and print) affordance **at the far right edge of the "Respon #.. dari .." line**, i.e. next to/after that label, not mixed into the Prev/Next pager control group. Update the left block like this:

```tsx
<div className="flex items-center gap-3">
	<span className="text-sm font-bold text-[#1a1b21]">
		Respon #{page} dari {responsesIndex.totalCount}
	</span>

	<button
		type="button"
		onClick={handlePrintResponse}
		className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[#434652] hover:text-[#002972] transition-colors cursor-pointer"
		title="Cetak respon ini"
	>
		<span className="material-symbols-outlined text-sm block">print</span>
	</button>

	{user?.role !== "visitor" && (
		<button
			type="button"
			onClick={() => setIsDeleteResponseDialogOpen(true)}
			className="p-1.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-[#ba1a1a] transition-colors cursor-pointer"
			title="Hapus respon ini"
		>
			<span className="material-symbols-outlined text-sm block">delete</span>
		</button>
	)}
</div>
```

(Icon-only buttons with `title` tooltips, matching the existing icon-button convention used for Prev/Next in the same header — don't introduce a new button style.)

### 2.5 Confirm dialog

Add near the other `<ConfirmDialog>` instances (~line 2334 area), reusing the same component:

```tsx
<ConfirmDialog
	isOpen={isDeleteResponseDialogOpen}
	title="Hapus Respon"
	message={`Apakah Anda yakin ingin menghapus Respon #${page}? Tindakan ini tidak dapat dibatalkan.`}
	onConfirm={handleConfirmDeleteResponse}
	onCancel={() => setIsDeleteResponseDialogOpen(false)}
	confirmText={isDeletingResponse ? "Menghapus..." : "Ya, Hapus"}
/>
```

If `ConfirmDialog` doesn't support a disabled/loading confirm state today, that's fine — just guard `handleConfirmDeleteResponse` against double-submit with `if (isDeletingResponse) return;` at the top instead of trying to disable the dialog's own button.

---

## 3. Print individual response

### 3.1 Approach

Client-side `window.print()` against a dedicated print-only DOM region, using `@media print` CSS to hide everything else (nav, tabs, pager controls, sidebar, other admin chrome) and show only the printable response block. This avoids adding a new PDF-generation dependency for what is fundamentally "print this one card." Do **not** reuse `generateSurveyReportFn` / `docx-templates` — that pipeline is for the aggregated, AI-narrated, multi-response Word report and is a different feature.

### 3.2 Printable block

Add a hidden-by-default printable region (e.g. rendered once, positioned off-screen or `display: none` outside of print) containing:

- **Header/letterhead:** `/logo.webp`, survey title (`detail.title` or equivalent field already available on `detail`), and a subtitle line "Detail Respon Individual".
- **Metadata row:** `Respon #{page} dari {responsesIndex.totalCount}`, submitted date (already formatted elsewhere via `toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })` — reuse the same formatting), and a "Dicetak pada: {now, id-ID}" line.
- **Body:** every non-hidden item from `responseDetail.items`, in order — question title + description (if any) + the answer value rendered as **plain text/read-only**, not as disabled form controls (form control chrome — borders, disabled input backgrounds — prints poorly and wastes ink/space). For each `item.type`, resolve a plain display value:
  - `short_text` / `paragraph` / `date` → `item.valueText ?? "-"`
  - `multiple_choice` / `dropdown` → the option label matching `item.valueOptionIds?.[0]`, from `item.options`
  - `checkboxes` → comma-joined option labels matching every id in `item.valueOptionIds`
  - `linear_scale` → the selected scale point label/value
  - `grid` → a simple two-column list or small table: row label → selected column label, one line per row in `item.valueGrid`
  - `hidden === true` → render `"Informasi pribadi disembunyikan untuk peninjau"` instead of the value, exactly like the on-screen behavior.

  Write a small pure helper, e.g. `formatAnswerForPrint(item)`, so this logic isn't duplicated inline in JSX — it's the same "resolve raw stored value → human label" logic that likely already exists in some form for the on-screen inputs; check whether a shared resolver can be reused instead of writing a second copy.

- **Footer:** survey name + page/response id, small muted text.

### 3.3 Print trigger

```ts
const handlePrintResponse = () => {
	window.print();
};
```

### 3.4 CSS

In `src/styles.css` (or wherever global Tailwind/base styles live — check the existing `@media print` absence and the file used for the toast-info addendum in `report-generation-report.md` §4.A, which is `src/styles.css`), add:

```css
.print-only {
	display: none;
}

@media print {
	body * {
		visibility: hidden;
	}
	.print-only,
	.print-only * {
		visibility: visible;
	}
	.print-only {
		display: block;
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
	}
}
```

Wrap the printable block from §3.2 in a container with `className="print-only"`, rendered as a sibling near the bottom of the Individual sub-tab content (only needs to exist in the DOM when `subtab === "individual"` and `responseDetail` is present — no need to render it for other tabs).

### 3.5 Layout reference

**Action needed from the user before this is truly final:** confirm the exact reference PDF layout (spacing, whether it's single-column Q&A or a two-column table, whether the logo/header matches the `laporan-survei-template.docx` style or something else). Implement §3.2's structure as the default in the meantime — it's intentionally simple (letterhead → metadata → linear Q&A list → footer) and easy to restyle once the reference is available.

---

## 4. Fix — `Filter CSV:` select doesn't clearly show the selected question

File: `src/routes/admin/surveys.$surveyId.tsx`, ~line 1413-1499.

### 4.1 Diagnosis steps (do these first, in the running app)

1. Open a survey with at least one long-titled `multiple_choice`/`dropdown`/`checkboxes` question in the responses tab.
2. Select it from the `Filter CSV:` dropdown and close the dropdown.
3. Confirm whether the closed `<select>` box visually shows the chosen question's title, or still reads like nothing was picked / shows truncated garbage / reverts to "Semua Pertanyaan".

### 4.2 If it's a truncation/visibility issue (most likely, per §0.7)

- Add `title={q.title}` to each `<option>` so the full text is available on hover in browsers that support it, and add `title={selectedFilterQuestion?.title ?? "Semua Pertanyaan (Tanpa Filter)"}` on the `<select>` itself so the closed box shows a native tooltip with the full question text on hover.
- Loosen `max-w-xs` (16rem) if it's clipping every realistic question title — either increase to `max-w-sm`/`max-w-md`, or drop the `max-w-*` cap and instead let it size naturally within `flex-1` on wider screens, keeping `min-w-0` so it still shrinks correctly next to the checkbox filter pills and the Download button on narrow viewports. Pick whichever keeps the whole `Filter CSV:` bar from wrapping awkwardly at common admin viewport widths (≥1280px) — verify visually, don't guess blindly.

### 4.3 If it's actually a state/value bug (verify before assuming, per §4.1)

- Confirm `q.id` and `csvFilterQuestionId` really do resolve to matching strings — add a temporary `console.log(csvFilterQuestionId, filterableQuestions.map(q => String(q.id)))` while testing if needed, then remove it before finishing.
- If a mismatch is found, normalize both sides explicitly: build `filterableQuestions` values as `String(q.id)` at the `<option value={...}>` call site instead of relying on implicit coercion, e.g. `value={String(q.id)}`.

### 4.4 Out of scope for this fix

- Do not replace the native `<select>` with the custom `src/components/ui/Select.tsx` wrapper as part of this task unless the diagnosis in §4.1 shows the native element is fundamentally broken (it's a thin wrapper over the same native `<select>`, so it wouldn't fix a real state bug anyway — only reach for it if there's a *styling* reason to standardize, and treat that as a separate follow-up, not bundled into this fix).

---

## 5. Manual verification checklist

1. As **admin**, open the Individual sub-tab: confirm a print icon button and a delete icon button both appear at the right of "Respon #.. dari ..", not inside the Prev/Next control group.
2. As **visitor**: confirm the delete button is **not** rendered; the print button **is** still available (printing isn't a destructive/privileged action, and visitors already see a masked view — printing should reflect whatever they're allowed to see on screen, including the `hidden` personal-info placeholder).
3. Click print → confirm the browser print preview shows only the letterhead + metadata + Q&A list for the current response, with no nav/tabs/pager/other chrome bleeding through.
4. Click delete → confirm dialog appears with the correct response number → confirm → toast success → list updates (`responsesIndex.totalCount` decreases by 1) → the same `page` number now shows what was previously the *next* response, except when deleting the very last response, where the page should step back by one and still render a valid response (or the empty state if it was the only one left).
5. Try deleting while on `page = responsesIndex.totalCount` (the last response) → confirm it steps back to `page = totalCount - 1` and doesn't get stuck on a now-out-of-range page showing a blank/error state.
6. Delete the only remaining response in a survey with exactly 1 response → confirm the "Belum ada data jawaban yang dikirimkan." empty state renders correctly afterward.
7. `Filter CSV:` — select a long-titled question, close the dropdown, confirm the box clearly communicates which question is active (full text visible or at least a hover tooltip with the full title) instead of looking unset or unreadable.
8. Re-run the existing CSV export and Individual-tab pagination flows from `instruction/05-responses-tab-revamp.md` §4 to confirm nothing in this change regressed them.

---

## 6. Explicitly out of scope for this task

- Bulk/multi-select delete of responses — this instruction only covers deleting the single response currently being viewed in the Individual tab.
- Server-generated (Word/PDF-library) print output — this stays a client-side `window.print()` against a styled DOM region, not a new file-generation pipeline.
- Any change to `generateSurveyReportFn`, `getLatestSurveyReportFn`, or the Word report feature from `instruction/07-report-generation.md` — unrelated feature, do not touch.
- Restyling the custom `src/components/ui/Select.tsx` wrapper or migrating other selects in the app to it.
