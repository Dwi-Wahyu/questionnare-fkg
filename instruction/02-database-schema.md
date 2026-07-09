# Stage 2 — Database Schema & Seeding

**Status:** Draft v2 (MySQL) · builds on `01-MAIN-PRD.md` · target stack: Drizzle (**MySQL dialect**) + drizzle-kit + Bun

This is an instruction doc for the implementing agent (Stage 3 execution), not yet applied to the repo. It replaces the earlier SQLite-based draft — same entities, same design decisions, ported to MySQL — because the target database is now a real MySQL server rather than an embedded `bun:sqlite`/`better-sqlite3` file.

---

## 0. Database connection (provisioned)

```
Host:     localhost
Port:     3306
Database: tracerstudy
User:     admin
Password: _Admin123_
```

`.env` at the project root:

```
DATABASE_URL="mysql://admin:_Admin123_@localhost:3306/tracerstudy"
```

The implementing agent should read `DATABASE_URL` from `.env` in both `drizzle.config.ts` and the runtime `db/index.ts` connection — never hardcode credentials in source.

---

## 1. Design decisions (read before the schema)

**Answer storage — one flexible `answers` table, not one-table-per-type.**
Every question type in §7 of the PRD (short text, paragraph, choice, checkboxes, dropdown, linear scale, grid/Likert matrix, date) is answered into the _same_ `answers` table using three nullable value columns instead of a rigid single `value` column:

| Column             | Used by                                                                        | Shape                                                                              |
| ------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `value_text`       | short text, paragraph, date, "Other" free-text                                 | plain string                                                                       |
| `value_option_ids` | multiple choice, dropdown, linear scale (single pick), checkboxes (multi-pick) | JSON array of `question_option.id`, e.g. `[14]` or `[14,15]`                       |
| `value_grid`       | grid/Likert matrix                                                             | JSON object mapping row-option-id → column-option-id, e.g. `{"41":"12","42":"13"}` |

Exactly one of the three is populated per answer row, determined by the parent question's `type`. On MySQL these two JSON-shaped columns use the **native `json` column type** (unlike the SQLite draft, which had to fake it with `text` + manual `JSON.parse`/`stringify` — MySQL 8's `json` type stores and validates JSON natively, and Drizzle's `json()` helper handles serialization automatically).

**Options double as grid rows/columns.** Rather than a separate `grid_rows`/`grid_columns` table, `question_options` gets a `group` field: `"choice"` (normal option/scale point) or `"row"` / `"column"` (grid-only). A grid question has two sets of options in the same table, disambiguated by `group`.

**Sections are first-class**, not just a UI grouping — `questions.sectionId` is required, and a survey with zero custom sections still gets one implicit default section on creation. This directly supports the PRD's page-based submission flow (§6.2) — one section = one page.

**Responses track partial starts**, to support Dashboard stat card #4. A `response` row is created with `status: "started"` the moment someone starts filling a survey, and flips to `"completed"` on final submit.

**Soft state everywhere it matters.** `surveys.status` is `draft | published | archived` (no hard delete of a survey once responses exist). `users.isActive` boolean instead of deleting user rows, so historical `createdBy` references never dangle.

**Denormalized `surveyId` on `questions`** (in addition to `sectionId`) — purely a query-convenience column (avoid a join every time you need "all questions for survey X" for stats), kept in sync at write time.

**MySQL-specific notes vs. the original SQLite draft:**

- Auto-increment primary keys use `int("id").autoincrement().primaryKey()` (MySQL-native `AUTO_INCREMENT`), not SQLite's `integer().primaryKey({ autoIncrement: true })`.
- Booleans use MySQL's `boolean()` helper (stored as `tinyint(1)`) instead of SQLite's `integer(..., { mode: "boolean" })`.
- Timestamps use MySQL's `timestamp()` (with `defaultNow()` where appropriate) instead of storing ISO strings in `text` columns — this gets us real date arithmetic in MySQL for the Dashboard's "this week/month" trend queries instead of string comparisons.
- Variable-length strings that need an index (e.g. `username`, `slug`) must use `varchar("...", { length: N })` — MySQL requires a length on indexed/unique text columns, unlike SQLite's untyped `text`.
- Table/column engine defaults to `InnoDB` (MySQL 8 default) so foreign keys and transactions work as expected — no explicit `ENGINE=` needed in the Drizzle schema, but worth confirming in `drizzle.config.ts`/connection if the agent scaffolds raw SQL anywhere.

---

## 2. Entity relationship overview

```
users ──< surveys (createdBy)
surveys ──< sections ──< questions ──< question_options
surveys ──< responses ──< answers >── questions
                                  ╲── question_options (via value_option_ids / value_grid, referenced by id, not FK-enforced — see note below)
```

> Note on `answers` → `question_options`: because `value_option_ids`/`value_grid` store JSON arrays/maps of option ids rather than single scalar columns, we can't declare a real SQL foreign key on them (MySQL's `json` type isn't FK-referenceable either). Integrity is enforced at the application/server-function layer instead — every write path goes through one `submitResponseFn` server function that validates option ids belong to the stated question before insert.

---

## 3. Schema (`src/server/db/schema.ts`)

This **replaces** the e-commerce schema currently in the template (`products`, `orders`, `orderItems`, `storeSettings` all get removed; `users` is kept and modified). Ported to `drizzle-orm/mysql-core`.

```ts
import {
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar,
  text,
} from "drizzle-orm/mysql-core";

// ─────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["admin", "visitor"]).notNull().default("visitor"),
  name: varchar("name", { length: 150 }).notNull(),
  email: varchar("email", { length: 150 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// SURVEYS
// ─────────────────────────────────────────────────────────────
export const surveys = mysqlTable("surveys", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 150 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  // Category used to group the admin nav dropdown (PRD §6.5).
  category: varchar("category", { length: 100 }).notNull(),
  status: mysqlEnum("status", ["draft", "published", "archived"])
    .notNull()
    .default("draft"),
  createdBy: int("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// ─────────────────────────────────────────────────────────────
// SECTIONS  ("Bagian 1 dari N")
// ─────────────────────────────────────────────────────────────
export const sections = mysqlTable(
  "sections",
  {
    id: int("id").autoincrement().primaryKey(),
    surveyId: int("survey_id")
      .references(() => surveys.id, { onDelete: "cascade" })
      .notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    order: int("order").notNull().default(0),
  },
  (table) => ({
    surveyIdx: index("sections_survey_idx").on(table.surveyId),
  }),
);

// ─────────────────────────────────────────────────────────────
// QUESTIONS
// ─────────────────────────────────────────────────────────────
export const questions = mysqlTable(
  "questions",
  {
    id: int("id").autoincrement().primaryKey(),
    surveyId: int("survey_id")
      .references(() => surveys.id, { onDelete: "cascade" })
      .notNull(), // denormalized, see §1
    sectionId: int("section_id")
      .references(() => sections.id, { onDelete: "cascade" })
      .notNull(),
    type: mysqlEnum("type", [
      "short_text",
      "paragraph",
      "multiple_choice",
      "checkboxes",
      "dropdown",
      "linear_scale",
      "grid",
      "date",
    ]).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    required: boolean("required").notNull().default(false),
    order: int("order").notNull().default(0),
    allowOther: boolean("allow_other").notNull().default(false),
    // Type-specific config that doesn't need its own table:
    // short_text/paragraph -> { maxLength?, pattern? }
    // checkboxes           -> { minSelected?, maxSelected? }
    // linear_scale         -> { min, max, minLabel?, maxLabel? }
    // grid                 -> { rowsRequired?: boolean }
    // date                 -> { minDate?, maxDate? }
    config: json("config").$type<Record<string, unknown>>(),
  },
  (table) => ({
    surveyIdx: index("questions_survey_idx").on(table.surveyId),
    sectionIdx: index("questions_section_idx").on(table.sectionId),
  }),
);

// ─────────────────────────────────────────────────────────────
// QUESTION OPTIONS (choices, scale points, and grid rows/columns)
// ─────────────────────────────────────────────────────────────
export const questionOptions = mysqlTable(
  "question_options",
  {
    id: int("id").autoincrement().primaryKey(),
    questionId: int("question_id")
      .references(() => questions.id, { onDelete: "cascade" })
      .notNull(),
    // "choice" for multiple_choice/checkboxes/dropdown/linear_scale points,
    // "row" / "column" for grid questions only.
    group: mysqlEnum("group", ["choice", "row", "column"])
      .notNull()
      .default("choice"),
    label: varchar("label", { length: 500 }).notNull(),
    value: varchar("value", { length: 255 }), // optional machine value distinct from display label
    order: int("order").notNull().default(0),
  },
  (table) => ({
    questionIdx: index("question_options_question_idx").on(table.questionId),
  }),
);

// ─────────────────────────────────────────────────────────────
// RESPONSES  (one per respondent submission attempt)
// ─────────────────────────────────────────────────────────────
export const responses = mysqlTable(
  "responses",
  {
    id: int("id").autoincrement().primaryKey(),
    surveyId: int("survey_id")
      .references(() => surveys.id, { onDelete: "cascade" })
      .notNull(),
    status: mysqlEnum("status", ["started", "completed"])
      .notNull()
      .default("started"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    submittedAt: timestamp("submitted_at"),
    // Best-effort respondent fingerprint for the "restore my draft" flow —
    // not used for identity/security, just draft correlation.
    clientDraftId: varchar("client_draft_id", { length: 100 }),
  },
  (table) => ({
    surveyIdx: index("responses_survey_idx").on(table.surveyId),
  }),
);

// ─────────────────────────────────────────────────────────────
// ANSWERS
// ─────────────────────────────────────────────────────────────
export const answers = mysqlTable(
  "answers",
  {
    id: int("id").autoincrement().primaryKey(),
    responseId: int("response_id")
      .references(() => responses.id, { onDelete: "cascade" })
      .notNull(),
    questionId: int("question_id")
      .references(() => questions.id, { onDelete: "cascade" })
      .notNull(),
    valueText: text("value_text"),
    valueOptionIds: json("value_option_ids").$type<number[]>(),
    valueGrid: json("value_grid").$type<Record<string, number>>(),
  },
  (table) => ({
    responseIdx: index("answers_response_idx").on(table.responseId),
    questionIdx: index("answers_question_idx").on(table.questionId),
  }),
);
```

---

## 3.1 `drizzle.config.ts`

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL!, // mysql://admin:_Admin123_@localhost:3306/tracerstudy
  },
  verbose: true,
  strict: true,
});
```

## 3.2 `src/server/db/index.ts` (connection)

```ts
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const poolConnection = mysql.createPool({
  uri: process.env.DATABASE_URL, // mysql://admin:_Admin123_@localhost:3306/tracerstudy
});

export const db = drizzle(poolConnection, { schema, mode: "default" });
```

This replaces the template's `bun:sqlite` / `better-sqlite3` dual-path shim entirely — there's no runtime branching needed for MySQL, `mysql2` works the same under Bun and Node.

## 3.3 `package.json` scripts

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "db:seed": "bun run src/server/db/seed.ts"
  }
}
```

**Migration note (changed from the SQLite draft):** the SQLite draft used `drizzle-kit push` (schema-diff-and-apply, no migration files) since that's fine for a throwaway local `sqlite.db`. On a real MySQL server we want an auditable migration history instead, so the flow is now:

1. `bun run db:generate` — diffs `schema.ts` against the current migration state and writes a new SQL migration file under `./drizzle/`.
2. `bun run db:migrate` — runs `drizzle-kit migrate`, which applies any pending migration files in `./drizzle/` to the database at `DATABASE_URL`, in order, tracked via Drizzle's own `__drizzle_migrations` bookkeeping table.

Run `db:generate` once per schema change, commit the generated `.sql` file, then run `db:migrate` in every environment (local, staging, prod) to apply it — never hand-edit the generated SQL unless you know exactly why.

Dependencies needed: `drizzle-orm`, `drizzle-kit` (dev), `mysql2`.

---

## 4. Survey categories (for the admin nav dropdown, PRD §6.5)

Derived directly from the 9 real CSVs in `data-example.zip`, each becomes a `surveys.category` value:

| Category value              | Label (Bahasa Indonesia)              | Source CSV                                                           |
| --------------------------- | ------------------------------------- | -------------------------------------------------------------------- |
| `kepuasan_mahasiswa`        | Kepuasan Mahasiswa                    | `Form Kepuasan Mahasiswa*.csv` (3 variants — see §5 note)            |
| `kepuasan_dosen`            | Kepuasan Dosen                        | `form kepuasan dosen fkg (Responses).csv`                            |
| `kepuasan_pegawai`          | Kepuasan Pegawai                      | `Form Kepuasan Pegawai (Responses).csv`                              |
| `kepuasan_pengelola`        | Kepuasan Mahasiswa terhadap Pengelola | `Kuesioner Mahasiswa terhadap Pengelola FKG - UNHAS (Responses).csv` |
| `kepuasan_pengguna_lulusan` | Kepuasan Pengguna Lulusan             | `Kuisioner Pengguna*.csv` (2 variants — see §5 note)                 |
| `tracer_alumni`             | Tracer Study Alumni                   | `Kusioner Alumni (Responses).csv`                                    |

---

## 5. Seeding plan (`src/server/db/seed.ts`)

### 5.1 Source data caveat

Each CSV in `data-example.zip` currently contains **only 1 real response row** (header + 1 data row) — these are cleaned samples, not full historical datasets. The seed script therefore:

1. Parses each CSV's **header row** to auto-derive that survey's sections/questions/options (see §5.3 mapping rules).
2. Inserts the **1 real row** verbatim as an actual `responses` + `answers` record (status `completed`, `submittedAt` = the row's `Timestamp` column parsed into a real `Date`, since MySQL's `timestamp` column expects a `Date`/ISO input via `mysql2`, not a raw string).
3. Generates **20–60 additional synthetic responses per survey** with Faker, sampling from the _actual value vocabulary_ seen in the real data (e.g. `"Sangat Baik" | "Baik" | "Cukup" | "Kurang"` for satisfaction grids) rather than fully random text, so the seeded charts look like a real completed tracer study instead of Lorem Ipsum noise.
4. Where a CSV file is a near-duplicate of another (e.g. `Form Kepuasan Mahasiswa (Responses).csv` vs. `...2025 (Responses).csv` vs. `...Rev (Responses).csv`), seed them as **three separate surveys** under the same `kepuasan_mahasiswa` category rather than merging them. Same treatment for the two `Kuisioner Pengguna` variants.

### 5.2 Users to seed

| username  | password     | role      | name            |
| --------- | ------------ | --------- | --------------- |
| `admin`   | `_Admin123_` | `admin`   | Admin FKG Unhas |
| `visitor` | `visitor123` | `visitor` | Dekan FKG Unhas |

(Hash both passwords up front with bcrypt, batch-insert both rows in one `db.insert(users).values([...])` call.)

### 5.3 CSV → schema mapping rules

For each CSV:

- **Timestamp** column → not a question; becomes `responses.submittedAt`.
- **Free-text identity/contact columns** (`Nama Lengkap`, `Email`, `NIM`, `No telp/Whatsapp`, `Alamat`, `Jabatan`, `Instansi`, etc.) → `question.type = "short_text"`, `required: true` for name, `false` for the rest; grouped into an auto-generated first section titled **"Data Diri"**.
- **Columns with a small, repeated value vocabulary across rows** (`Sangat Baik/Baik/Cukup/Kurang`, `Sangat baik/Baik`, `Sangat Puas/Cukup Puas`, `Sangat relevan/...`) → these are the **grid rows** of one `type: "grid"` question per logical cluster. Detecting the cluster: group consecutive columns that share the same answer-vocabulary set.
- **Single-answer categorical columns not part of a repeated cluster** (e.g. `Tahun Masuk FKG`, `Lama kerja alumni...`) → `type: "dropdown"` if the observed values look like a closed set, else `type: "short_text"`.
- **Long open-ended columns** → `type: "paragraph"`.
- Every derived question gets `order` = its column position; every derived section gets `order` = its appearance order.

This mapping runs once, offline, to produce the seed script's hardcoded question definitions per survey (not a generic "CSV importer" feature in the app itself — out of scope per the PRD's non-goals).

### 5.4 Synthetic response generation

For the 20–60 filler responses per survey:

- Use **batched `db.transaction` inserts** (batches of ~500) — total rows across `responses` + `answers` for ~9 surveys × ~40 filler responses × ~10 questions average will land around 3,000–4,000 answer rows.
- `answers.valueText` for short_text/paragraph: Faker Indonesian-locale-flavored names/sentences where possible (`faker.person.fullName()`, `faker.lorem.sentence()`).
- `answers.valueOptionIds` / `valueGrid`: sampled from that question's actual `question_options` rows, weighted toward the "positive" end of each scale (e.g. 60% Sangat Baik/Baik, 30% Cukup, 10% Kurang).
- `responses.startedAt` spread across the last 12 months, `submittedAt` = `startedAt` + a few minutes, `status: "completed"` for all synthetic rows (2–5 deliberately `status: "started"` / `submittedAt: null` rows per survey, to make the Dashboard's completion-rate card non-trivial).

### 5.5 Script skeleton (structure only — full data arrays filled in during Stage 3)

```ts
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db } from "./index";
import {
  answers,
  questionOptions,
  questions,
  responses,
  sections,
  surveys,
  users,
} from "./schema";

async function main() {
  // 1. Clear in FK-safe order
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
  await db.delete(answers);
  await db.delete(responses);
  await db.delete(questionOptions);
  await db.delete(questions);
  await db.delete(sections);
  await db.delete(surveys);
  await db.delete(users);
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);

  // 2. Users
  const adminHash = await bcrypt.hash("_Admin123_", 10);
  const visitorHash = await bcrypt.hash("visitor123", 10);
  await db.insert(users).values([
    {
      username: "admin",
      passwordHash: adminHash,
      role: "admin",
      name: "Admin FKG Unhas",
    },
    {
      username: "visitor",
      passwordHash: visitorHash,
      role: "visitor",
      name: "Dekan FKG Unhas",
    },
  ]);
  const [admin] = await db
    .select()
    .from(users)
    .where(sql`username = 'admin'`);

  // 3. For each of the 9 surveys: insert survey -> sections -> questions -> options,
  //    then the 1 real response + N synthetic responses.
  //    (Per-survey definitions live in ./seed-data/*.ts, one file per source CSV.)
  await seedKepuasanMahasiswa(db, admin.id);
  await seedKepuasanMahasiswa2025(db, admin.id);
  await seedKepuasanMahasiswaRev(db, admin.id);
  await seedKepuasanDosen(db, admin.id);
  await seedKepuasanPegawai(db, admin.id);
  await seedKepuasanPengelola(db, admin.id);
  await seedKuisionerPengguna(db, admin.id);
  await seedKuisionerPenggunaCopy(db, admin.id);
  await seedKusionerAlumni(db, admin.id);

  console.log(
    "✅ Seed complete: 2 users, 9 surveys, seeded questions + responses.",
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
```

Each `seedX` function follows the same shape: insert `surveys` row → insert its `sections` → insert `questions` per section → insert `questionOptions` per question → insert the 1 real `responses`+`answers` row → loop-insert N synthetic `responses`+`answers` rows in a transaction.

Note: MySQL's `mysql2` driver via Drizzle doesn't support SQLite's `.returning()` — after an insert, either use the `insertId` from the raw result (`const [result] = await db.insert(users).values(...); result.insertId`) or re-`select` by a unique field (username, slug) as shown above. The implementing agent should use whichever is cleaner per call site, but must not assume `.returning()` works.

---

## 6. Auth schema impact

`authFunctions.ts`/`auth.ts` need exactly one change from what's in the template: the `role` union shrinks from `"admin" | "customer"` to `"admin" | "visitor"`, and `SessionUser` / the session-token decode logic update to match. No structural change to the cookie-session approach itself.

---

## 7. What's out of scope for this schema (confirm or flag)

- **No answer edit history / versioning** — an admin editing a question after responses exist doesn't retroactively touch old `answers` rows.
- **No multi-tenant/faculty-scoping** — everything is FKG Unhas only, no `organizations` table.
- **No file-upload question type** — not in the PRD's §7 type list; skipped here too.

---

## 8. Execution checklist for the implementing (CLI) agent

1. Add `.env` with `DATABASE_URL="mysql://admin:_Admin123_@localhost:3306/tracerstudy"` (database `tracerstudy` and user `admin`/`_Admin123_` are already provisioned on the target MySQL server — confirm reachability with `mysql -uadmin -p_Admin123_ tracerstudy -e "SELECT 1"` before proceeding).
2. Install deps: `bun add drizzle-orm mysql2` and `bun add -D drizzle-kit`.
3. Remove the e-commerce schema, write `src/server/db/schema.ts` per §3.
4. Add `drizzle.config.ts` per §3.1 and update `src/server/db/index.ts` per §3.2.
5. Add the scripts from §3.3 to `package.json`.
6. Run `bun run db:generate` → review the generated SQL under `./drizzle/`.
7. Run `bun run db:migrate` → applies it to `tracerstudy`.
8. Implement and run `bun run db:seed` per §5.

Approve this and I'll move to **Stage 3: design system in code** — CSS custom properties + base components (`Button`, `Input`, `Select`, `RadioGroup`, `CheckboxGroup`, `LinearScale`, `StatCard`, `Badge`, extended `Skeleton`) applied to a restyled login/auth screen.
