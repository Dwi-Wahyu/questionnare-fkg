import { seedLayananPengaduan } from "./seedLayananPengaduan";

async function main() {
	await seedLayananPengaduan();
	process.exit(0);
}

main().catch((err) => {
	console.error("❌ Seeding failed:", err);
	process.exit(1);
});
