# Main PRD — Tracer Study & Survey Platform, FKG Unhas

**Status:** Draft v1 · **Stage:** 1 of N (context & design system) · **Owner:** you · **Author:** Claude

---

## 1. What we're building

An internal Google Forms–style survey/tracer study platform for **Fakultas Kedokteran Gigi (FKG), Universitas Hasanuddin**. It replaces the current workflow (Google Forms + manually exported CSVs, see `data-example.zip`) with a purpose-built app that has real auth, a proper database, and reporting that stays inside campus systems.

Reference material used to inform this PRD:

- `tanstack-template.zip` — the starter codebase (TanStack Start + Rsbuild + Drizzle + Bun) whose existing patterns (auth via cookie session, server functions, admin layout, toast/skeleton components) we'll extend rather than replace.
- `data-example.zip` — 9 real historical response CSVs across 6 distinct survey types (student satisfaction, lecturer satisfaction, staff satisfaction, alumni tracer, employer/user survey, management satisfaction). These define the realistic **question shapes** we must support (Likert scales, repeating "alumni" blocks, short text, dropdown-like categorical answers) and will become the seed data in Stage 2.
- 4 screenshots of Google Forms — these define the **interaction model** to mirror: multi-section paging ("Bagian 1 dari 2"), a Pertanyaan/Jawaban/Setelan tab structure, per-question answer charts, and a pre-submission "which account" gate.

---

## 2. Goals / non-goals

**Goals**

- Let admins build multi-section surveys with the same question types Google Forms supports, and manage them without touching code.
- Let respondents (public/campus users, not necessarily authenticated) fill out paginated surveys with zero data loss on accidental refresh/close.
- Let two internal roles (below) log in and see live, chart-based results per survey.
- Ship a distinctive visual identity (not "generic SaaS dashboard #4381") using the supplied Unhas-derived color palette.

**Non-goals (for now)**

- Public account creation / self-service signup — only admin and visitor accounts, provisioned via seed/admin action.
- Real-time collaborative editing of a survey (single-editor-at-a-time is fine).
- Export pipelines beyond CSV/JSON (no PDF report builder in v1).

---

## 3. Roles & permissions

Only **two** roles exist. There is no public "respondent" account — survey takers are anonymous unless a survey explicitly asks for identifying fields (name, NIM, email) as regular questions, matching how the existing Google Forms are used today.

| Capability                                | Admin | Visitor (faculty internal) |
| ----------------------------------------- | ----- | -------------------------- |
| Log in                                    | ✅    | ✅                         |
| View landing page & take surveys          | ✅    | ✅                         |
| View dashboard statistics                 | ✅    | ✅                         |
| View survey list & survey detail (charts) | ✅    | ✅                         |
| Create / edit / delete surveys            | ✅    | ❌                         |
| Add / edit / delete / reorder questions   | ✅    | ❌                         |
| Publish / unpublish / archive a survey    | ✅    | ❌                         |
| Delete individual responses               | ✅    | ❌                         |
| Manage other users                        | ✅    | ❌                         |

Design implication: **Visitor is a read-only admin**, not a separate app. Reuse the `/admin` shell for both roles, and hide/disable mutation affordances (Tambah Survey, edit/delete icons, question editor "Edit" mode) when `role === "visitor"`. Route-level `beforeLoad` guards must allow both roles into `/admin/*` but server functions that mutate must reject `visitor` server-side too (never trust the client hide).

---

## 4. Design system

### 4.1 Color palette

Your 3 seed colors, expanded into full 11-step scales (50→950, Tailwind-style) plus the supporting neutrals and semantic colors every real product needs. Base colors are anchored at the step closest to their natural lightness rather than forced to 500, so the maroon/dark-red stay believably dark instead of being lightened into a mid-tone.

```json
{
  "primary": {
    "description": "Dark Slate Blue — main brand color, primary buttons, links, active nav, focus rings",
    "50": "#F6F8FC",
    "100": "#E8EEF7",
    "200": "#C5D7F6",
    "300": "#9DBBF0",
    "400": "#5D92F4",
    "500": "#246BF0",
    "600": "#0F53D2",
    "700": "#0B3E9C",
    "800": "#09317C",
    "900": "#042158",
    "950": "#021436",
    "base": "#0B3E9C"
  },
  "secondary": {
    "description": "Maroon — institutional accent (FKG identity color), used sparingly: headers, badges, admin sidebar accents",
    "50": "#FCF5F5",
    "100": "#F8E7E7",
    "200": "#FAC2C2",
    "300": "#F79797",
    "400": "#FF5252",
    "500": "#FF1414",
    "600": "#E00000",
    "700": "#AD0000",
    "800": "#850000",
    "900": "#4A0000",
    "950": "#380000",
    "base": "#4A0000"
  },
  "accent": {
    "description": "Dark Red — destructive actions, error states, required-field markers, urgent stat deltas",
    "50": "#FCF5F5",
    "100": "#F8E7E7",
    "200": "#FAC2C2",
    "300": "#F79797",
    "400": "#FF5252",
    "500": "#FF1414",
    "600": "#E00000",
    "700": "#B00000",
    "800": "#850000",
    "900": "#5C0000",
    "950": "#380000",
    "base": "#B00000"
  },
  "neutral": {
    "description": "Slate-tinted gray, hue borrowed from primary for cohesion. Used for text, borders, surfaces.",
    "0": "#FFFFFF",
    "50": "#F7F8FA",
    "100": "#EEF0F4",
    "200": "#DFE3EA",
    "300": "#C3C9D4",
    "400": "#9AA3B5",
    "500": "#707A90",
    "600": "#525C73",
    "700": "#3C4459",
    "800": "#262C3D",
    "900": "#161A26",
    "950": "#0B0D14"
  },
  "semantic": {
    "success": { "base": "#0E8A5F", "bg": "#E6F6EF", "text": "#0A6947" },
    "warning": { "base": "#B77A0A", "bg": "#FCF1DD", "text": "#8A5B08" },
    "danger": { "base": "#B00000", "bg": "#FBEAEA", "text": "#850000" },
    "info": { "base": "#0B3E9C", "bg": "#E8EEF7", "text": "#09317C" }
  }
}
```

**Usage rules**

- `primary.700` (`#0B3E9C`) is the workhorse brand color: primary buttons, active nav state, links, focus outlines, chart series #1.
- `secondary.900` (`#4A0000`) is a **structural** accent, not a button color — sidebar top border, section eyebrow text, the auth screen's gradient, chart series #2. It's too dark/low-contrast for body text on white, so it's never used for paragraph copy.
- `accent.700` (`#B00000`) is reserved for **danger/destructive** semantics: delete buttons, required-field asterisks, validation error text/borders, "unpublished" badges. Do not use it decoratively — if it shows up, it should mean something is wrong or destructive.
- Charts (survey answer statistics) cycle through `primary.700 → secondary.900 → accent.700 → primary.400 → neutral.500` for series so multi-option Likert/bar charts stay on-brand instead of defaulting to rainbow chart-library colors.
- Dark admin sidebar uses `neutral.900`/`950` as base with `primary.400`/`primary.300` for active/icon states (mirrors the template's current `#818cf8`-on-dark pattern, just re-keyed to our palette).

### 4.2 Typography

- **UI/body font:** `Plus Jakarta Sans` (Google Font) — geometric, highly legible at small sizes, distinct from the generic Inter-everywhere look.
- **Display/heading font:** same family, weight 700–800, slightly tightened letter-spacing (`-0.02em`) for H1/H2 to feel intentional rather than default-bold.
- **Numeric/stat font:** `tabular-nums` feature enabled on all stat cards and chart labels so numbers don't jitter.
- Scale: `12 / 14 / 16 / 18 / 20 / 24 / 30 / 36 / 48px`, line-heights `1.2` for headings, `1.55` for body.

### 4.3 Spacing, radius, shadow, motion

- Spacing scale: 4px base unit — `4,8,12,16,20,24,32,40,48,64`.
- Radius: `--radius-sm: 8px` (inputs, badges), `--radius-md: 12px` (buttons, small cards), `--radius-lg: 20px` (survey cards, modals), `--radius-full` (avatars, pills).
- Shadow: soft, colored-tinted shadows (`rgba(11,62,156,0.08)`) instead of pure black — reinforces brand instead of looking like Bootstrap defaults.
- Motion: 150ms ease-out for hover/press, 220ms for page/section transitions, 400ms skeleton shimmer loop. Respect `prefers-reduced-motion`.

### 4.4 Core components to define (built once, reused everywhere)

`Button` (primary/secondary/danger/ghost variants — extends existing `Button.tsx`), `Input`/`Textarea` (with error state driven by Yup), `Select`, `RadioGroup`, `CheckboxGroup`, `LinearScale` (1–5/1–10 rating row), `SectionCard` (the "Bagian X dari Y" wrapper), `StatCard` (dashboard's 4 cards), `Badge` (draft/published/archived), `Skeleton` (already exists — extend with card/table/chart variants), `Toast` (exists), `Dialog` (exists, used for confirm-delete), `QuestionTypeIcon`, `AnswerChart` (bar for choice/scale questions, list for text questions — matches the Jawaban tab screenshots).

---

## 5. Information architecture

```
/                              Landing — list of published surveys (cards), SPA nav
/survey/$surveySlug            Public survey-taking flow (multi-page)
/survey/$surveySlug/thank-you  Post-submit confirmation
/login                         Shared login for admin + visitor

/admin                         Dashboard (4 stat cards + recent activity)
/admin/surveys                 Survey list, grouped/dropdown by survey type
/admin/surveys/new             "Tambah Survey" wizard
/admin/surveys/$surveyId       Survey detail shell
  ?tab=questions                 → Question management (Google Forms–style editor)
  ?tab=responses                 → Answer statistics (per-question charts, like the Jawaban tab)
  ?tab=settings                  → Publish state, slug, description, sections
/admin/users                   (admin only) manage admin/visitor accounts
```

Tabs on the survey detail page mirror the screenshots' **Pertanyaan / Jawaban / Setelan** structure directly — same mental model, our terms.

---

## 6. Page requirement docs

### 6.1 Landing page (`/`)

- **Full SPA rendering**: route loader kicks off data fetch, but the shell (nav, hero, section headers) paints immediately; survey cards render as `Skeleton` card placeholders until the loader resolves, then swap in — no full-page spinner, no blank white flash.
- Content: hero/intro block (faculty name/branding), then a grid of survey cards — one per **published** survey — each showing title, short description, estimated question count, and a "Mulai" (start) CTA linking to `/survey/$slug`.
- Unpublished/archived surveys never appear here (only in `/admin/surveys`).
- No sidebar, no admin chrome — this is the public-facing shell already present in `__root.tsx` (non-admin, non-auth route).

### 6.2 Survey submission (`/survey/$surveySlug`)

- **Page-based (multi-step)**, one section per step, matching the "Bagian 1 dari 2" model from the screenshots. Progress indicator at top (`Bagian X dari Y`) plus a lightweight progress bar.
- **Local-first draft persistence**: every field change is debounced (~400ms) and written to `localStorage` under a key namespaced by `surveyId` (+ optional session id if we want multi-device continuation later). On mount, if a draft exists, restore it silently and show a small "melanjutkan draf sebelumnya" note with a "mulai ulang" (clear) action. Draft is cleared only on **successful** submission.
- **Validation with Yup**: schema generated dynamically per survey from its question definitions (required flag, type-specific rules — e.g. email format, min/max for scale, min-selected for checkboxes). Validate per-section on "Next" and full-schema on final "Submit".
- **Auto-scroll to first invalid field**: on failed validation, `scrollIntoView({ behavior: "smooth", block: "center" })` the first errored input in DOM order, focus it, and flip that section into view if the error is on a different (already-passed) section.
- Submission calls a server function that writes to `responses`/`answers` tables in one transaction; on success, redirect to `/survey/$slug/thank-you` and purge the local draft.
- Same question types as the admin builder must all have a working, accessible input renderer here (see §7).

### 6.3 Admin — Dashboard (`/admin`)

Four main stat cards (per spec):

1. **Total Surveys** (with published/draft/archived breakdown as a small subtext or mini-badges)
2. **Total Responses** (all-time, across all surveys)
3. **Responses this week/month** (trend delta vs previous period, colored via `semantic.success`/`semantic.danger`)
4. **Completion rate** (submitted vs. started-but-abandoned, if we track partial starts — otherwise "Active Surveys" as the 4th card if partial-start tracking is out of scope for v1)

Below the cards: a recent-activity list/table (latest N responses across surveys, survey name + timestamp) and/or a small chart (responses over time, last 30 days) using the brand chart palette from §4.1.

### 6.4 Admin — Tambah Survey (`/admin/surveys/new`)

A short wizard/form to create the survey shell (title, slug — auto-generated + editable, description, survey type/category tag for the nav dropdown in §6.5). On save, redirect straight into the question editor (`/admin/surveys/$id?tab=questions`) — creating a survey with zero questions isn't a useful end state, so we funnel straight into building it, same as Google Forms opening a blank form into edit mode immediately.

### 6.5 Admin — Surveys navigation (`/admin/surveys`)

- Sidebar/nav groups surveys **by type** (matching the real categories found in the source data: e.g. _Kepuasan Mahasiswa_, _Kepuasan Dosen_, _Kepuasan Pegawai_, _Tracer Study Alumni_, _Kepuasan Pengguna Lulusan_) via a collapsible dropdown per category — click category to expand/collapse, click a survey to go to its detail page.
- Each survey row shows a status badge (Draft/Published/Archived), response count, last updated.
- "Tambah Survey" entry point lives here too (button pinned above the grouped list).

### 6.6 Admin — Survey detail (`/admin/surveys/$surveyId`)

Three tabs, matching Google Forms' information scent:

- **Pertanyaan (Questions)** — the question management editor, see §7. Admin-only; visitor sees a read-only rendered preview of the questions instead of the editor chrome.
- **Jawaban (Responses/Answers)** — per-question answer statistics: bar charts for choice/scale/checkbox questions (with count + percentage, exactly like the screenshots), a scrollable list of raw text answers for open-ended questions, and a response-count header. Include a simple "individual responses" browsing mode (paged table, one row per respondent) in addition to the aggregated charts, since admins in the current workflow work with per-respondent CSVs today.
- **Setelan (Settings)** — publish state toggle, slug, description, section list/order, delete survey (danger zone, confirm dialog).

### 6.7 Admin — Question management

Mirrors Google Forms' editor interactions specifically:

- Questions are grouped into **sections** ("Bagian"); sections can be added, reordered, renamed, and have a description.
- Each question card supports: inline title edit, question-type dropdown (switches the option editor below it), required toggle, drag-to-reorder (within and across sections), duplicate, delete (confirm), and a floating "add block" rail (question / section-break / image — image optional for v1) echoing the `+` icon rail seen in the screenshot.
- Changing a question's type preserves the title/description but resets type-specific config (e.g. going from "Multiple choice" to "Linear scale" clears the option list, prompts for scale min/max).
- Autosave per field blur/change (no separate "Save" button), with a subtle "Tersimpan" indicator — matches Forms' autosave feel and avoids a giant unsaved-changes risk during long editing sessions.

---

## 7. Question types (must mirror Google Forms' set)

| Type                 | Respondent input                                                                                                           | Validation notes                                            | Answer stats view                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------- |
| Short text           | single-line input                                                                                                          | maxLength, optional regex (email/phone)                     | Word/response list                |
| Paragraph            | textarea                                                                                                                   | maxLength                                                   | Response list                     |
| Multiple choice      | radio group                                                                                                                | required = must pick one; supports "Other" free-text option | Bar chart                         |
| Checkboxes           | checkbox group                                                                                                             | min/max selected count                                      | Bar chart (multi-select %)        |
| Dropdown             | native/custom select                                                                                                       | required = must pick one                                    | Bar chart                         |
| Linear scale         | 1–5 or 1–10 rating row                                                                                                     | required = must pick a point                                | Bar chart (matches screenshot #2) |
| Grid / Likert matrix | rows × columns radio grid (e.g. "Integritas / Bahasa Inggris / ..." × "Sangat Baik–Kurang", seen throughout the real CSVs) | each row required independently                             | Stacked bar per row               |
| Date                 | date picker                                                                                                                | valid date, optional min/max                                | Response list                     |
| Section break        | (not an input — page/section divider)                                                                                      | n/a                                                         | n/a                               |

The Likert matrix is the highest-value type to get right early: it's the dominant pattern across almost every real historical survey in `data-example.zip` (Kepuasan Mahasiswa, Dosen, Pegawai, Pengguna all use "criteria × Sangat Baik/Baik/Cukup/Kurang" grids).

---

## 8. Tech stack (confirmed, building on the provided template)

- **Framework:** TanStack Start (file-based routing, already scaffolded in `src/routes`)
- **Bundler:** Rsbuild
- **Runtime:** Bun — note the template's `CLAUDE.md` prefers `bun:sqlite` directly, while the current `db/index.ts` conditionally falls back to `better-sqlite3` under Node. **Decision for Stage 2:** keep the existing dual-path shim as-is (it already works for both `bun run dev` and any Node-based tooling) rather than ripping out `better-sqlite3` — changing it isn't required by this project and risks breaking the Rsbuild dev server path.
- **ORM/migrations:** drizzle-kit + drizzle-orm (sqlite dialect)
- **Validation:** Yup (already a dependency)
- **Auth:** extend the existing cookie-session pattern (`auth.ts` / `authFunctions.ts`) — same `base64(userId:role)` session token approach, just add `"visitor"` alongside `"admin"` as the second role and drop the e-commerce-specific `"customer"` role.
- **Styling:** Vanilla CSS (as today, `styles.css`), extended with the new CSS custom properties from §4.
- **Icons:** lucide-react (already a dependency)

---

## 9. Non-functional requirements

- **Language:** UI copy in Bahasa Indonesia (matches the real survey content and existing admin patterns in the template, e.g. "Akses ditolak", "Keluar").
- **Accessibility:** all custom inputs (RadioGroup, LinearScale, grid) keyboard-navigable and screen-reader labeled; color is never the only signal for validation errors (icon + text + border).
- **Resilience:** survey-taking must survive tab close/refresh (§6.2 local draft) and a slow/failed submit must not lose the respondent's answers (keep draft until a 2xx response is confirmed).
- **Performance:** landing and survey list should feel instant via skeleton-first rendering; nothing should block on a full-page loader.
- **Data integrity:** question type changes and survey deletion are guarded by confirm dialogs; deleting a survey should either cascade-delete responses or be blocked if responses exist (recommend: soft-archive instead of hard delete once a survey has ≥1 response — flagging this as an open question, see §11).

---

## 10. Roadmap (stages — you approve each before I continue)

1. **✅ This document** — Main PRD & design system.
2. **Database schema** — Drizzle schema markdown spec: `users`, `surveys`, `sections`, `questions`, `question_options`, `responses`, `answers` (+ grid-answer shape), plus user seeding and a seed script that parses the real CSVs in `data-example.zip` into actual historical survey + question + response rows.
3. **Design system in code** — CSS tokens, base components (`Button`, `Input`, `Select`, `RadioGroup`, `CheckboxGroup`, `LinearScale`, `StatCard`, `Badge`, extended `Skeleton`), auth pages restyled.
4. **Public flow** — landing page (skeleton SPA) + multi-section survey-taking page (Yup validation, local draft, autoscroll-to-error) + thank-you page.
5. **Admin shell + dashboard** — role-aware `/admin` layout, 4 stat cards, recent activity.
6. **Survey & question management** — Tambah Survey wizard, surveys nav w/ type dropdown, Google Forms–style question editor (drag reorder, all types from §7, autosave).
7. **Answer statistics** — Jawaban-tab charts per question type, individual response browsing, per-survey response table.
8. **Polish & QA pass** — empty states, error boundaries, responsive check, accessibility pass.

---

## 11. Open questions / assumptions (flag if any of these are wrong)

- **Visitor accounts**: assumed to be manually provisioned by an admin (no self-registration). Confirm this is fine, or if visitors need an invite-link flow.
- **Anonymous respondents**: assumed survey-takers do **not** need an account — matches current Google Forms behavior (screenshot 4 shows a Google account picker only because it's Google Forms itself, not a requirement of our app). If FKG actually wants to restrict _who_ can respond (e.g. only certain NIM ranges), that's a v2 concern.
- **Survey deletion vs. archiving**: recommended soft-archive once responses exist (see §9) — confirm you're OK with that instead of hard delete.
- **"Completion rate" stat card**: requires tracking partial/abandoned starts, which means writing a `response` row at _start_ time, not just at submit. Confirm you want this (it's a small but real scope add), otherwise I'll swap card #4 for "Active Surveys" or "Avg. Response Time".
