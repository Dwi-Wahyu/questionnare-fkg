# Instruction 07 — Section Management & Question Editing in Survey Builder

**Scope:** `src/routes/admin/surveys.$surveyId.tsx` (Tab "Pertanyaan"/questions editor) and, only if a real gap is found, `src/server/adminSurveyFunctions.ts`. Read this whole file before changing anything — §C depends on §A/§B existing first.

## Context / current state (verified by reading the code before writing this)

- The questions editor currently hardcodes **exactly two sections** per survey ("Data Diri" and "Kuesioner Utama") at seed time. There is no UI to create a third, fourth, etc. section.
- `sec.title` (section name) is rendered as a **read-only `<span>`** — there is no input to rename a section, and no field to edit its description at all.
- Per-question editing (title, type, description, required, options) **already works** via `handleQuestionFieldChange` / `handleAddOption` / `handleUpdateOptionLabel` / `handleDeleteOption` and is wired to real `<input>`/`<select>` elements — don't rebuild this. If manual testing turns up a specific field that doesn't actually persist after "Simpan Semua Pertanyaan", fix that specific bug and note it in your PR description; don't assume the whole thing is missing.
- The backend, `updateAdminSurveyQuestionsFn` in `src/server/adminSurveyFunctions.ts`, **already fully supports an arbitrary number of sections**: it upserts every section in the payload (inserts when `id` is absent), deletes DB sections that are no longer present in the payload, and maps each question to its section via `sectionOrder` → `sectionIdMap[order]`. **No backend/schema changes are required for §A–§C below** — this is purely a frontend gap. Confirm this yourself by re-reading `updateAdminSurveyQuestionsFn` before writing code, in case it has changed since this doc was written.
- `questions.order` is a **global** sequence across the whole survey (not per-section); the UI groups them into sections purely by filtering `questions.filter(q => q.sectionId === sec.id)` — order is preserved by that global sequence. `sections.order` is likewise a global 0-based sequence. Keep both invariants intact: after any add/remove/move operation, renumber `sections[i].order = i` and `questions[i].order = i` (in their respective already-sorted arrays) before saving.

Three things to build, in this order:

- **§A** — Make section title + description editable.
- **§B** — "Tambah Bagian" (add a new, empty section) at the end of the section list.
- **§C** — Per-question "split section here" action: move a question and every question after it (within its current section) into a brand-new section inserted right after the current one.

All three are **local editor state changes only** (`sections`/`questions` React state) — nothing is persisted to the DB until the admin clicks the existing "Simpan Semua Pertanyaan" button, which already calls `handleSaveQuestions` → `updateAdminSurveyQuestionsFn`. Do not add new server functions for this.

---

## §A. Editable section title & description

**File:** `src/routes/admin/surveys.$surveyId.tsx`, inside the `sections.map((sec, secIdx) => { ... })` block (~line 717).

### A.1 State handler

Add next to the other `handle*` editor helpers (near `handleQuestionFieldChange`, ~line 296):

```tsx
const handleSectionFieldChange = (
  secId: any,
  key: "title" | "description",
  val: string,
) => {
  setSections(
    sections.map((s) => (s.id === secId ? { ...s, [key]: val } : s)),
  );
};
```

### A.2 UI

Replace the read-only section header:

```tsx
<div className="bg-[#eeedf6] px-6 py-2 border-b border-[#c4c6d4] flex items-center justify-between text-xs font-bold text-[#002972]">
  <span>Bagian {secIdx + 1} dari {sections.length}</span>
  <span>{sec.title}</span>
</div>
```

with an editable title + description block. Match the existing input styling used for question fields (`border-slate-200 rounded-lg`, `disabled={user?.role === "visitor"}`):

```tsx
<div className="bg-[#eeedf6] px-6 py-3 border-b border-[#c4c6d4] space-y-2">
  <div className="flex items-center justify-between text-xs font-bold text-[#002972]">
    <span>Bagian {secIdx + 1} dari {sections.length}</span>
    {user?.role !== "visitor" && sections.length > 1 && (
      <button
        type="button"
        onClick={() => handleDeleteSection(sec.id)}
        className="text-[#ba1a1a] hover:underline flex items-center gap-1 font-semibold"
        title="Hapus Bagian"
      >
        <span className="material-symbols-outlined text-sm">delete</span>
        Hapus Bagian
      </button>
    )}
  </div>
  <input
    type="text"
    value={sec.title}
    onChange={(e) => handleSectionFieldChange(sec.id, "title", e.target.value)}
    className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-sm font-bold text-[#1a1b21] focus:border-[#002972] outline-none"
    placeholder="Judul bagian..."
    disabled={user?.role === "visitor"}
  />
  <input
    type="text"
    value={sec.description || ""}
    onChange={(e) => handleSectionFieldChange(sec.id, "description", e.target.value)}
    className="w-full bg-transparent border-none py-0.5 px-0 text-xs text-[#434652] focus:outline-none"
    placeholder="Deskripsi bagian (opsional)..."
    disabled={user?.role === "visitor"}
  />
</div>
```

`handleDeleteSection` is defined in §B.3 (delete depends on having more than one section to move orphaned questions into, so it's grouped with add/remove logic).

---

## §B. Add / remove sections

### B.1 Add a new empty section

Handler, next to `handleAddQuestion`:

```tsx
const handleAddSection = () => {
  const newTempId = "new_sec_" + Math.random().toString(36).substring(2, 9);
  const maxOrder = sections.reduce((max, s) => (s.order > max ? s.order : max), -1);

  setSections([
    ...sections,
    {
      id: newTempId,
      title: `Bagian Baru ${sections.length + 1}`,
      description: "",
      order: maxOrder + 1,
    },
  ]);
};
```

UI — place this **after** the closing `})}` of the `sections.map(...)` loop (~line 1096), before the "Saving footer buttons" block:

```tsx
{user?.role !== "visitor" && (
  <div className="flex justify-center">
    <button
      type="button"
      onClick={handleAddSection}
      className="border-2 border-dashed border-[#c4c6d4] text-[#434652] hover:border-[#002972] hover:text-[#002972] text-xs font-bold py-3 px-8 rounded-lg flex items-center gap-1.5 transition-all w-full justify-center"
    >
      <span className="material-symbols-outlined text-base">add_box</span>
      <span>Tambah Bagian Baru</span>
    </button>
  </div>
)}
```

### B.2 Reorder sections (up/down) — needed once you can have >2 sections

```tsx
const handleMoveSection = (index: number, direction: "up" | "down") => {
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= sections.length) return;

  const next = [...sections];
  const temp = next[index];
  next[index] = next[targetIndex];
  next[targetIndex] = temp;
  next.forEach((s, idx) => { s.order = idx; });

  setSections(next);
};
```

Add small up/down icon buttons next to "Hapus Bagian" in the §A.2 header (same pattern as the existing per-question up/down arrows at ~line 746–765), disabling "up" on the first section and "down" on the last.

### B.3 Delete a section

A section can only be deleted if it's not the last remaining section (a survey must always have ≥1 section — mirrors the disabled-delete condition already used in §A.2: `sections.length > 1`). Deleting a section must not silently orphan its questions.

```tsx
const handleDeleteSection = (secId: any) => {
  if (sections.length <= 1) return;

  const secToDelete = sections.find((s) => s.id === secId);
  if (!secToDelete) return;

  const remaining = sections.filter((s) => s.id !== secId);
  // Fold any questions that belonged to the deleted section into the
  // section immediately before it (or the first remaining section if the
  // deleted one was first) rather than deleting the questions themselves.
  const deletedIdx = sections.findIndex((s) => s.id === secId);
  const fallbackSection =
    sections[deletedIdx - 1] ?? remaining[0];

  setQuestions(
    questions.map((q) =>
      q.sectionId === secId ? { ...q, sectionId: fallbackSection.id } : q,
    ),
  );
  setSections(remaining.map((s, idx) => ({ ...s, order: idx })));
};
```

Wrap the actual delete click in the project's existing `ConfirmDialog` component (already imported at the top of this file and used elsewhere, e.g. for survey duplication) instead of deleting immediately, with copy along the lines of: *"Bagian ini akan dihapus. Pertanyaan di dalamnya akan dipindahkan ke bagian sebelumnya. Lanjutkan?"*

---

## §C. "Split section from here" — move a question + everything below it into a new section

This is the main ask: given a question anywhere in the form, create a new section right after its current section, and move that question plus every question that comes **after it within the same section** into the new section. Sections before/after are otherwise untouched.

### C.1 Handler

Add near the other question handlers:

```tsx
const handleSplitSectionAtQuestion = (qId: any) => {
  const question = questions.find((q) => q.id === qId);
  if (!question) return;

  const currentSection = sections.find((s) => s.id === question.sectionId);
  if (!currentSection) return;

  // Questions in the SAME section, in their current display order.
  const sectionQuestions = questions
    .filter((q) => q.sectionId === currentSection.id)
    .sort((a, b) => a.order - b.order);

  const splitIndex = sectionQuestions.findIndex((q) => q.id === qId);
  // Nothing to split off if this is already the first question in its section.
  if (splitIndex <= 0) return;

  const movingIds = new Set(
    sectionQuestions.slice(splitIndex).map((q) => q.id),
  );

  const newTempId = "new_sec_" + Math.random().toString(36).substring(2, 9);
  const currentIdx = sections.findIndex((s) => s.id === currentSection.id);

  // Insert the new section directly after the current one, then renumber
  // every section's `order` to keep the 0-based global sequence intact.
  const nextSections = [
    ...sections.slice(0, currentIdx + 1),
    {
      id: newTempId,
      title: `${currentSection.title} (Lanjutan)`,
      description: "",
      order: 0, // placeholder, fixed below
    },
    ...sections.slice(currentIdx + 1),
  ].map((s, idx) => ({ ...s, order: idx }));

  setSections(nextSections);
  setQuestions(
    questions.map((q) =>
      movingIds.has(q.id) ? { ...q, sectionId: newTempId } : q,
    ),
  );
};
```

Notes:
- `splitIndex <= 0` guard: splitting "from" the first question of a section would produce an empty section, which is confusing — disable/hide the action for a section's first question in the UI too (see C.2).
- Default new-section title `"<Original> (Lanjutan)"` is a placeholder — the admin can immediately rename it via the §A input, since it now renders as an editable text field.
- This intentionally does **not** touch `question.order` — global order is preserved, only `sectionId` changes, so the moved questions keep appearing in the same relative sequence, just now grouped under the new section.

### C.2 UI trigger

Add a button to the per-question "Bottom Controls" row (~line 1040, next to the existing "Hapus" button), gated the same way (`user?.role !== "visitor"`) and disabled when the question is already first in its section:

```tsx
{(() => {
  const sectionQuestions = questions
    .filter((sq) => sq.sectionId === q.sectionId)
    .sort((a, b) => a.order - b.order);
  const isFirstInSection = sectionQuestions[0]?.id === q.id;

  return (
    <button
      type="button"
      onClick={() => handleSplitSectionAtQuestion(q.id)}
      disabled={isFirstInSection}
      className="hover:text-[#002972] flex items-center gap-1 text-xs font-semibold disabled:opacity-30 disabled:pointer-events-none"
      title="Pindahkan pertanyaan ini & semua di bawahnya ke bagian baru"
    >
      <span className="material-symbols-outlined text-sm">splitscreen</span>
      Pisahkan ke Bagian Baru
    </button>
  );
})()}
```

Place it before the existing `<div className="w-px h-5 bg-slate-200"></div>` divider that separates "Hapus" from the "Wajib Diisi" checkbox, so the row reads: **Hapus · Pisahkan ke Bagian Baru · Wajib Diisi**.

---

## Acceptance criteria

Test as an `admin`-role user on a survey with ≥6 questions across the existing 2 sections:

1. **§A** — Renaming a section's title/description in the input, then clicking "Simpan Semua Pertanyaan", persists after a full page reload (`router.invalidate()` already happens on save — just confirm the new value survives).
2. **§B** — "Tambah Bagian Baru" appends an empty 3rd section at the bottom; "Belum ada pertanyaan di bagian ini..." placeholder shows (existing empty-state copy, no change needed there); "Tambah Pertanyaan di Bagian Ini" inside it works via the already-existing `handleAddQuestion(sec.id)`; saving persists the new section and any questions added to it.
3. **§B.3** — Deleting a section with questions in it moves those questions into the previous section (confirm via the "Bagian X dari Y" question distribution after save) rather than deleting the questions.
4. **§C** — Clicking "Pisahkan ke Bagian Baru" on the 3rd question of a 5-question section produces two sections: the original section now has questions 1–2, and a new "`<original title>` (Lanjutan)" section has questions 3–5, in their original relative order. Saving persists this split. The button is disabled/hidden on each section's first question.
5. Existing behavior is unaffected: question-level editing (title/type/description/required/options), reordering via the up/down arrows, and adding/deleting individual questions all still work exactly as before across every section (not just the original two).
6. Visitor-role users (`user?.role === "visitor"`) still see a fully read-only editor — no new buttons from §A–§C render for them, matching the existing `disabled={user?.role === "visitor"}` / conditional-render pattern used everywhere else in this file.
