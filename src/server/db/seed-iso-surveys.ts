import { seedKepuasanDosenIso } from "./seed-kepuasan-dosen-iso";
import { seedKepuasanMahasiswaIso } from "./seed-kepuasan-mahasiswa-iso";
import { seedKepuasanMitraIso } from "./seed-kepuasan-mitra-iso";
import { seedKepuasanTendikIso } from "./seed-kepuasan-tendik-iso";

export async function seedAllIsoSurveys() {
	console.log("==================================================");
	console.log("🌟 STARTING SEEDING FOR ALL ISO SURVEYS (FKG UNHAS)");
	console.log("==================================================\n");

	console.log("1️⃣ Seeding Form Kepuasan Dosen (ISO)...");
	await seedKepuasanDosenIso();
	console.log("\n--------------------------------------------------\n");

	console.log("2️⃣ Seeding Form Kepuasan Mahasiswa (ISO)...");
	await seedKepuasanMahasiswaIso();
	console.log("\n--------------------------------------------------\n");

	console.log("3️⃣ Seeding Form Kepuasan Mitra (ISO)...");
	await seedKepuasanMitraIso();
	console.log("\n--------------------------------------------------\n");

	console.log("4️⃣ Seeding Form Kepuasan Tendik (ISO)...");
	await seedKepuasanTendikIso();
	console.log("\n==================================================");
	console.log("🎉 ALL ISO SURVEYS SEEDED SUCCESSFULLY!");
	console.log("==================================================");
}

if (import.meta.main) {
	seedAllIsoSurveys()
		.then(() => {
			process.exit(0);
		})
		.catch((err) => {
			console.error("❌ ISO Seeding failed:", err);
			process.exit(1);
		});
}
