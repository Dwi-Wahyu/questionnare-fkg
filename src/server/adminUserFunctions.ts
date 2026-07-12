import { createServerFn } from "@tanstack/react-start";
import bcrypt from "bcryptjs";
import { and, desc, eq, sql } from "drizzle-orm";
import { getUserFromSession } from "./auth";
import { db } from "./db";
import { users } from "./db/schema";

async function assertAdmin() {
	const user = await getUserFromSession();
	if (!user || user.role !== "admin") {
		throw new Error(
			"Akses ditolak. Hanya Admin yang dapat melakukan tindakan ini.",
		);
	}
	return user;
}

// 1. List all users
export const listUsersFn = createServerFn({ method: "GET" }).handler(
	async () => {
		await assertAdmin();

		const list = await db
			.select({
				id: users.id,
				username: users.username,
				role: users.role,
				name: users.name,
				email: users.email,
				isActive: users.isActive,
				createdAt: users.createdAt,
			})
			.from(users)
			.orderBy(desc(users.createdAt));

		return list;
	},
);

// 2. Create new user
export const createUserFn = createServerFn({ method: "POST" })
	.validator(
		(data: {
			username: string;
			name: string;
			email?: string;
			role: "admin" | "visitor";
			passwordHash: string;
		}) => data,
	)
	.handler(async ({ data }) => {
		await assertAdmin();

		// Check if username already exists
		const [existing] = await db
			.select()
			.from(users)
			.where(eq(users.username, data.username));

		if (existing) {
			throw new Error("Username sudah terdaftar");
		}

		const hashed = await bcrypt.hash(data.passwordHash, 10);

		const [inserted] = await db.insert(users).values({
			username: data.username,
			name: data.name,
			email: data.email || null,
			role: data.role,
			passwordHash: hashed,
			isActive: true,
		});

		return {
			success: true,
			userId: (inserted as any).insertId,
		};
	});

// 3. Update user settings (name, email, role, password)
export const updateUserFn = createServerFn({ method: "POST" })
	.validator(
		(data: {
			id: number;
			name: string;
			email?: string;
			role: "admin" | "visitor";
			password?: string;
		}) => data,
	)
	.handler(async ({ data }) => {
		await assertAdmin();

		const updateData: Record<string, any> = {
			name: data.name,
			email: data.email || null,
			role: data.role,
		};

		if (data.password && data.password.trim() !== "") {
			updateData.passwordHash = await bcrypt.hash(data.password, 10);
		}

		await db.update(users).set(updateData).where(eq(users.id, data.id));

		return { success: true };
	});

// 4. Toggle user status (isActive) - soft state block
export const toggleUserStatusFn = createServerFn({ method: "POST" })
	.validator((data: { id: number; isActive: boolean }) => data)
	.handler(async ({ data }) => {
		const adminUser = await assertAdmin();

		if (adminUser.id === data.id) {
			throw new Error("Anda tidak dapat menonaktifkan akun Anda sendiri");
		}

		await db
			.update(users)
			.set({ isActive: data.isActive })
			.where(eq(users.id, data.id));

		return { success: true };
	});
