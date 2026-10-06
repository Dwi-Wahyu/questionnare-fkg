import { eq, sql } from "drizzle-orm";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
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
// Robust CSV parser (handles quotes & newlines)
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
					i++;
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
			// ignore
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

const SURVEY_SLUG = "kepuasan-tendik-iso";
const SURVEY_TITLE = "Formulir Kepuasan Tendik/Pegawai FKG - UNHAS";
const SURVEY_CATEGORY = "iso";
const SURVEY_DESCRIPTION =
	"Formulir pengumpulan data ini di perlukan sebagai salah satu kelengkapan dalam penilaian Sertifikasi ISO FKG Unhas Periode JULI - DESEMBER Tahun 2025. Diharapkan untuk mengisi sesuai dengan kondisi yang ada.";

const SCALE_OPTIONS = [
	{ label: "Tidak Puas", value: "1" },
	{ label: "Kurang Puas", value: "2" },
	{ label: "Cukup Puas", value: "3" },
	{ label: "Puas", value: "4" },
	{ label: "Sangat puas", value: "5" },
] as const;

const MATRIX_ROWS = ["Harapan / Kepentingan", "Persepsi / Kinerja"] as const;

const MATRIX_QUESTIONS = [
	"Kelengkapan sarana/prasarana dalam menunjang kegiatan unit kerja",
	"Kesigapan petugas dalam memberikan pelayanan administrasi di unit kerja",
	"Kebersihan, kerapian dan kenyamanan ruangan unit kerja",
	"Kemampuan petugas memberikan penjelasan terkait administrasi di unit kerja",
	"Kesopanan dan keramahan petugas dalam memberikan pelayanan administrasi di unit kerja",
	"Kejelasan prosedur terkait administrasi di unit kerja",
	"Penyampaian informasi di unit kerja jelas dan mudah dimengerti",
] as const;

function matchScaleOption(
	cellVal: string,
): { label: string; value: string } | null {
	const normalized = cellVal.trim().toLowerCase();
	if (!normalized) return null;
	const found = SCALE_OPTIONS.find(
		(opt) => opt.label.toLowerCase() === normalized,
	);
	return found ?? null;
}

function parseTimestamp(tsStr: string): Date {
	const trimmed = tsStr.trim();
	const parsed = new Date(trimmed);
	if (!Number.isNaN(parsed.getTime())) {
		return parsed;
	}
	return new Date();
}

export async function seedKepuasanTendikIso() {
	console.log("🚀 Seeding: Formulir Kepuasan Tendik Kategori ISO...");

	await seedSurveyCategories();

	const [admin] = await db
		.select({ id: users.id })
		.from(users)
		.where(sql`username = 'admin'`);

	if (!admin) {
		throw new Error(
			"❌ Admin user not found. Please run `bun run db:seed-users` first.",
		);
	}
	const adminId = admin.id;

	const candidates = [
		resolve(process.cwd(), "data-asli/iso/form-kepuasan-tendik/responses.csv"),
		resolve(
			process.cwd(),
			"../data-asli/iso/form-kepuasan-tendik/responses.csv",
		),
	];
	const csvPath = candidates.find((p) => existsSync(p));
	if (!csvPath) {
		throw new Error(
			"❌ responses.csv not found in data-asli/iso/form-kepuasan-tendik/responses.csv",
		);
	}

	console.log(`📄 Reading responses CSV from: ${csvPath}`);
	const rawContent = readFileSync(csvPath, "utf-8");
	const records = parseCSV(rawContent);

	let headerIdx = -1;
	for (let i = 0; i < records.length; i++) {
		const first = records[i][0]?.toLowerCase() ?? "";
		if (first.includes("timestamp") || first.includes("cap waktu")) {
			headerIdx = i;
			break;
		}
	}

	if (headerIdx === -1) {
		throw new Error("❌ Header row containing 'Timestamp' not found in CSV");
	}

	const headers = records[headerIdx];
	const dataRows = records
		.slice(headerIdx + 1)
		.filter((r) => r.length > 0 && !r.every((c) => c === ""));

	console.log(`📊 Found ${dataRows.length} valid response rows in CSV`);

	const colMap: Record<string, number> = {};
	for (let col = 0; col < headers.length; col++) {
		const h = headers[col];
		const match = h.match(/^(.*?)\s*\[\s*(.*?)\s*\]$/);
		if (match) {
			const qTitle = match[1].trim();
			const rowLabel = match[2].trim();
			colMap[`${qTitle}:::${rowLabel}`] = col;
		}
	}

	// Delete previous survey if exists (idempotent)
	const [existing] = await db
		.select({ id: surveys.id })
		.from(surveys)
		.where(eq(surveys.slug, SURVEY_SLUG));

	if (existing) {
		console.log(
			`🗑️ Removing existing "${SURVEY_SLUG}" survey (id=${existing.id})...`,
		);
		await db.delete(surveys).where(eq(surveys.id, existing.id));
	}

	const [surveyInsert] = await db.insert(surveys).values({
		slug: SURVEY_SLUG,
		title: SURVEY_TITLE,
		description: SURVEY_DESCRIPTION,
		category: SURVEY_CATEGORY,
		status: "published",
		periodType: "month",
		periodValue: "2025-07",
		periodValueEnd: "2026-12",
		targetRespondentCount: 30,
		createdBy: adminId,
	});
	const surveyId = (surveyInsert as any).insertId;
	console.log(`✅ Survey created: "${SURVEY_TITLE}" (id=${surveyId})`);

	// Section 1: Demografi (Data Pribadi)
	const [sec1Insert] = await db.insert(sections).values({
		surveyId,
		title: "Data Pribadi",
		description:
			"Lengkapi identitas diri Anda sebelum mengisi instrumen evaluasi kepuasan.",
		order: 0,
	});
	const section1Id = (sec1Insert as any).insertId;

	const [qEmailInsert] = await db.insert(questions).values({
		surveyId,
		sectionId: section1Id,
		type: "short_text",
		title: "Email",
		required: true,
		order: 0,
	});
	const qEmailId = (qEmailInsert as any).insertId;

	const [qNamaInsert] = await db.insert(questions).values({
		surveyId,
		sectionId: section1Id,
		type: "short_text",
		title: "Nama",
		required: true,
		order: 1,
	});
	const qNamaId = (qNamaInsert as any).insertId;

	// Section 2: Penilaian Kepuasan Tendik
	const [sec2Insert] = await db.insert(sections).values({
		surveyId,
		title: "Penilaian Kepuasan Tendik/Pegawai",
		description:
			"Silakan berikan penilaian objektif terkait Harapan/Kepentingan dan Persepsi/Kinerja Anda pada setiap aspek sarana dan pelayanan unit kerja.",
		order: 1,
	});
	const section2Id = (sec2Insert as any).insertId;

	interface BuiltGridQuestion {
		qId: number;
		title: string;
		rowMap: Record<string, number>;
		colMap: Record<string, number>;
	}
	const builtGridQuestions: BuiltGridQuestion[] = [];

	for (let i = 0; i < MATRIX_QUESTIONS.length; i++) {
		const qTitle = MATRIX_QUESTIONS[i];
		const [qInsert] = await db.insert(questions).values({
			surveyId,
			sectionId: section2Id,
			type: "grid",
			title: qTitle,
			required: true,
			order: 2 + i,
			config: { rowsRequired: true },
		});
		const qId = (qInsert as any).insertId;

		const colOptionIdMap: Record<string, number> = {};
		for (let c = 0; c < SCALE_OPTIONS.length; c++) {
			const opt = SCALE_OPTIONS[c];
			const [colInsert] = await db.insert(questionOptions).values({
				questionId: qId,
				group: "column",
				label: opt.label,
				value: opt.value,
				order: c,
			});
			colOptionIdMap[opt.label] = (colInsert as any).insertId;
		}

		const rowOptionIdMap: Record<string, number> = {};
		for (let r = 0; r < MATRIX_ROWS.length; r++) {
			const rLabel = MATRIX_ROWS[r];
			const [rowInsert] = await db.insert(questionOptions).values({
				questionId: qId,
				group: "row",
				label: rLabel,
				order: r,
			});
			rowOptionIdMap[rLabel] = (rowInsert as any).insertId;
		}

		builtGridQuestions.push({
			qId,
			title: qTitle,
			rowMap: rowOptionIdMap,
			colMap: colOptionIdMap,
		});
	}

	console.log(`📥 Seeding ${dataRows.length} responses...`);
	let insertedCount = 0;

	await db.transaction(async (tx) => {
		for (const row of dataRows) {
			const submittedAt = parseTimestamp(row[0]);
			const startedAt = new Date(submittedAt.getTime() - 10 * 60 * 1000);

			const [respInsert] = await tx.insert(responses).values({
				surveyId,
				status: "completed",
				startedAt,
				submittedAt,
			});
			const responseId = (respInsert as any).insertId;

			const answerRecords: any[] = [];
			const emailVal = row[1]?.trim() || "";
			const namaVal = row[2]?.trim() || "";

			answerRecords.push({
				responseId,
				questionId: qEmailId,
				valueText: emailVal || null,
				valueOptionIds: null,
				valueGrid: null,
			});

			answerRecords.push({
				responseId,
				questionId: qNamaId,
				valueText: namaVal || null,
				valueOptionIds: null,
				valueGrid: null,
			});

			for (const gridQ of builtGridQuestions) {
				const valueGrid: Record<string, number> = {};

				for (const rLabel of MATRIX_ROWS) {
					const colIdx = colMap[`${gridQ.title}:::${rLabel}`];
					if (colIdx !== undefined) {
						const cellVal = row[colIdx]?.trim() || "";
						const matched = matchScaleOption(cellVal);
						if (matched) {
							const rowOptId = gridQ.rowMap[rLabel];
							const colOptId = gridQ.colMap[matched.label];
							if (rowOptId && colOptId) {
								valueGrid[String(rowOptId)] = colOptId;
							}
						}
					}
				}

				answerRecords.push({
					responseId,
					questionId: gridQ.qId,
					valueText: null,
					valueOptionIds: null,
					valueGrid: Object.keys(valueGrid).length > 0 ? valueGrid : null,
				});
			}

			await tx.insert(answers).values(answerRecords);
			insertedCount++;
		}
	});

	console.log(`🎉 Successfully seeded ${insertedCount} responses!`);
	console.log(`🔗 Slug: ${SURVEY_SLUG}`);
}

if (import.meta.main) {
	seedKepuasanTendikIso()
		.then(() => {
			console.log("✨ ISO Kepuasan Tendik seeding finished.");
			process.exit(0);
		})
		.catch((err) => {
			console.error("❌ Seeding failed:", err);
			process.exit(1);
		});
}
