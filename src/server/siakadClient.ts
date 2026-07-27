import { readFile, writeFile } from "node:fs/promises";

interface TokenCache {
	token: string;
	expiresAt: number; // epoch ms
}

const CACHE_PATH = process.env.SIAKAD_TOKEN_CACHE_PATH || ".siakad-token.json";

function baseUrl() {
	const host = process.env.SIAKAD_HOST || "127.0.0.1";
	const port = process.env.SIAKAD_PORT || "3200";
	return `http://${host}:${port}/api`;
}

async function readCache(): Promise<TokenCache | null> {
	try {
		const raw = await readFile(CACHE_PATH, "utf-8");
		return JSON.parse(raw) as TokenCache;
	} catch {
		return null;
	}
}

async function writeCache(cache: TokenCache) {
	try {
		await writeFile(CACHE_PATH, JSON.stringify(cache), "utf-8");
	} catch (err) {
		console.error("Gagal menyimpan cache token SIAKAD:", err);
	}
}

async function login(): Promise<TokenCache> {
	const username = process.env.SIAKAD_USERNAME;
	const password = process.env.SIAKAD_PASSWORD;
	if (!username || !password) {
		throw new Error("SIAKAD_USERNAME / SIAKAD_PASSWORD belum diset di .env");
	}

	const res = await fetch(`${baseUrl()}/auth/login`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ username, password }),
	});

	if (!res.ok) {
		throw new Error(`Login SIAKAD gagal (status ${res.status})`);
	}

	const body = await res.json();
	const tokenPayload = body.data || body;
	const token = tokenPayload.token;
	const expiresIn = tokenPayload.expires_in ?? 3600;

	if (!token) {
		throw new Error("Token tidak ditemukan dalam respon login SIAKAD");
	}

	// expires_in dalam detik (lihat spek JWT_EXPIRES_HOURS di backend SIAKAD)
	const expiresAt = Date.now() + expiresIn * 1000 - 60_000; // buffer 1 menit
	const cache: TokenCache = { token, expiresAt };
	await writeCache(cache);
	return cache;
}

async function getToken(forceRefresh = false): Promise<string> {
	if (!forceRefresh) {
		const cached = await readCache();
		if (cached && cached.token && cached.expiresAt > Date.now()) {
			return cached.token;
		}
	}
	const fresh = await login();
	return fresh.token;
}

export interface SiakadStudent {
	id: string;
	nim: string;
	nama: string;
	kelas: string;
	angkatan: number;
	jenis_kelamin?: string | null;
	status?: string;
}

/** Return null kalau NIM tidak ditemukan (404). Melempar error untuk kegagalan lain. */
export async function fetchMahasiswaByNim(
	nim: string,
): Promise<SiakadStudent | null> {
	const doFetch = async (token: string) =>
		fetch(`${baseUrl()}/mahasiswa/nim/${encodeURIComponent(nim)}`, {
			headers: { Authorization: `Bearer ${token}` },
		});

	let token = await getToken();
	let res = await doFetch(token);

	if (res.status === 401) {
		// token invalid/expired di sisi server SIAKAD walau cache lokal blm expired -> re-login
		token = await getToken(true);
		res = await doFetch(token);
	}

	if (res.status === 404) return null;
	if (!res.ok) {
		throw new Error(`SIAKAD API error (status ${res.status})`);
	}

	const body = (await res.json()) as { data: SiakadStudent };
	return body.data as SiakadStudent;
}
