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

// Keywords for grid rows
const gridRowKeywords = [
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

function isGridRowHeader(header: string): boolean {
	const h = header.toLowerCase();
	return gridRowKeywords.some((k) => h.includes(k));
}

interface SurveyConfig {
	cleanedFile: string;
	asliFile: string;
	slug: string;
	title: string;
	category: string;
}

const surveysToSeed: SurveyConfig[] = [
	{
		cleanedFile: "form kepuasan dosen fkg (Responses).csv",
		asliFile: "form kepuasan dosen fkg (Responses).csv",
		slug: "kepuasan-dosen",
		title: "Form Kepuasan Dosen FKG",
		category: "kepuasan_dosen",
	},
	{
		cleanedFile: "Form Kepuasan Pegawai (Responses).csv",
		asliFile: "Form Kepuasan Pegawai (Responses).csv",
		slug: "kepuasan-pegawai",
		title: "Form Kepuasan Pegawai",
		category: "kepuasan_pegawai",
	},
	{
		cleanedFile:
			"Kuesioner Mahasiswa terhadap Pengelola FKG - UNHAS (Responses).csv",
		asliFile:
			"Kuesioner Mahasiswa terhadap Pengelola FKG - UNHAS (Responses).csv",
		slug: "kepuasan-pengelola",
		title: "Kuesioner Mahasiswa terhadap Pengelola FKG - UNHAS",
		category: "kepuasan_pengelola",
	},
	{
		cleanedFile: "Kuisioner Pengguna (Responses).csv",
		asliFile: "Kuisioner Pengguna (Responses).csv",
		slug: "kepuasan-pengguna-lulusan",
		title: "Kuisioner Pengguna Lulusan",
		category: "kepuasan_pengguna_lulusan",
	},
	{
		cleanedFile: "Copy of Kuisioner Pengguna (Responses).csv",
		asliFile: "Copy of Kuisioner Pengguna (Responses).csv",
		slug: "kepuasan-pengguna-lulusan-copy",
		title: "Kuisioner Pengguna Lulusan (Salinan)",
		category: "kepuasan_pengguna_lulusan",
	},
	{
		cleanedFile: "Form Kepuasan Mahasiswa (Responses).csv",
		asliFile: "Form Kepuasan Mahasiswa (Responses).csv",
		slug: "kepuasan-mahasiswa",
		title: "Form Kepuasan Mahasiswa",
		category: "kepuasan_mahasiswa",
	},
	{
		cleanedFile: "Form Kepuasan Mahasiswa 2025 (Responses).csv",
		asliFile: "Form Kepuasan Mahasiswa 2025 (Responses).csv",
		slug: "kepuasan-mahasiswa-2025",
		title: "Form Kepuasan Mahasiswa 2025",
		category: "kepuasan_mahasiswa",
	},
	{
		cleanedFile: "Form Kepuasan Mahasiswa Rev (Responses).csv",
		asliFile: "Form Kepuasan Mahasiswa Rev (Responses).csv",
		slug: "kepuasan-mahasiswa-rev",
		title: "Form Kepuasan Mahasiswa Rev",
		category: "kepuasan_mahasiswa",
	},
	{
		cleanedFile: "Kusioner Alumni (Responses).csv",
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
	const adminHash = await bcrypt.hash("_Admin123_", 10);
	const visitorHash = await bcrypt.hash("visitor123", 10);

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
	const cleanedDir = resolve(rootDir, "../cleaned");
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

		// B. Parse Cleaned data to get the 1 real response row
		const cleanedPath = join(cleanedDir, sDef.cleanedFile);
		const cleanedContent = readFileSync(cleanedPath, "utf-8");
		const cleanedLines = cleanedContent
			.split(/\r?\n/)
			.map((l) => l.trim())
			.filter((l) => l !== "");

		if (cleanedLines.length < 2) {
			console.error(
				`❌ Cleaned file has less than 2 lines: ${sDef.cleanedFile}`,
			);
			continue;
		}

		// Find header in cleaned
		let cleanedHeaderIdx = -1;
		for (let i = 0; i < cleanedLines.length; i++) {
			if (cleanedLines[i].toLowerCase().includes("timestamp")) {
				cleanedHeaderIdx = i;
				break;
			}
		}

		if (cleanedHeaderIdx === -1) {
			console.error(
				`❌ Header 'Timestamp' not found in cleaned file: ${sDef.cleanedFile}`,
			);
			continue;
		}

		const cleanedRow = parseCSVLine(cleanedLines[cleanedHeaderIdx + 1]);

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
			const isGrid = isGridRowHeader(header);

			if (isGrid) {
				// We have a grid question row. Let's determine the option set.
				let gridOptions = satisfactionOptions;
				if (
					header.toLowerCase().includes("puas") ||
					currentUnique.some((v) =>
						satisfactionPuasOptions.some(
							(o) => o.toLowerCase() === v.toLowerCase(),
						),
					)
				) {
					gridOptions = satisfactionPuasOptions;
				} else if (
					header.toLowerCase().includes("relevan") ||
					currentUnique.some((v) =>
						relevanceOptions.some((o) => o.toLowerCase() === v.toLowerCase()),
					)
				) {
					gridOptions = relevanceOptions;
				}

				// Find consecutive columns that are also grid rows of the same category
				const gridRows = [header];
				const gridColIndices = [colIdx];
				let lookahead = colIdx + 1;

				while (lookahead < headers.length) {
					const nextHeader = headers[lookahead];
					if (!nextHeader) break;
					const nextIsGrid = isGridRowHeader(nextHeader);
					if (!nextIsGrid) break;

					let nextOptions = satisfactionOptions;
					const nextUnique = colUniqueVals[lookahead];
					if (
						nextHeader.toLowerCase().includes("puas") ||
						nextUnique.some((v) =>
							satisfactionPuasOptions.some(
								(o) => o.toLowerCase() === v.toLowerCase(),
							),
						)
					) {
						nextOptions = satisfactionPuasOptions;
					} else if (
						nextHeader.toLowerCase().includes("relevan") ||
						nextUnique.some((v) =>
							relevanceOptions.some((o) => o.toLowerCase() === v.toLowerCase()),
						)
					) {
						nextOptions = relevanceOptions;
					}

					// Verify they share the same option set type
					if (JSON.stringify(gridOptions) === JSON.stringify(nextOptions)) {
						gridRows.push(nextHeader);
						gridColIndices.push(lookahead);
						lookahead++;
					} else {
						break;
					}
				}

				// Create the GRID question
				const [qInsert] = await db.insert(questions).values({
					surveyId,
					sectionId: utamaSecId,
					type: "grid",
					title: `Evaluasi ${gridOptions === satisfactionOptions ? "Layanan dan Kinerja" : gridOptions === satisfactionPuasOptions ? "Kepuasan" : "Relevansi"}`,
					required: true,
					order: qOrder++,
				});
				const questionId = (qInsert as any).insertId;

				// Insert row options
				const rowOptionIdMap: Record<string, number> = {};
				for (let rIdx = 0; rIdx < gridRows.length; rIdx++) {
					const rowLabel = gridRows[rIdx];
					const [oInsert] = await db.insert(questionOptions).values({
						questionId,
						group: "row",
						label: rowLabel,
						value: rowLabel,
						order: rIdx,
					});
					rowOptionIdMap[rowLabel] = (oInsert as any).insertId;
				}

				// Insert column options
				const colOptionIdMap: Record<string, number> = {};
				for (let cIdx = 0; cIdx < gridOptions.length; cIdx++) {
					const colLabel = gridOptions[cIdx];
					const [oInsert] = await db.insert(questionOptions).values({
						questionId,
						group: "column",
						label: colLabel,
						value: colLabel,
						order: cIdx,
					});
					colOptionIdMap[colLabel] = (oInsert as any).insertId;
				}

				questionsList.push({
					id: questionId,
					type: "grid",
					title: `Evaluasi ${gridOptions === satisfactionOptions ? "Layanan dan Kinerja" : gridOptions === satisfactionPuasOptions ? "Kepuasan" : "Relevansi"}`,
					colIndices: gridColIndices,
					rowOptionIdMap,
					colOptionIdMap,
					gridOptions,
					gridRows,
				});

				colIdx = lookahead;
				continue;
			}

			// Handle non-grid questions (short_text, paragraph, dropdown, multiple_choice)
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
				if (q.optionsList && q.optionsList.length > 0) {
					// Choice/dropdown
					let matchedOptLabel = q.optionsList.find(
						(o: string) => o.toLowerCase() === cellVal.toLowerCase(),
					);
					if (!matchedOptLabel && cellVal !== "") {
						// custom option or other
						matchedOptLabel = q.optionsList[0];
					}
					const optId = matchedOptLabel ? q.optionIdMap[matchedOptLabel] : null;
					return {
						questionId: q.id,
						valueText: cellVal !== "" ? cellVal : null,
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

		// G. Insert the 1 Real Response row from cleaned CSV
		let realTimestamp = new Date();
		const tsStr = cleanedRow[0]?.trim();
		if (tsStr) {
			const parsed = new Date(tsStr);
			if (!Number.isNaN(parsed.getTime())) {
				realTimestamp = parsed;
			}
		}

		const [respInsert] = await db.insert(responses).values({
			surveyId,
			status: "completed",
			startedAt: new Date(realTimestamp.getTime() - 10 * 60 * 1000), // 10 mins before
			submittedAt: realTimestamp,
			clientDraftId: faker.string.uuid(),
		});
		const realResponseId = (respInsert as any).insertId;

		const realAnswerRows = questionsList.map((q) => ({
			responseId: realResponseId,
			...formatAnswer(q, cleanedRow),
		}));

		await db.insert(answers).values(realAnswerRows);
		console.log(`📥 Seeded 1 real response with ID = ${realResponseId}`);

		// H. Generate 20-60 Synthetic Responses
		const numSynthetic = faker.number.int({ min: 25, max: 45 });
		console.log(`🎲 Generating ${numSynthetic} synthetic responses...`);

		// Since we need responseId for the answer mapping, let's run them in a transaction:
		await db.transaction(async (tx) => {
			for (let rIdx = 0; rIdx < numSynthetic; rIdx++) {
				const isCompleted = rIdx < numSynthetic - 3;
				const startedAt = faker.date.past({ years: 1 });
				const submittedAt = isCompleted
					? new Date(
							startedAt.getTime() +
								faker.number.int({ min: 2, max: 20 }) * 60 * 1000,
						)
					: null;
				const status = isCompleted ? "completed" : "started";

				const [rInsert] = await tx.insert(responses).values({
					surveyId,
					status,
					startedAt,
					submittedAt,
					clientDraftId: faker.string.uuid(),
				});
				const syntheticResponseId = (rInsert as any).insertId;

				const syntheticAnswers = [];

				for (const q of questionsList) {
					if (q.type === "grid") {
						const valueGrid: Record<string, number> = {};
						q.gridRows.forEach((rowLabel: string) => {
							const rowOptId = q.rowOptionIdMap[rowLabel];

							// Weights for choices: 60% Sangat Baik/Baik, 30% Cukup, 10% Kurang
							const roll = Math.random();
							let selectedColLabel = q.gridOptions[1]; // default to Baik

							if (q.gridOptions === satisfactionOptions) {
								if (roll < 0.25) selectedColLabel = "Sangat Baik";
								else if (roll < 0.6) selectedColLabel = "Baik";
								else if (roll < 0.9) selectedColLabel = "Cukup";
								else selectedColLabel = "Kurang";
							} else if (q.gridOptions === satisfactionPuasOptions) {
								if (roll < 0.25) selectedColLabel = "Sangat Puas";
								else if (roll < 0.6) selectedColLabel = "Puas";
								else if (roll < 0.85) selectedColLabel = "Cukup Puas";
								else if (roll < 0.95) selectedColLabel = "Kurang Puas";
								else selectedColLabel = "Tidak Puas";
							} else if (q.gridOptions === relevanceOptions) {
								if (roll < 0.35) selectedColLabel = "Sangat relevan";
								else if (roll < 0.7) selectedColLabel = "Relevan";
								else if (roll < 0.9) selectedColLabel = "Kurang Relevan";
								else selectedColLabel = "Tidak Relevan";
							}

							const colOptId = q.colOptionIdMap[selectedColLabel];
							if (rowOptId && colOptId) {
								valueGrid[String(rowOptId)] = colOptId;
							}
						});

						syntheticAnswers.push({
							responseId: syntheticResponseId,
							questionId: q.id,
							valueText: null,
							valueOptionIds: null,
							valueGrid,
						});
					} else {
						// Non-grid question
						const headerLower = q.title.toLowerCase();
						let valueText: string | null = null;
						let valueOptionIds: number[] | null = null;

						if (q.optionsList && q.optionsList.length > 0) {
							// Multiple choice or dropdown
							// Pick random option
							const roll = Math.random();
							let optLabel = q.optionsList[0];

							if (
								headerLower.includes("relevan") ||
								headerLower.includes("puas")
							) {
								// Apply weighted logic if satisfaction-like
								const optLen = q.optionsList.length;
								const idx = Math.floor(roll * roll * optLen); // skewed toward index 0/positive
								optLabel = q.optionsList[idx] || q.optionsList[0];
							} else {
								optLabel = faker.helpers.arrayElement(q.optionsList);
							}

							const optId = q.optionIdMap[optLabel];
							valueOptionIds = optId ? [optId] : null;
						} else {
							// Text or paragraph free-form
							if (headerLower.includes("nama")) {
								valueText = faker.person.fullName();
							} else if (headerLower.includes("email")) {
								valueText = faker.internet.email();
							} else if (headerLower.includes("nim")) {
								valueText = `J0112${faker.string.numeric(5)}`;
							} else if (
								headerLower.includes("telp") ||
								headerLower.includes("whatsapp") ||
								headerLower.includes("hp")
							) {
								valueText = `08${faker.string.numeric({ length: 10, allowLeadingZeros: false })}`;
							} else if (headerLower.includes("alamat")) {
								valueText =
									faker.location.streetAddress() + ", " + faker.location.city();
							} else if (
								headerLower.includes("tahun masuk") ||
								headerLower.includes("lulus")
							) {
								valueText = String(faker.number.int({ min: 2015, max: 2024 }));
							} else if (q.type === "paragraph") {
								valueText = faker.lorem.paragraph();
							} else {
								valueText = faker.lorem.sentence({ min: 3, max: 7 });
							}
						}

						syntheticAnswers.push({
							responseId: syntheticResponseId,
							questionId: q.id,
							valueText,
							valueOptionIds,
							valueGrid: null,
						});
					}
				}

				if (syntheticAnswers.length > 0) {
					await tx.insert(answers).values(syntheticAnswers);
				}
			}
		});

		console.log(
			`✅ Seeded ${numSynthetic} synthetic responses for ${sDef.title}`,
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
