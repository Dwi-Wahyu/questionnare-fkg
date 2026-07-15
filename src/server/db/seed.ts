import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
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

// Simple CSV parser that handles quotes and escaped quotes
function parseCSVLine(line: string): string[] {
	const result: string[] = [];
	let current = "";
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		if (char === '"') {
			if (inQuotes && line[i + 1] === '"') {
				current += '"';
				i++; // skip next quote
			} else {
				inQuotes = !inQuotes;
			}
		} else if (char === "," && !inQuotes) {
			result.push(current.trim());
			current = "";
		} else {
			current += char;
		}
	}
	result.push(current.trim());
	return result;
}

// Define demographic keywords to identify Data Diri questions
const demographicKeywords = [
	"nama",
	"email",
	"nim",
	"whatsapp",
	"telp",
	"no hp",
	"alamat",
	"program studi",
	"dosen program studi",
	"tahun masuk",
	"lulus tahun",
	"usia",
	"pekerjaan",
	"lama pekerjaan",
	"jabatan",
	"instansi",
	"alamat kantor",
	"score",
	"no telp",
];

function isDemographic(header: string): boolean {
	const h = header.toLowerCase();
	return demographicKeywords.some((k) => h.includes(k));
}

// Standard options sets
const satisfactionOptions = ["Sangat Baik", "Baik", "Cukup", "Kurang"];
const satisfactionPuasOptions = [
	"Sangat Puas",
	"Puas",
	"Cukup Puas",
	"Kurang Puas",
	"Tidak Puas",
];
const relevanceOptions = [
	"Sangat relevan",
	"Relevan",
	"Kurang Relevan",
	"Tidak Relevan",
];

// Keywords that identify a "statement" / Likert-style question — e.g.
// "Keandalan dan kemampuan dosen dalam memberikan pelayanan terhadap mahasiswa".
//
// IMPORTANT: these questions are individual "Pilihan Ganda (Radios)" questions
// in the real Google Form (confirmed against the live Drive form), NOT one
// combined "Kisi Pilihan Ganda (Matrix)" question. The CSV export just happens
// to put one column per statement — that's a Google Forms export artifact,
// not evidence the source question was a grid. Do not re-introduce
// column-grouping/matrix logic here; always emit one multiple_choice question
// per matched column (see the `isStatement` branch below).
const statementKeywords = [
	"keandalan",
	"daya tanggap",
	"kepastian",
	"kepedulian",
	"kecukupan",
	"aksesibilitas",
	"kualitas sarana",
	"prosedur pelayanan",
	"kesigapan",
	"kebersihan",
	"kemampuan petugas",
	"tanggapan petugas",
	"kejelasan prosedur",
	"kesopanan",
	"dukungan institusi",
	"sarana dan prasarana",
	"kemampuan dan ketepatan",
	"kenyamanan dosen",
	"ketepatan pertemuan",
	"pelaksanaan kuliah",
	"integritas",
	"keahlian berdasarkan",
	"bahasa inggris",
	"penggunaan teknologi",
	"komunikasi",
	"kerjasama tim",
	"pengembangan diri",
	"kesiapan untuk berpartisipasi",
	"keselamatan pasien",
];

function isStatementHeader(header: string): boolean {
	const h = header.toLowerCase();
	return statementKeywords.some((k) => h.includes(k));
}

// A statement column's title sometimes carries a trailing comma/period that
// only exists because of how the original sheet quoted the CSV cell (e.g.
// `"Kecukupan,"`, `"Aksesibilitas,"`). Strip that so the seeded question
// title reads naturally.
function cleanStatementTitle(header: string): string {
	return header.replace(/[,.]+\s*$/, "").trim();
}

interface SurveyConfig {
	asliFile: string;
	slug: string;
	title: string;
	category: string;
}

const surveysToSeed: SurveyConfig[] = [
	{
		asliFile: "form kepuasan dosen fkg (Responses).csv",
		slug: "kepuasan-dosen",
		title: "Form Kepuasan Dosen FKG",
		category: "kepuasan_dosen",
	},
	{
		asliFile: "Form Kepuasan Pegawai (Responses).csv",
		slug: "kepuasan-pegawai",
		title: "Form Kepuasan Pegawai",
		category: "kepuasan_pegawai",
	},
	{
		asliFile:
			"Kuesioner Mahasiswa terhadap Pengelola FKG - UNHAS (Responses).csv",
		slug: "kepuasan-pengelola",
		title: "Kuesioner Mahasiswa terhadap Pengelola FKG - UNHAS",
		category: "kepuasan_pengelola",
	},
	{
		asliFile: "Kuisioner Pengguna (Responses).csv",
		slug: "kepuasan-pengguna-lulusan",
		title: "Kuisioner Pengguna Lulusan",
		category: "kepuasan_pengguna_lulusan",
	},
	{
		asliFile: "Copy of Kuisioner Pengguna (Responses).csv",
		slug: "kepuasan-pengguna-lulusan-copy",
		title: "Kuisioner Pengguna Lulusan (Salinan)",
		category: "kepuasan_pengguna_lulusan",
	},
	{
		asliFile: "Form Kepuasan Mahasiswa (Responses).csv",
		slug: "kepuasan-mahasiswa",
		title: "Form Kepuasan Mahasiswa",
		category: "kepuasan_mahasiswa",
	},
	{
		asliFile: "Form Kepuasan Mahasiswa 2025 (Responses).csv",
		slug: "kepuasan-mahasiswa-2025",
		title: "Form Kepuasan Mahasiswa 2025",
		category: "kepuasan_mahasiswa",
	},
	{
		asliFile: "Form Kepuasan Mahasiswa Rev (Responses).csv",
		slug: "kepuasan-mahasiswa-rev",
		title: "Form Kepuasan Mahasiswa Rev",
		category: "kepuasan_mahasiswa",
	},
	{
		asliFile: "Kusioner Alumni (Responses).csv",
		slug: "tracer-alumni",
		title: "Tracer Study Alumni",
		category: "tracer_alumni",
	},
];

async function main() {
	console.log("🚀 Starting database seeding...");

	// 1. Clear tables in FK-safe order
	console.log("🗑️ Clearing existing database tables...");
	await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
	await db.delete(answers);
	await db.delete(responses);
	await db.delete(questionOptions);
	await db.delete(questions);
	await db.delete(sections);
	await db.delete(surveys);
	await db.delete(users);
	await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
	console.log("✅ Existing tables cleared.");

	// 2. Insert Users
	console.log("👤 Seeding admin and visitor users...");
	const adminHash = await bcrypt.hash(process.env.ADMIN_PASSWORD as string, 10);
	const visitorHash = await bcrypt.hash("visitor123" as string, 10);

	await db.insert(users).values([
		{
			username: "admin",
			passwordHash: adminHash,
			role: "admin",
			name: "Admin FKG Unhas",
			email: "admin@unhas.ac.id",
		},
		{
			username: "visitor",
			passwordHash: visitorHash,
			role: "visitor",
			name: "Dekan FKG Unhas",
			email: "dekan@unhas.ac.id",
		},
	]);

	const [admin] = await db
		.select({ id: users.id })
		.from(users)
		.where(sql`username = 'admin'`);

	const adminId = admin.id;
	console.log(`✅ Users seeded. Admin ID = ${adminId}`);

	// Paths
	const rootDir = process.cwd();
	const asliDir = resolve(rootDir, "../data-asli");

	// 3. Process each survey
	for (const sDef of surveysToSeed) {
		console.log(`\n--------------------------------------------------`);
		console.log(`Processing survey: ${sDef.title}`);
		console.log(`--------------------------------------------------`);

		// A. Parse Asli data to find all unique options per column
		const asliPath = join(asliDir, sDef.asliFile);
		const asliContent = readFileSync(asliPath, "utf-8");
		const asliLines = asliContent.split(/\r?\n/).map((l) => l.trim());

		let headerIdx = -1;
		for (let i = 0; i < asliLines.length; i++) {
			if (asliLines[i].toLowerCase().includes("timestamp")) {
				headerIdx = i;
				break;
			}
		}

		if (headerIdx === -1) {
			console.error(
				`❌ Header 'Timestamp' not found in asli file: ${sDef.asliFile}`,
			);
			continue;
		}

		const headers = parseCSVLine(asliLines[headerIdx]);
		const asliRows: string[][] = [];
		for (let i = headerIdx + 1; i < asliLines.length; i++) {
			if (asliLines[i] === "" || asliLines[i].replace(/,/g, "") === "")
				continue;
			asliRows.push(parseCSVLine(asliLines[i]));
		}

		const colUniqueVals = headers.map((_, colIdx) => {
			const unique = new Set<string>();
			asliRows.forEach((r) => {
				if (r[colIdx]) unique.add(r[colIdx].trim());
			});
			return Array.from(unique).filter((v) => v !== "");
		});

		if (asliRows.length === 0) {
			console.error(`❌ No data rows found in asli file: ${sDef.asliFile}`);
			continue;
		}

		// C. Create Survey Row
		const [surveyInsert] = await db.insert(surveys).values({
			slug: sDef.slug,
			title: sDef.title,
			description: `Evaluasi dan analisis komprehensif untuk ${sDef.title}.`,
			category: sDef.category,
			status: "published",
			createdBy: adminId,
		});
		const surveyId = (surveyInsert as any).insertId;

		// D. Create Sections
		const [secInsert1] = await db.insert(sections).values({
			surveyId,
			title: "Data Diri",
			description:
				"Lengkapi data identitas Anda sebelum mengisi kuesioner utama.",
			order: 0,
		});
		const dataDiriSecId = (secInsert1 as any).insertId;

		const [secInsert2] = await db.insert(sections).values({
			surveyId,
			title: "Kuesioner Utama",
			description:
				"Silakan berikan penilaian objektif Anda pada bagian berikut.",
			order: 1,
		});
		const utamaSecId = (secInsert2 as any).insertId;

		// E. Derive Questions & Options
		let colIdx = 1; // start after Timestamp
		const questionsList: any[] = [];
		let qOrder = 0;

		while (colIdx < headers.length) {
			const header = headers[colIdx];
			if (
				!header ||
				header.toLowerCase() === "score" ||
				header.toLowerCase() === "timestamp"
			) {
				colIdx++;
				continue;
			}

			const currentUnique = colUniqueVals[colIdx];
			const isDemo = isDemographic(header);
			const isStatement = isStatementHeader(header);

			if (isStatement) {
				// This is a single Likert-style statement (e.g. "Keandalan dan
				// kemampuan dosen dalam memberikan pelayanan terhadap mahasiswa").
				// It is seeded as its own "Pilihan Ganda (Radios)" question
				// (type: "multiple_choice"), matching how it actually appears in
				// the source Google Form — never grouped into a "grid" question,
				// and never adjacent columns merged into rows of one matrix.
				//
				// The option set is always the full canonical 4/5-point scale
				// (e.g. "Sangat Baik" → "Kurang"), not just whatever subset of
				// values happens to appear in the sampled responses — otherwise a
				// statement where nobody happened to answer "Kurang" would end up
				// missing that option entirely.
				let statementOptions = satisfactionOptions;
				if (
					header.toLowerCase().includes("puas") ||
					currentUnique.some((v) =>
						satisfactionPuasOptions.some(
							(o) => o.toLowerCase() === v.toLowerCase(),
						),
					)
				) {
					statementOptions = satisfactionPuasOptions;
				} else if (
					header.toLowerCase().includes("relevan") ||
					currentUnique.some((v) =>
						relevanceOptions.some((o) => o.toLowerCase() === v.toLowerCase()),
					)
				) {
					statementOptions = relevanceOptions;
				}

				const title = cleanStatementTitle(header);

				const [qInsert] = await db.insert(questions).values({
					surveyId,
					sectionId: utamaSecId,
					type: "multiple_choice",
					title,
					required: true,
					order: qOrder++,
				});
				const questionId = (qInsert as any).insertId;

				const optionIdMap: Record<string, number> = {};
				for (let oIdx = 0; oIdx < statementOptions.length; oIdx++) {
					const label = statementOptions[oIdx];
					const [oInsert] = await db.insert(questionOptions).values({
						questionId,
						group: "choice",
						label,
						value: label,
						order: oIdx,
					});
					optionIdMap[label] = (oInsert as any).insertId;
				}

				questionsList.push({
					id: questionId,
					type: "multiple_choice",
					title,
					colIdx,
					optionIdMap,
					optionsList: statementOptions,
				});

				colIdx++;
				continue;
			}

			// Handle remaining questions (short_text, paragraph, dropdown, multiple_choice)
			const sectionId = isDemo ? dataDiriSecId : utamaSecId;

			let type: "short_text" | "paragraph" | "dropdown" | "multiple_choice" =
				"short_text";
			let optionsList: string[] = [];

			if (currentUnique.length >= 2 && currentUnique.length <= 10) {
				type = currentUnique.length <= 5 ? "multiple_choice" : "dropdown";
				optionsList = currentUnique;
			} else {
				// Text or paragraph based on length
				let totalLen = 0;
				let cnt = 0;
				asliRows.forEach((r) => {
					if (r[colIdx]) {
						totalLen += r[colIdx].length;
						cnt++;
					}
				});
				const avgLen = cnt > 0 ? totalLen / cnt : 0;
				type = avgLen > 50 ? "paragraph" : "short_text";
			}

			// Special handling for program studi / role columns to be dropdowns if options exist
			if (
				header.toLowerCase().includes("program studi") &&
				currentUnique.length > 0
			) {
				type = "dropdown";
				optionsList = currentUnique;
			}

			const [qInsert] = await db.insert(questions).values({
				surveyId,
				sectionId,
				type,
				title: header,
				required: isDemo && header.toLowerCase().includes("nama"),
				order: qOrder++,
			});
			const questionId = (qInsert as any).insertId;

			const optionIdMap: Record<string, number> = {};
			if (optionsList.length > 0) {
				for (let oIdx = 0; oIdx < optionsList.length; oIdx++) {
					const label = optionsList[oIdx];
					const [oInsert] = await db.insert(questionOptions).values({
						questionId,
						group: "choice",
						label,
						value: label,
						order: oIdx,
					});
					optionIdMap[label] = (oInsert as any).insertId;
				}
			}

			questionsList.push({
				id: questionId,
				type,
				title: header,
				colIdx,
				optionIdMap,
				optionsList,
			});

			colIdx++;
		}

		console.log(
			`⚙️ Created ${questionsList.length} logical questions for ${sDef.title}`,
		);

		// F. Helper to convert real cell value to database format
		//
		// Note: this generator no longer produces `type: "grid"` questions (see
		// `isStatement` above — statement columns are always individual
		// multiple_choice questions now). The grid branch below is kept only for
		// schema/type compatibility in case a question of that type is added by
		// other means (e.g. manually in the admin UI).
		const formatAnswer = (q: any, rowValues: string[]) => {
			if (q.type === "grid") {
				const valueGrid: Record<string, number> = {};
				q.colIndices.forEach((cIdx: number, idx: number) => {
					const rowLabel = q.gridRows[idx];
					const cellVal = rowValues[cIdx]?.trim() || "";

					const rowOptId = q.rowOptionIdMap[rowLabel];

					// Try to match the exact cellVal in columns. If empty or no match, default to second column ("Baik")
					let matchedColLabel = q.gridOptions.find(
						(o: string) => o.toLowerCase() === cellVal.toLowerCase(),
					);
					if (!matchedColLabel) {
						// fallback
						matchedColLabel = q.gridOptions[1] || q.gridOptions[0];
					}
					const colOptId = q.colOptionIdMap[matchedColLabel];
					if (rowOptId && colOptId) {
						valueGrid[String(rowOptId)] = colOptId;
					}
				});

				return {
					questionId: q.id,
					valueText: null,
					valueOptionIds: null,
					valueGrid,
				};
			} else {
				const cellVal = rowValues[q.colIdx]?.trim() || "";
				// A handful of real rows have punctuation-only artifacts left over
				// from the sheet (e.g. a lone "."), which isn't a real answer.
				const isJunkCell = cellVal !== "" && /^[.\-–—\s]*$/.test(cellVal);
				if (q.optionsList && q.optionsList.length > 0) {
					// Choice/dropdown
					let matchedOptLabel = q.optionsList.find(
						(o: string) => o.toLowerCase() === cellVal.toLowerCase(),
					);
					if (!matchedOptLabel && cellVal !== "" && !isJunkCell) {
						// Custom/free-text option not in the known list — fall back to
						// the first option rather than dropping the answer entirely.
						matchedOptLabel = q.optionsList[0];
					}
					const optId = matchedOptLabel ? q.optionIdMap[matchedOptLabel] : null;
					return {
						questionId: q.id,
						valueText: cellVal !== "" && !isJunkCell ? cellVal : null,
						valueOptionIds: optId ? [optId] : null,
						valueGrid: null,
					};
				} else {
					// Text/paragraph
					return {
						questionId: q.id,
						valueText: cellVal !== "" ? cellVal : null,
						valueOptionIds: null,
						valueGrid: null,
					};
				}
			}
		};

		// G. Insert EVERY real row from the data-asli CSV as an actual response.
		// No synthetic/Faker filler — this is the full authentic dataset.
		let insertedCount = 0;

		await db.transaction(async (tx) => {
			for (const row of asliRows) {
				let realTimestamp = new Date();
				const tsStr = row[0]?.trim();
				if (tsStr) {
					const parsed = new Date(tsStr);
					if (!Number.isNaN(parsed.getTime())) {
						realTimestamp = parsed;
					}
				}

				const [respInsert] = await tx.insert(responses).values({
					surveyId,
					status: "completed",
					startedAt: new Date(realTimestamp.getTime() - 10 * 60 * 1000), // 10 mins before
					submittedAt: realTimestamp,
					clientDraftId: faker.string.uuid(),
				});
				const responseId = (respInsert as any).insertId;

				const answerRows = questionsList.map((q) => ({
					responseId,
					...formatAnswer(q, row),
				}));

				if (answerRows.length > 0) {
					await tx.insert(answers).values(answerRows);
				}
				insertedCount++;
			}
		});

		console.log(
			`📥 Seeded ${insertedCount} real responses for ${sDef.title} (from ${sDef.asliFile})`,
		);
	}

	console.log("\n==================================================");
	console.log("🎉 DATABASE SEEDING COMPLETED SUCCESSFULLY!");
	console.log("==================================================");
	process.exit(0);
}

main().catch((err) => {
	console.error("❌ Seeding failed:", err);
	process.exit(1);
});
