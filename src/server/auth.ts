import { getCookie } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "./db/schema";

export interface SessionUser {
	id: number;
	username: string;
	role: "admin" | "visitor";
}

export async function getUserFromSession(): Promise<SessionUser | null> {
	const sessionToken = getCookie("session_token");

	if (!sessionToken) return null;

	try {
		// Session token format: base64(userId:role)
		const decoded = Buffer.from(sessionToken, "base64").toString("utf-8");
		const [userIdStr, role] = decoded.split(":");
		const id = parseInt(userIdStr, 10);

		if (Number.isNaN(id)) return null;

		// Verify user exists in database
		const [user] = await db.select().from(users).where(eq(users.id, id));
		if (!user || user.role !== role) return null;

		return {
			id: user.id,
			username: user.username,
			role: user.role,
		};
	} catch {
		return null;
	}
}

export function createSessionToken(userId: number, role: string) {
	return Buffer.from(`${userId}:${role}`).toString("base64");
}
