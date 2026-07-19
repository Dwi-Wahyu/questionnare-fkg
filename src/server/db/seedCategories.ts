import { db } from "./index";
import { surveyCategories } from "./schema";

export const CATEGORY_SEED_DATA = [
	{ slug: "survey-kepuasan", name: "Survey Kepuasan", order: 0 },
	{ slug: "tracer-study", name: "Tracer Study", order: 1 },
	{ slug: "survey-pengguna", name: "Survey Pengguna", order: 2 },
] as const;

export async function seedSurveyCategories() {
	console.log("📚 Seeding survey categories...");
	for (const cat of CATEGORY_SEED_DATA) {
		await db
			.insert(surveyCategories)
			.values(cat)
			.onDuplicateKeyUpdate({ set: { name: cat.name, order: cat.order } });
	}
	console.log(`✅ ${CATEGORY_SEED_DATA.length} survey categories seeded.`);
}
