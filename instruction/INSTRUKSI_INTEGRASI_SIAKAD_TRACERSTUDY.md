# Instruksi Implementasi — Integrasi Auto-Isi Data SIAKAD ke TracerStudy

Dokumen ini adalah **prompt kerja** untuk agen CLI (Claude Code atau sejenisnya).
Jalankan semua langkah di dalam repo `tracerstudy/` yang sudah berjalan (TanStack Start +
Drizzle/MySQL, sesuai source code yang sudah ada). Semua path di bawah relatif ke root repo.

Konteks: backend **SIAKAD (Rust/Actix-web)** sudah jalan di VPS yang sama (internal network,
lihat `INSTRUKSI_IMPLEMENTASI.md` proyek SIAKAD). Endpoint yang relevan untuk fitur ini:

- `POST /api/auth/login` — body `{ "username", "password" }` → `{ "token", "expires_in" }`
- `GET /api/mahasiswa/nim/{nim}` — perlu header `Authorization: Bearer <token>` →
  `{ "data": { "id", "nim", "nama", "kelas", "angkatan", "jenis_kelamin", "status", ... } }`
  (404 dengan body `{ "error": { "code": "NOT_FOUND", ... } }` kalau NIM tidak ditemukan)

Catatan field mahasiswa yang **pasti terisi** dari data seed saat ini: `nim`, `nama`,
`angkatan` (integer tahun, mis. `2021`), `kelas` (string: `REGULER` / `REGULER A` /
`REGULER B` / `INTERNASIONAL`). Field lain (`jenis_kelamin`, `email`, dll.) mungkin kosong.

> **Catatan untuk agen**: dokumen `GRAPH_REPORT.md` yang disebut user sebagai referensi
> tambahan tidak ikut ter-upload di sesi ini. Jika file itu tersedia di repo, baca dulu
> sebelum mulai — mungkin berisi konteks arsitektur tambahan. Kalau tidak ada, lanjutkan
> dengan spesifikasi di bawah ini yang sudah disusun berdasarkan source code aktual.

---

## 0. Yang sudah ada di codebase (jangan dibangun ulang)

- Tabel `questions` sudah punya kolom `config` (JSON). Ada mekanisme **"Jawaban Unik"**
  yang sudah jalan: kalau `question.config.uniqueAnswer === true` dan tipe `short_text`,
  `submitResponseFn` (`src/server/surveyFunctions.ts`) otomatis menolak submit kedua kali
  dengan value yang sama pada survei yang sama (pesan: *"NIM ini sudah pernah mengirimkan
  jawaban untuk survei ini..."*). **Pakai mekanisme ini untuk enforcement "1 NIM = 1 kali
  isi"**, jangan bikin sistem uniqueness baru. Toggle-nya sudah ada di UI admin
  (`surveys.$surveyId.tsx` sekitar baris 1556-1571, checkbox "Jawaban Unik (mis. NIM)").
- Pola server function: `createServerFn({ method }).validator(...).handler(...)`, auth
  check pakai `assertAdmin()` / `assertUser()` di `src/server/adminSurveyFunctions.ts`.
- Public survey page state: `answersState: Record<questionId, { valueText?, valueOptionIds?, valueGrid? }>`,
  di-update lewat `handleTextChange(qId, val)` (`src/routes/survey.$surveySlug.tsx`).

---

## 1. Environment variables

Tambahkan ke `.env` (dan `.env.example` kalau ada):

```
SIAKAD_HOST=127.0.0.1
SIAKAD_PORT=3200
SIAKAD_USERNAME=admin
SIAKAD_PASSWORD=ganti-sesuai-akun-siakad
SIAKAD_TOKEN_CACHE_PATH=.siakad-token.json
```

- `SIAKAD_HOST` default `127.0.0.1` karena diakses via jaringan internal VPS (SIAKAD di-bind
  ke `127.0.0.1:3200` sesuai log yang diberikan user).
- Base URL yang dipakai di kode: `http://${SIAKAD_HOST}:${SIAKAD_PORT}/api`.
- Tambahkan `.siakad-token.json` (atau path custom di atas) ke `.gitignore`.

---

## 2. Migrasi database — kolom konfigurasi auto-isi di survei

Buat migration Drizzle baru untuk menambah kolom JSON di tabel `surveys`:

```ts
// migrations/xxxx_add_siakad_autofill_config.sql (generate via drizzle-kit)
ALTER TABLE surveys ADD COLUMN siakad_autofill_config JSON;
```

Update `src/server/db/schema.ts`, tambahkan pada definisi `surveys`:

```ts
siakadAutofillConfig: json("siakad_autofill_config").$type<{
  enabled: boolean;
  nimQuestionId: number | null;
  mappings: { questionId: number; field: "nama" | "angkatan" | "kelas" | "jenis_kelamin" }[];
}>(),
```

Jalankan `drizzle-kit generate` / `push` sesuai workflow migrasi yang sudah dipakai di repo ini.

---

## 3. Klien SIAKAD server-side — `src/server/siakadClient.ts` (file baru)

Bertugas: login ke SIAKAD, simpan token ke file, reuse token selama belum expired, re-login
otomatis kalau dapat 401.

```ts
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
  // expires_in dalam detik (lihat spek JWT_EXPIRES_HOURS di backend SIAKAD)
  const expiresAt = Date.now() + (body.expires_in ?? 3600) * 1000 - 60_000; // buffer 1 menit
  const cache: TokenCache = { token: body.token, expiresAt };
  await writeCache(cache);
  return cache;
}

async function getToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh) {
    const cached = await readCache();
    if (cached && cached.expiresAt > Date.now()) {
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

  const body = await res.json();
  return body.data as SiakadStudent;
}
```

---

## 4. Heuristik deteksi field — `src/server/siakadFieldDetection.ts` (file baru)

Dipakai admin dialog untuk menyarankan mapping otomatis. **Bukan** dipakai di sisi
responden (di sisi responden, mapping yang sudah tersimpan di DB yang jadi acuan, bukan
tebakan ulang).

```ts
export type SiakadField = "nim" | "nama" | "angkatan" | "kelas" | "jenis_kelamin";

const KEYWORDS: { field: SiakadField; patterns: RegExp[] }[] = [
  { field: "nim", patterns: [/^nim$/i] },
  { field: "nama", patterns: [/^nama( mahasiswa| lengkap)?$/i] },
  {
    field: "angkatan",
    patterns: [/^angkatan$/i, /^tahun masuk( fkg)?$/i],
  },
  { field: "kelas", patterns: [/^kelas$/i] },
  { field: "jenis kelamin", patterns: [/^jenis kelamin$/i] },
];

export function detectSiakadField(
  questionTitle: string,
): SiakadField | null {
  const normalized = questionTitle.trim().toLowerCase();
  for (const entry of KEYWORDS) {
    if (entry.patterns.some((p) => p.test(normalized))) {
      return entry.field as SiakadField;
    }
  }
  return null;
}
```

Catatan: pola dibuat match-persis (bukan substring) supaya tidak salah tebak pertanyaan
lain yang kebetulan mengandung kata "nama". Ini hanya **saran awal** — admin tetap
konfirmasi/ubah manual lewat dialog di §6.

---

## 5. Server functions admin — tambahkan di `src/server/adminSurveyFunctions.ts`

```ts
import { detectSiakadField } from "./siakadFieldDetection";

// Sarankan mapping otomatis berdasarkan judul pertanyaan yang sudah ada di survei.
export const getSiakadAutofillSuggestionFn = createServerFn({ method: "GET" })
  .validator((surveyId: number) => surveyId)
  .handler(async ({ data: surveyId }) => {
    await assertAdmin();

    const surveyQuestions = await db
      .select({ id: questions.id, title: questions.title, type: questions.type })
      .from(questions)
      .where(eq(questions.surveyId, surveyId));

    const shortTextQuestions = surveyQuestions.filter(
      (q) => q.type === "short_text",
    );

    let nimQuestionId: number | null = null;
    const mappings: { questionId: number; field: string }[] = [];

    for (const q of shortTextQuestions) {
      const field = detectSiakadField(q.title);
      if (!field) continue;
      if (field === "nim") {
        nimQuestionId = q.id;
      } else {
        mappings.push({ questionId: q.id, field });
      }
    }

    return {
      candidateQuestions: shortTextQuestions,
      suggestedNimQuestionId: nimQuestionId,
      suggestedMappings: mappings,
    };
  });

// Simpan konfigurasi auto-isi SIAKAD untuk sebuah survei.
export const updateSiakadAutofillConfigFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      surveyId: number;
      enabled: boolean;
      nimQuestionId: number | null;
      mappings: { questionId: number; field: string }[];
    }) => data,
  )
  .handler(async ({ data }) => {
    await assertAdmin();

    if (data.enabled && !data.nimQuestionId) {
      throw new Error("Pilih pertanyaan NIM terlebih dahulu.");
    }

    await db
      .update(surveys)
      .set({
        siakadAutofillConfig: {
          enabled: data.enabled,
          nimQuestionId: data.nimQuestionId,
          mappings: data.mappings as any,
        },
        updatedAt: new Date(),
      })
      .where(eq(surveys.id, data.surveyId));

    // Otomatis tandai pertanyaan NIM sebagai "Jawaban Unik" supaya enforcement
    // 1-NIM-1-kali-isi di submitResponseFn (lihat §0) aktif.
    if (data.enabled && data.nimQuestionId) {
      const [nimQuestion] = await db
        .select({ id: questions.id, config: questions.config })
        .from(questions)
        .where(eq(questions.id, data.nimQuestionId));

      if (nimQuestion) {
        await db
          .update(questions)
          .set({
            config: { ...(nimQuestion.config as any), uniqueAnswer: true },
          })
          .where(eq(questions.id, data.nimQuestionId));
      }
    }

    return { success: true };
  });
```

Tambahkan import `surveys`/`questions`/`db`/`eq` yang relevan kalau belum ada di scope file
(mayoritas sudah di-import di file ini).

---

## 6. UI Admin — dialog "Auto-Isi dari SIAKAD" di tab Setelan

File: `src/routes/admin/surveys.$surveyId.tsx`.

1. Import `Dialog` dari `../../components/ui/Dialog` (kalau belum ada di file ini — cek
   dulu, mungkin sudah dipakai untuk keperluan lain).
2. Import `getSiakadAutofillSuggestionFn`, `updateSiakadAutofillConfigFn` dari
   `../../server/adminSurveyFunctions`.
3. Tambahkan state baru di komponen:
   ```ts
   const [isSiakadDialogOpen, setIsSiakadDialogOpen] = useState(false);
   const [siakadEnabled, setSiakadEnabled] = useState(false);
   const [siakadNimQuestionId, setSiakadNimQuestionId] = useState<number | null>(null);
   const [siakadMappings, setSiakadMappings] = useState<
     { questionId: number; field: string }[]
   >([]);
   const [siakadCandidates, setSiakadCandidates] = useState<
     { id: number; title: string }[]
   >([]);
   const [isSavingSiakad, setIsSavingSiakad] = useState(false);
   ```
4. Handler buka dialog — panggil suggestion function, lalu prefill dari
   `survey.siakadAutofillConfig` kalau sudah pernah diset sebelumnya (config tersimpan
   selalu jadi prioritas di atas saran otomatis):
   ```ts
   const handleOpenSiakadDialog = async () => {
     setIsSiakadDialogOpen(true);
     const res = await getSiakadAutofillSuggestionFn({ data: survey.id });
     setSiakadCandidates(res.candidateQuestions);
     const existing = (survey as any).siakadAutofillConfig;
     setSiakadEnabled(existing?.enabled ?? false);
     setSiakadNimQuestionId(existing?.nimQuestionId ?? res.suggestedNimQuestionId);
     setSiakadMappings(existing?.mappings ?? res.suggestedMappings);
   };

   const handleSaveSiakadConfig = async () => {
     setIsSavingSiakad(true);
     try {
       await updateSiakadAutofillConfigFn({
         data: {
           surveyId: survey.id,
           enabled: siakadEnabled,
           nimQuestionId: siakadNimQuestionId,
           mappings: siakadMappings,
         },
       });
       showToast("Konfigurasi auto-isi SIAKAD tersimpan.", "success");
       setIsSiakadDialogOpen(false);
       router.invalidate();
     } catch (err: any) {
       showToast(err.message || "Gagal menyimpan konfigurasi.", "error");
     } finally {
       setIsSavingSiakad(false);
     }
   };
   ```
   (Sesuaikan nama fungsi toast/`router.invalidate` dengan pola yang sudah dipakai di file
   ini untuk handler lain seperti `handleSaveSettings`.)
5. Tambahkan tombol pemicu di tab Setelan, tepat sebelum blok tombol "Duplikat Survei" /
   "Simpan Perubahan" (sekitar baris 3106 di `<div className="h-px bg-slate-100 my-4">`):
   ```tsx
   <div className="flex flex-col gap-1.5">
     <label className="text-sm font-bold text-[#1a1b21]">
       Integrasi Data SIAKAD
     </label>
     <p className="text-xxs text-[#747683] italic">
       Isi otomatis field seperti Nama dan Angkatan berdasarkan NIM yang
       diketik responden.
     </p>
     <button
       type="button"
       onClick={handleOpenSiakadDialog}
       disabled={user?.role === "visitor"}
       className="w-fit bg-white border border-slate-200 text-[#434652] hover:bg-slate-50 hover:text-[#B00000] font-semibold px-4 py-2 rounded-lg text-xs shadow-sm transition-colors"
     >
       Atur Auto-Isi dari SIAKAD
     </button>
   </div>
   ```
6. Render dialog-nya (di luar `<form>`, sejajar dengan `<ConfirmDialog>` lain di akhir
   komponen):
   ```tsx
   <Dialog
     isOpen={isSiakadDialogOpen}
     onClose={() => setIsSiakadDialogOpen(false)}
     title="Auto-Isi dari Data SIAKAD"
   >
     <div className="space-y-4">
       <label className="flex items-center gap-2 text-sm font-semibold">
         <input
           type="checkbox"
           checked={siakadEnabled}
           onChange={(e) => setSiakadEnabled(e.target.checked)}
         />
         Aktifkan auto-isi dari SIAKAD untuk survei ini
       </label>

       <div>
         <label className="text-xs font-bold block mb-1">
           Pertanyaan mana yang merupakan NIM?
         </label>
         <select
           value={siakadNimQuestionId ?? ""}
           onChange={(e) =>
             setSiakadNimQuestionId(
               e.target.value ? Number(e.target.value) : null,
             )
           }
           className="w-full border border-slate-200 rounded-lg py-2 px-3 text-sm"
         >
           <option value="">-- Pilih pertanyaan --</option>
           {siakadCandidates.map((q) => (
             <option key={q.id} value={q.id}>
               {q.title}
             </option>
           ))}
         </select>
       </div>

       <div>
         <label className="text-xs font-bold block mb-2">
           Pertanyaan yang otomatis diisi dari data mahasiswa
         </label>
         <div className="space-y-2">
           {siakadCandidates
             .filter((q) => q.id !== siakadNimQuestionId)
             .map((q) => {
               const current =
                 siakadMappings.find((m) => m.questionId === q.id)?.field ?? "";
               return (
                 <div key={q.id} className="flex items-center gap-2">
                   <span className="text-xs flex-1 truncate">{q.title}</span>
                   <select
                     value={current}
                     onChange={(e) => {
                       const field = e.target.value;
                       setSiakadMappings((prev) => {
                         const rest = prev.filter((m) => m.questionId !== q.id);
                         return field
                           ? [...rest, { questionId: q.id, field }]
                           : rest;
                       });
                     }}
                     className="border border-slate-200 rounded-lg py-1.5 px-2 text-xs"
                   >
                     <option value="">Tidak digunakan</option>
                     <option value="nama">Nama</option>
                     <option value="angkatan">Angkatan / Tahun Masuk</option>
                     <option value="kelas">Kelas</option>
                     <option value="jenis_kelamin">Jenis Kelamin</option>
                   </select>
                 </div>
               );
             })}
         </div>
       </div>

       <div className="flex justify-end pt-2">
         <button
           type="button"
           onClick={handleSaveSiakadConfig}
           disabled={isSavingSiakad}
           className="bg-[#4A0000] text-white hover:bg-[#B00000] font-semibold px-5 py-2 rounded-lg text-xs"
         >
           {isSavingSiakad ? "Menyimpan..." : "Simpan Konfigurasi"}
         </button>
       </div>
     </div>
   </Dialog>
   ```

---

## 7. Server function publik — lookup by NIM

Tambahkan di `src/server/surveyFunctions.ts`:

```ts
import { fetchMahasiswaByNim } from "./siakadClient";

export const lookupMahasiswaByNimFn = createServerFn({ method: "POST" })
  .validator((data: { surveyId: number; nim: string }) => data)
  .handler(async ({ data }) => {
    const [survey] = await db
      .select()
      .from(surveys)
      .where(eq(surveys.id, data.surveyId));

    const config = (survey as any)?.siakadAutofillConfig as
      | { enabled: boolean; nimQuestionId: number | null; mappings: { questionId: number; field: string }[] }
      | null;

    if (!survey || !config?.enabled || !config.nimQuestionId) {
      return { enabled: false as const };
    }

    const nim = data.nim.trim();
    if (!nim) return { enabled: true as const, found: false as const, alreadyUsed: false };

    // Cek dulu apakah NIM ini sudah pernah submit lengkap untuk survei ini —
    // hindari fetch ke SIAKAD kalau memang sudah tidak relevan.
    const [dup] = await db
      .select({ id: answers.id })
      .from(answers)
      .innerJoin(responses, eq(answers.responseId, responses.id))
      .where(
        and(
          eq(answers.questionId, config.nimQuestionId),
          eq(responses.surveyId, data.surveyId),
          eq(responses.status, "completed"),
          sql`${answers.valueText} = ${nim}`,
        ),
      );

    if (dup) {
      return { enabled: true as const, found: false as const, alreadyUsed: true };
    }

    try {
      const student = await fetchMahasiswaByNim(nim);
      if (!student) {
        return { enabled: true as const, found: false as const, alreadyUsed: false };
      }

      const values: Record<number, string> = {};
      for (const m of config.mappings) {
        const raw = (student as any)[m.field];
        if (raw === null || raw === undefined) continue;
        values[m.questionId] = String(raw);
      }

      return { enabled: true as const, found: true as const, alreadyUsed: false, values };
    } catch (err) {
      console.error("Gagal fetch data SIAKAD:", err);
      // Jangan blokir pengisian manual kalau SIAKAD sedang down.
      return { enabled: true as const, found: false as const, alreadyUsed: false, error: true };
    }
  });
```

Ingat tambahkan `answers` ke import dari `./db/schema` di file ini kalau belum ada (sudah
ada — dipakai di `submitResponseFn`).

---

## 8. UI Publik — trigger auto-isi di `src/routes/survey.$surveySlug.tsx`

1. Tambahkan import `lookupMahasiswaByNimFn` dari `../server/surveyFunctions`.
2. Tambahkan state:
   ```ts
   const siakadConfig = (survey as any)?.siakadAutofillConfig as
     | { enabled: boolean; nimQuestionId: number | null; mappings: { questionId: number; field: string }[] }
     | null;
   const [autofilledQuestionIds, setAutofilledQuestionIds] = useState<Set<number>>(new Set());
   const [siakadStatus, setSiakadStatus] = useState<
     "idle" | "loading" | "found" | "not_found" | "already_used"
   >("idle");
   const nimDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
   ```
3. Di dalam `handleTextChange`, setelah `setAnswersState(newAnswers)`, tambahkan trigger
   khusus untuk pertanyaan NIM (debounce ~600ms, dan jangan trigger kalau field yang
   diketik justru salah satu field yang sedang di-autofill — field itu sudah `disabled`
   jadi tidak akan pernah masuk sini):
   ```ts
   if (siakadConfig?.enabled && qId === siakadConfig.nimQuestionId) {
     if (nimDebounceRef.current) clearTimeout(nimDebounceRef.current);
     const nimValue = val.trim();
     if (nimValue.length < 6) {
       setSiakadStatus("idle");
       setAutofilledQuestionIds(new Set());
     } else {
       nimDebounceRef.current = setTimeout(async () => {
         setSiakadStatus("loading");
         try {
           const res = await lookupMahasiswaByNimFn({
             data: { surveyId: survey.id, nim: nimValue },
           });
           if (!res.enabled) return;
           if (res.alreadyUsed) {
             setSiakadStatus("already_used");
             setAutofilledQuestionIds(new Set());
             return;
           }
           if (res.found && res.values) {
             setAnswersState((prev) => {
               const next = { ...prev };
               for (const [qidStr, value] of Object.entries(res.values!)) {
                 next[Number(qidStr)] = { ...next[Number(qidStr)], valueText: value };
               }
               return next;
             });
             setAutofilledQuestionIds(
               new Set(Object.keys(res.values).map(Number)),
             );
             setSiakadStatus("found");
           } else {
             setSiakadStatus("not_found");
             setAutofilledQuestionIds(new Set());
           }
         } catch {
           setSiakadStatus("idle");
         }
       }, 600);
     }
   }
   ```
4. Di render `short_text`/`dropdown` question (baris ~659 dst.), tambahkan:
   - `disabled={autofilledQuestionIds.has(q.id)}` pada `<input>`/`<select>` terkait.
   - Badge kecil kalau field itu sedang auto-terisi, mis. sesudah label pertanyaan:
     ```tsx
     {autofilledQuestionIds.has(q.id) && (
       <span className="text-xxs font-semibold text-emerald-600 flex items-center gap-1">
         Diisi otomatis dari data SIAKAD
       </span>
     )}
     ```
   - Untuk pertanyaan NIM sendiri, tampilkan status singkat di bawah input-nya:
     ```tsx
     {siakadConfig?.enabled && q.id === siakadConfig.nimQuestionId && (
       <>
         {siakadStatus === "loading" && (
           <span className="text-xxs text-slate-500">Mencari data mahasiswa...</span>
         )}
         {siakadStatus === "not_found" && (
           <span className="text-xxs text-amber-600">
             NIM tidak ditemukan di data SIAKAD, silakan isi manual.
           </span>
         )}
         {siakadStatus === "already_used" && (
           <span className="text-xxs text-[#ba1a1a] font-semibold">
             NIM ini sudah pernah mengisi survei ini.
           </span>
         )}
       </>
     )}
     ```
5. **Enforcement akhir tetap di server** (§0/§7 dari `submitResponseFn` yang sudah ada) —
   dialog `already_used` di atas hanya UX awal, bukan satu-satunya penjaga.

---

## 9. Verifikasi akhir (checklist agen CLI)

- [ ] Migration `siakad_autofill_config` sukses dijalankan, kolom muncul di tabel `surveys`
- [ ] `getSiakadAutofillSuggestionFn` mengembalikan saran mapping yang masuk akal untuk
      survei uji yang punya pertanyaan "NIM", "Nama", "Angkatan"/"Tahun Masuk FKG"
- [ ] Dialog "Atur Auto-Isi dari SIAKAD" di tab Setelan bisa dibuka, disimpan, dan setelah
      reload konfigurasi tersimpan muncul kembali saat dialog dibuka lagi
- [ ] Setelah disimpan dengan `enabled: true`, pertanyaan NIM otomatis punya
      `config.uniqueAnswer = true`
- [ ] Di halaman publik survei: mengetik NIM valid (>=6 karakter) memicu
      `lookupMahasiswaByNimFn` (cek network tab / log server), field yang ter-mapping
      terisi otomatis dan berubah jadi disabled
- [ ] NIM yang tidak ada di SIAKAD → tidak error, hanya pesan "tidak ditemukan", form tetap
      bisa diisi manual
- [ ] NIM yang sudah pernah submit lengkap untuk survei tsb → muncul pesan "sudah pernah
      mengisi", dan submit ulang tetap ditolak server (`submitResponseFn`) sebagai jaring
      pengaman kedua
- [ ] Kalau backend SIAKAD dimatikan sementara → halaman survei publik tidak crash, hanya
      auto-isi yang tidak jalan (graceful degradation, lihat try/catch di §7)
- [ ] Cache token di file (`SIAKAD_TOKEN_CACHE_PATH`) terbentuk setelah lookup pertama, dan
      dipakai ulang (tidak login berkali-kali) sampai mendekati waktu expired
- [ ] File cache token masuk `.gitignore`

---

## 10. Di luar scope ini (boleh dicatat sebagai TODO)

- Sinkronisasi dua arah (update data SIAKAD dari hasil survei) — tidak diminta.
- Auto-isi untuk tipe pertanyaan selain `short_text`/`dropdown` (mis. `linear_scale`,
  `grid`) — tidak relevan untuk field identitas mahasiswa.
- Rate limiting khusus endpoint `lookupMahasiswaByNimFn` terhadap spam — pertimbangkan kalau
  survei publik ramai diakses; untuk MVP cukup andalkan debounce di frontend.
