import { sql } from "drizzle-orm";
import { readFileSync } from "fs";
import { join, resolve } from "path";
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
import { seedSurveyCategories } from "./seedCategories";

// ─────────────────────────────────────────────────────────────
// Full CSV parser that operates on the ENTIRE file content (not
// per-line). Same approach as seed.ts: Google Forms export can embed
// newlines inside quoted header cells, so we walk the raw content
// character-by-character rather than splitting on /\r?\n/ first.
// ─────────────────────────────────────────────────────────────
function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field.trim());
      field = "";
    } else if (char === "\r") {
      // ignore; \n (or end of content) handles the record break
    } else if (char === "\n") {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  return rows;
}

// ─────────────────────────────────────────────────────────────
// Survey config
// ─────────────────────────────────────────────────────────────
const CSV_FILE = "form_kuisioner_pengguna_2025_2026.csv";
const SURVEY_SLUG = "kuisioner-pengguna-2025-2026";
const SURVEY_TITLE = "Kuisioner Pengguna Lulusan 2025/2026";
const SURVEY_CATEGORY = "survey-pengguna"; // already defined in seedCategories.ts

// The 9-item "Kriteria Penilaian" scale, in the exact order they appear in
// the source Google Form (confirmed against the live form's question list).
const KRITERIA_LABELS = [
  "Integritas",
  "Keahlian berdasarkan bidang ilmu (profesionalisme)",
  "Kemampuan Bahasa Inggris",
  "Penggunaan Teknologi Informasi",
  "Komunikasi",
  "Kerjasama tim dan kepemimpinan",
  "Pengembangan diri",
  "Kesiapan untuk berpartisipasi aktif di masyarakat",
  "Keselamatan pasien, mahasiswa, dan lingkungan",
] as const;

const LAMA_KERJA_OPTIONS = [
  "0 - 3 tahun",
  "3 - 5 Tahun",
  "5 - 10 Tahun",
  "10 - 15 Tahun",
  "Lebih dari 15 Tahun",
] as const;

const PENILAIAN_OPTIONS = ["Sangat baik", "Baik", "Cukup", "Kurang"] as const;

// ─────────────────────────────────────────────────────────────
// Column map for the repeating "per-alumnus" block.
//
// Confirmed against the live Google Form: the form only ever asks about
// 4 alumni, labeled "Alumni 1", "Alumni 3", "Alumni 4", "Alumni 5" (there
// is no "Alumni 2" — that's the form's own numbering, not a data error).
// Each block = Nama Alumni + Lama kerja + 9 Kriteria Penilaian, matching
// columns 1-44 of the exported CSV exactly.
//
// Columns 45-69 in the raw CSV (~25 unlabeled trailing columns) are
// leftover data from questions no longer on the live form and are
// intentionally NOT seeded here.
// ─────────────────────────────────────────────────────────────
interface AlumniBlock {
  label: string; // e.g. "Alumni 1" — used as a section title
  namaCol: number;
  lamaKerjaCol: number;
  kriteriaCols: number[]; // must align 1:1 with KRITERIA_LABELS, in order
  required: boolean; // only the first alumnus is mandatory on the live form
}

const ALUMNI_BLOCKS: AlumniBlock[] = [
  {
    label: "Alumni 1",
    namaCol: 1,
    lamaKerjaCol: 2,
    kriteriaCols: [3, 4, 5, 6, 7, 8, 9, 10, 11],
    required: true,
  },
  {
    label: "Alumni 3",
    namaCol: 12,
    lamaKerjaCol: 13,
    kriteriaCols: [14, 15, 16, 17, 18, 19, 20, 21, 22],
    required: false,
  },
  {
    label: "Alumni 4",
    namaCol: 23,
    lamaKerjaCol: 24,
    kriteriaCols: [25, 26, 27, 28, 29, 30, 31, 32, 33],
    required: false,
  },
  {
    label: "Alumni 5",
    namaCol: 34,
    lamaKerjaCol: 35,
    kriteriaCols: [36, 37, 38, 39, 40, 41, 42, 43, 44],
    required: false,
  },
];

// Case-insensitive match of a raw cell value against a known option list.
function matchOption(
  cellVal: string,
  options: readonly string[],
): string | null {
  const v = cellVal.trim();
  if (v === "") return null;
  const found = options.find((o) => o.toLowerCase() === v.toLowerCase());
  return found ?? null;
}

async function main() {
  console.log("🚀 Seeding: Kuisioner Pengguna Lulusan 2025/2026...");

  // 1. Make sure prerequisite data exists (users + categories are seeded by
  // their own scripts; this seeder only owns its own survey's rows so it
  // never touches other surveys' data).
  await seedSurveyCategories();

  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`username = 'admin'`);

  if (!admin) {
    throw new Error(
      "❌ No 'admin' user found. Run `bun run db:seed-users` first.",
    );
  }
  const adminId = admin.id;

  // 2. Read + parse the CSV
  const rootDir = process.cwd();
  const asliDir = resolve(rootDir, "../data-asli");
  const csvPath = join(asliDir, CSV_FILE);
  const content = readFileSync(csvPath, "utf-8");
  const records = parseCSV(content);

  let headerIdx = -1;
  for (let i = 0; i < records.length; i++) {
    const first = records[i][0]?.toLowerCase() ?? "";
    if (first.includes("cap waktu") || first.includes("timestamp")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    throw new Error(`❌ Header row ('Cap waktu') not found in ${CSV_FILE}`);
  }

  // A "test" pattern check (e.g. "test", "test2", "test3", "test4") on the
  // Alumni 1 name field — catches obvious dummy submissions used to verify
  // the live form (e.g. the 2026-08-01 row with test/test2/test3/test4)
  // without risking a false positive against a real alumnus's name.
  const isTestRow = (r: string[]): boolean => {
    const nama1 = (r[ALUMNI_BLOCKS[0].namaCol] ?? "").trim();
    return /^test\d*$/i.test(nama1);
  };

  const allRows = records
    .slice(headerIdx + 1)
    .filter((r) => r.length > 0 && !r.every((c) => c === ""));

  const testRowCount = allRows.filter(isTestRow).length;
  const dataRows = allRows.filter((r) => !isTestRow(r));

  if (dataRows.length === 0) {
    throw new Error(`❌ No data rows found in ${CSV_FILE}`);
  }
  console.log(
    `📄 Parsed ${allRows.length} rows from ${CSV_FILE} — skipped ${testRowCount} test row(s), seeding ${dataRows.length}`,
  );

  // 3. Remove any previous run of THIS survey only (idempotent re-seed,
  // FK cascades handle sections/questions/options/responses/answers).
  const [existing] = await db
    .select({ id: surveys.id })
    .from(surveys)
    .where(sql`slug = ${SURVEY_SLUG}`);
  if (existing) {
    console.log(
      `🗑️ Removing previous "${SURVEY_SLUG}" survey (id=${existing.id})...`,
    );
    await db.delete(surveys).where(sql`id = ${existing.id}`);
  }

  // 4. Create the survey
  const [surveyInsert] = await db.insert(surveys).values({
    slug: SURVEY_SLUG,
    title: SURVEY_TITLE,
    description:
      "Evaluasi pengguna lulusan (instansi/perusahaan tempat alumni FKG Unhas bekerja) terhadap kinerja alumni.",
    category: SURVEY_CATEGORY,
    status: "published",
    periodType: "date",
    periodValue: "2025-08-01",
    periodValueEnd: "2027-07-31",
    createdBy: adminId,
  });
  const surveyId = (surveyInsert as any).insertId;
  console.log(`✅ Survey created (id=${surveyId})`);

  // 5. Create one section per alumnus block + build the question set
  interface SimpleQuestion {
    id: number;
    col: number;
    kind: "nama" | "lama_kerja";
    optionIdMap: Record<string, number>;
  }
  interface GridQuestion {
    id: number;
    kind: "kriteria_grid";
    // one entry per CSV column feeding this grid's rows, in KRITERIA_LABELS order
    rowCols: { col: number; rowOptionId: number }[];
    colOptionIdMap: Record<string, number>;
  }
  type BuiltQuestion = SimpleQuestion | GridQuestion;
  const builtQuestions: BuiltQuestion[] = [];

  // Satu section untuk seluruh survei — semua alumni tampil di 1 halaman
  // (sections dipakai sebagai jumlah "langkah" pada survey.$surveySlug.tsx,
  // jadi 1 section = 1 halaman, tidak ada lagi stepper per-alumni).
  const [secInsert] = await db.insert(sections).values({
    surveyId,
    title: "Penilaian Alumni",
    description:
      "Data dan penilaian kompetensi untuk setiap alumni yang bekerja di instansi Anda.",
    order: 0,
  });
  const sectionId = (secInsert as any).insertId;

  let qOrder = 0;

  for (const block of ALUMNI_BLOCKS) {
    // Nama Alumni (short_text)
    const [namaInsert] = await db.insert(questions).values({
      surveyId,
      sectionId,
      type: "short_text",
      title: `Nama ${block.label}`,
      required: block.required,
      order: qOrder++,
    });
    builtQuestions.push({
      id: (namaInsert as any).insertId,
      col: block.namaCol,
      kind: "nama",
      optionIdMap: {},
    });

    // Lama kerja (multiple_choice, 5 options)
    const [lamaInsert] = await db.insert(questions).values({
      surveyId,
      sectionId,
      type: "multiple_choice",
      title: `Lama kerja ${block.label} di instansi Anda`,
      required: block.required,
      order: qOrder++,
    });
    const lamaQuestionId = (lamaInsert as any).insertId;
    const lamaOptionIdMap: Record<string, number> = {};
    for (let i = 0; i < LAMA_KERJA_OPTIONS.length; i++) {
      const label = LAMA_KERJA_OPTIONS[i];
      const [optInsert] = await db.insert(questionOptions).values({
        questionId: lamaQuestionId,
        group: "choice",
        label,
        value: label,
        order: i,
      });
      lamaOptionIdMap[label] = (optInsert as any).insertId;
    }
    builtQuestions.push({
      id: lamaQuestionId,
      col: block.lamaKerjaCol,
      kind: "lama_kerja",
      optionIdMap: lamaOptionIdMap,
    });

    // Kriteria Penilaian: ONE "grid" (Kisi Pilihan Ganda) question per
    // alumnus block — 9 rows (criteria) x 4 columns (rating scale), matching
    // how it actually appears on the live Google Form (a single matrix
    // question), not 9 separate multiple_choice questions.
    const [gridInsert] = await db.insert(questions).values({
      surveyId,
      sectionId,
      type: "grid",
      title: `Kriteria Penilaian — ${block.label}`,
      required: block.required,
      order: qOrder++,
      config: { rowsRequired: block.required },
    });
    const gridQuestionId = (gridInsert as any).insertId;

    // Columns first (Sangat baik / Baik / Cukup / Kurang)
    const colOptionIdMap: Record<string, number> = {};
    for (let i = 0; i < PENILAIAN_OPTIONS.length; i++) {
      const label = PENILAIAN_OPTIONS[i];
      const [optInsert] = await db.insert(questionOptions).values({
        questionId: gridQuestionId,
        group: "column",
        label,
        value: label,
        order: i,
      });
      colOptionIdMap[label] = (optInsert as any).insertId;
    }

    // Rows (the 9 criteria), paired 1:1 with block.kriteriaCols
    const rowCols: { col: number; rowOptionId: number }[] = [];
    for (let k = 0; k < KRITERIA_LABELS.length; k++) {
      const [optInsert] = await db.insert(questionOptions).values({
        questionId: gridQuestionId,
        group: "row",
        label: KRITERIA_LABELS[k],
        order: k,
      });
      rowCols.push({
        col: block.kriteriaCols[k],
        rowOptionId: (optInsert as any).insertId,
      });
    }

    builtQuestions.push({
      id: gridQuestionId,
      kind: "kriteria_grid",
      rowCols,
      colOptionIdMap,
    });
  }
  console.log(
    `⚙️ Created ${builtQuestions.length} questions in 1 section, covering ${ALUMNI_BLOCKS.length} alumni blocks`,
  );

  // 6. Insert every real row from the CSV as a response
  let insertedCount = 0;
  await db.transaction(async (tx) => {
    for (const row of dataRows) {
      let submittedAt = new Date();
      const tsStr = row[0]?.trim();
      if (tsStr) {
        const parsed = new Date(tsStr);
        if (!Number.isNaN(parsed.getTime())) submittedAt = parsed;
      }

      const [respInsert] = await tx.insert(responses).values({
        surveyId,
        status: "completed",
        startedAt: new Date(submittedAt.getTime() - 10 * 60 * 1000),
        submittedAt,
      });
      const responseId = (respInsert as any).insertId;

      const answerRows = builtQuestions.map((q) => {
        if (q.kind === "nama") {
          const cellVal = row[q.col]?.trim() || "";
          return {
            responseId,
            questionId: q.id,
            valueText: cellVal !== "" ? cellVal : null,
            valueOptionIds: null,
            valueGrid: null,
          };
        }
        if (q.kind === "lama_kerja") {
          const cellVal = row[q.col]?.trim() || "";
          const matched = matchOption(cellVal, LAMA_KERJA_OPTIONS);
          const optId = matched ? q.optionIdMap[matched] : null;
          return {
            responseId,
            questionId: q.id,
            valueText: null,
            valueOptionIds: optId ? [optId] : null,
            valueGrid: null,
          };
        }
        // kriteria_grid: fold all 9 CSV cells for this alumnus into one
        // valueGrid = { [rowOptionId]: colOptionId }
        const valueGrid: Record<string, number> = {};
        for (const { col, rowOptionId } of q.rowCols) {
          const cellVal = row[col]?.trim() || "";
          const matched = matchOption(cellVal, PENILAIAN_OPTIONS);
          if (matched) {
            valueGrid[String(rowOptionId)] = q.colOptionIdMap[matched];
          }
        }
        return {
          responseId,
          questionId: q.id,
          valueText: null,
          valueOptionIds: null,
          valueGrid: Object.keys(valueGrid).length > 0 ? valueGrid : null,
        };
      });

      await tx.insert(answers).values(answerRows);
      insertedCount++;
    }
  });

  console.log(
    `📥 Seeded ${insertedCount} real responses for "${SURVEY_TITLE}"`,
  );
  console.log("🎉 Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
