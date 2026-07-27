import { eq } from "drizzle-orm";
import { db } from "./index";
import {
	questionOptions,
	questions,
	sections,
	surveyCategories,
	surveys,
	users,
} from "./schema";

export async function seedLayananPengaduan() {
	console.log("📝 Seeding Layanan Pengaduan survey...");

	// Ensure category exists
	await db
		.insert(surveyCategories)
		.values({
			slug: "layanan-pengaduan",
			name: "Layanan Pengaduan",
			order: 3,
			requirePeriod: false,
			enableConditional: true,
		})
		.onDuplicateKeyUpdate({
			set: {
				name: "Layanan Pengaduan",
				order: 3,
				requirePeriod: false,
				enableConditional: true,
			},
		});

	// Find admin user
	const [admin] = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.username, "admin"));

	if (!admin) {
		throw new Error("Admin user not found. Please seed users first.");
	}

	const adminId = admin.id;

	// Delete existing survey with slug "layanan-pengaduan"
	await db.delete(surveys).where(eq(surveys.slug, "layanan-pengaduan"));

	// Insert Survey
	const [surveyResult] = await db.insert(surveys).values({
		title:
			"LAPOR !!! Layanan Pengaduan Fakultas Kedokteran Gigi Universitas Hasanuddin",
		slug: "layanan-pengaduan",
		category: "layanan-pengaduan",
		description:
			"Layanan Aspirasi dan Pengaduan Online. Sampaikan Laporan Anda!",
		status: "draft",
		createdBy: adminId,
	});

	const surveyId = (surveyResult as any).insertId;

	// Section 1: Layanan Pengaduan
	const [section1Result] = await db.insert(sections).values({
		surveyId,
		title: "Layanan Pengaduan",
		description: "Sampaikan Laporan Anda!",
		order: 0,
	});
	const section1Id = (section1Result as any).insertId;

	// Q1: Klarifikasi Laporan (Section 1)
	const [q1Result] = await db.insert(questions).values({
		surveyId,
		sectionId: section1Id,
		type: "multiple_choice",
		title: "Klarifikasi Laporan",
		required: true,
		order: 0,
	});
	const q1Id = (q1Result as any).insertId;

	// Opsi untuk Q1
	const q1Options = ["PENGADUAN", "ASPIRASI/ SARAN", "PERMINTAAN INFORMASI"];
	const q1OptionIds: Record<string, number> = {};
	for (let i = 0; i < q1Options.length; i++) {
		const label = q1Options[i];
		const [optResult] = await db.insert(questionOptions).values({
			questionId: q1Id,
			group: "choice",
			label,
			value: label,
			order: i,
		});
		q1OptionIds[label] = (optResult as any).insertId;
	}

	// Q2: Akademik dan Kemahasiswaan (Section 1, conditional to Q1 = PENGADUAN)
	const [q2Result] = await db.insert(questions).values({
		surveyId,
		sectionId: section1Id,
		type: "multiple_choice",
		title: "Akademik dan Kemahasiswaan",
		required: false,
		order: 0,
		conditionalParentQuestionId: q1Id,
		conditionalParentOptionIds: [q1OptionIds["PENGADUAN"]],
	});
	const q2Id = (q2Result as any).insertId;

	const q2Options = [
		"Akademik",
		"Kemahasiswaan",
		"Administrasi Akademik",
		"Layanan Staf/ Tenaga Kependidikan",
		"Kesejahteraan Mahasiswa",
		"Perpustakaan",
	];
	for (let i = 0; i < q2Options.length; i++) {
		const label = q2Options[i];
		await db.insert(questionOptions).values({
			questionId: q2Id,
			group: "choice",
			label,
			value: label,
			order: i,
		});
	}

	// Q3: Sarana dan Prasarana (Section 1, conditional to Q1 = PENGADUAN)
	const [q3Result] = await db.insert(questions).values({
		surveyId,
		sectionId: section1Id,
		type: "multiple_choice",
		title: "Sarana dan Prasarana",
		required: false,
		order: 1,
		conditionalParentQuestionId: q1Id,
		conditionalParentOptionIds: [q1OptionIds["PENGADUAN"]],
	});
	const q3Id = (q3Result as any).insertId;

	const q3Options = [
		"Ruang Kuliah",
		"Toilet",
		"Layanan Psikologi",
		"Laporan Tindak Kekerasan (Fisik Seksual dan Verbal)",
	];
	for (let i = 0; i < q3Options.length; i++) {
		const label = q3Options[i];
		await db.insert(questionOptions).values({
			questionId: q3Id,
			group: "choice",
			label,
			value: label,
			order: i,
		});
	}

	// Q4: Uraian Laporan (Section 1, conditional to Q1 = ASPIRASI/ SARAN or PERMINTAAN INFORMASI)
	// TODO: Q2 & Q3 required: false, check if at least one is filled in custom validation if requested.
	await db.insert(questions).values({
		surveyId,
		sectionId: section1Id,
		type: "paragraph",
		title: "Uraian Laporan",
		required: true,
		order: 2,
		conditionalParentQuestionId: q1Id,
		conditionalParentOptionIds: [
			q1OptionIds["ASPIRASI/ SARAN"],
			q1OptionIds["PERMINTAAN INFORMASI"],
		],
	});

	console.log("✅ Layanan Pengaduan survey seeded successfully.");
}
