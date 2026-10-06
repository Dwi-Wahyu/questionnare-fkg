import { db } from "./index";
import { surveyCategories } from "./schema";

export const CATEGORY_SEED_DATA = [
	{
		slug: "survey-kepuasan",
		name: "Survey Kepuasan",
		order: 0,
		requirePeriod: true,
		enableConditional: false,
	},
	{
		slug: "tracer-study",
		name: "Tracer Study",
		order: 1,
		requirePeriod: true,
		enableConditional: false,
	},
	{
		slug: "survey-pengguna",
		name: "Survey Pengguna",
		order: 2,
		requirePeriod: true,
		enableConditional: false,
	},
	{
		slug: "layanan-pengaduan",
		name: "Layanan Pengaduan",
		order: 3,
		requirePeriod: false,
		enableConditional: true,
	},
	{
		slug: "iso",
		name: "ISO",
		order: 4,
		requirePeriod: false,
		enableConditional: true,
	},
] as const;

export async function seedSurveyCategories() {
	console.log("📚 Seeding survey categories...");
	for (const cat of CATEGORY_SEED_DATA) {
		await db
			.insert(surveyCategories)
			.values(cat)
			.onDuplicateKeyUpdate({
				set: {
					name: cat.name,
					order: cat.order,
					requirePeriod: cat.requirePeriod,
					enableConditional: cat.enableConditional,
				},
			});
	}
	console.log(`✅ ${CATEGORY_SEED_DATA.length} survey categories seeded.`);
}
