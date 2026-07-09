import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const poolConnection = mysql.createPool({
	uri: process.env.DATABASE_URL, // mysql://admin:_Admin123_@localhost:3306/tracerstudy
});

export const db = drizzle(poolConnection, { schema, mode: "default" });

// Temporary compatibility placeholders for e-commerce files to prevent typecheck/compile errors
// during transition. These will be replaced in subsequent stages.
export function rawSqlAll<T = Record<string, unknown>>(
	_query: string,
	_params: unknown[] = [],
): T[] {
	return [] as T[];
}

export function rawSqlGet<T = Record<string, unknown>>(
	_query: string,
	_params: unknown[] = [],
): T | undefined {
	return undefined;
}
