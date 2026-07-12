import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db } from "./index";
import { users } from "./schema";

async function main() {
	console.log("🚀 Starting database seeding...");

	// 1. Clear tables in FK-safe order
	console.log("🗑️ Clearing existing database tables...");
	await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
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

	console.log("\n==================================================");
	console.log("🎉 DATABASE SEEDING COMPLETED SUCCESSFULLY!");
	console.log("==================================================");
	process.exit(0);
}

main().catch((err) => {
	console.error("❌ Seeding failed:", err);
	process.exit(1);
});
