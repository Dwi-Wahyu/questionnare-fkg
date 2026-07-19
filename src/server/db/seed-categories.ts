import { seedSurveyCategories } from "./seedCategories";

async function main() {
	await seedSurveyCategories();
	process.exit(0);
}

main().catch((err) => {
	console.error("❌ Seeding failed:", err);
	process.exit(1);
});
