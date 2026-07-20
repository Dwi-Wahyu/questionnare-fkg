export type SiakadField =
	| "nim"
	| "nama"
	| "angkatan"
	| "kelas"
	| "jenis_kelamin";

const KEYWORDS: { field: SiakadField; patterns: RegExp[] }[] = [
	{ field: "nim", patterns: [/^nim$/i] },
	{ field: "nama", patterns: [/^nama( mahasiswa| lengkap)?$/i] },
	{
		field: "angkatan",
		patterns: [/^angkatan$/i, /^tahun masuk( fkg)?$/i],
	},
	{ field: "kelas", patterns: [/^kelas$/i] },
	{ field: "jenis_kelamin", patterns: [/^jenis kelamin$/i] },
];

export function detectSiakadField(questionTitle: string): SiakadField | null {
	const normalized = questionTitle.trim().toLowerCase();
	for (const entry of KEYWORDS) {
		if (entry.patterns.some((p) => p.test(normalized))) {
			return entry.field;
		}
	}
	return null;
}
