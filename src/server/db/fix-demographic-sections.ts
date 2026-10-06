import { eq, inArray, like, or } from "drizzle-orm";
import { db } from "./index.js";
import { questions, sections, surveys } from "./schema.js";

async function main() {
	console.log(
		"Starting script to fix demographic questions section assignments...",
	);

	// Get the Tracer Study survey
	const allSurveys = await db.select().from(surveys);
	const tracerStudy = allSurveys.find((s) =>
		s.title.toLowerCase().includes("tracer"),
	);

	if (!tracerStudy) {
		console.error("Tracer Study survey not found.");
		process.exit(1);
	}

	// Get the sections for Tracer Study
	const surveySections = await db
		.select()
		.from(sections)
		.where(eq(sections.surveyId, tracerStudy.id))
		.orderBy(sections.order);

	const dataDiriSec = surveySections.find((s) => s.order === 0);

	if (!dataDiriSec) {
		console.error("Data Diri section (order 0) not found.");
		process.exit(1);
	}

	// Find demographic questions that are NOT currently in Data Diri section
	const qsToUpdate = await db
		.select()
		.from(questions)
		.where(
			or(
				like(questions.title, "%NIK%"),
				like(questions.title, "%NPWP%"),
				like(questions.title, "%Nomor Hp%"),
				like(questions.title, "%Nomor telepon%"),
				like(questions.title, "%Angkatan Masuk%"),
			),
		);

	const filterForTracer = qsToUpdate.filter(
		(q) => q.surveyId === tracerStudy.id && q.sectionId !== dataDiriSec.id,
	);

	if (filterForTracer.length === 0) {
		console.log(
			"No demographic questions found that need updating. They might already be in Data Diri.",
		);
		process.exit(0);
	}

	console.log(
		`Found ${filterForTracer.length} questions to move to Data Diri section:`,
	);
	for (const q of filterForTracer) {
		console.log(`- ${q.id} | ${q.title} (current section: ${q.sectionId})`);
	}

	const idsToUpdate = filterForTracer.map((q) => q.id);

	// Update their sectionId to Data Diri
	await db
		.update(questions)
		.set({ sectionId: dataDiriSec.id })
		.where(inArray(questions.id, idsToUpdate));

	console.log(
		`Successfully updated ${idsToUpdate.length} questions to Data Diri section (ID: ${dataDiriSec.id}).`,
	);
	process.exit(0);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
