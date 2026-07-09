import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/react-start/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { createSessionToken, getUserFromSession } from "./auth";
import { db } from "./db";
import { users } from "./db/schema";

export const loginFn = createServerFn({ method: "POST" })
	.validator((data: Record<string, unknown>) => {
		if (!data.username || typeof data.username !== "string") {
			throw new Error("Username is required");
		}
		if (!data.password || typeof data.password !== "string") {
			throw new Error("Password is required");
		}
		return data as { username: string; password: string };
	})
	.handler(async ({ data }) => {
		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.username, data.username));
		if (!user) {
			throw new Error("Username atau password salah");
		}

		const matches = await bcrypt.compare(data.password, user.passwordHash);
		if (!matches) {
			throw new Error("Username atau password salah");
		}

		const token = createSessionToken(user.id, user.role);
		setCookie("session_token", token, {
			path: "/",
			httpOnly: true,
			sameSite: "lax",
			maxAge: 86400,
		});

		return {
			success: true,
			user: {
				id: user.id,
				username: user.username,
				role: user.role,
			},
		};
	});

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
	setCookie("session_token", "", {
		path: "/",
		httpOnly: true,
		sameSite: "lax",
		maxAge: 0,
	});
	return { success: true };
});

export const getSessionFn = createServerFn({ method: "GET" }).handler(
	async () => {
		return await getUserFromSession();
	},
);
