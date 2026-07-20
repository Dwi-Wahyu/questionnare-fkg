# Laporan Implementasi — Integrasi Auto-Isi Data SIAKAD ke TracerStudy

## Modified Files
- `.env`
- `.env.example`
- `.gitignore`
- `drizzle/0011_mature_forgotten_one.sql`
- `src/server/db/schema.ts`
- `src/server/siakadClient.ts` (File baru)
- `src/server/siakadFieldDetection.ts` (File baru)
- `src/server/adminSurveyFunctions.ts`
- `src/server/surveyFunctions.ts`
- `src/routes/admin/surveys.$surveyId.tsx`
- `src/routes/survey.$surveySlug.tsx`

## Logic Changes
- **Environment Variables & Gitignore**: Menambahkan variabel konfigurasi `SIAKAD_HOST`, `SIAKAD_PORT`, `SIAKAD_USERNAME`, `SIAKAD_PASSWORD`, dan `SIAKAD_TOKEN_CACHE_PATH`. Menambahkan `.siakad-token.json` ke `.gitignore`.
- **Database Schema**: Menambahkan kolom `siakadAutofillConfig` (tipe JSON) pada skema tabel `surveys` untuk menyimpan konfigurasi `enabled`, `nimQuestionId`, dan `mappings`. Migration Drizzle SQL dipush ke database.
- **SIAKAD Server Client (`src/server/siakadClient.ts`)**: Memperbaiki ekstraksi token JWT dari respon login backend SIAKAD yang dibungkus di dalam objek `data` (`body.data.token`), serta memvalidasi ketersediaan `cached.token` sebelum digunakan agar header `Authorization: Bearer <token>` tidak mengirim token `undefined`.
- **Field Detection Heuristics (`src/server/siakadFieldDetection.ts`)**: Fungsi pendeteksian otomatis saran mapping untuk field NIM, Nama, Angkatan, Kelas, dan Jenis Kelamin berdasarkan judul pertanyaan.
- **Admin Server Functions (`src/server/adminSurveyFunctions.ts`)**: Menambahkan `getSiakadAutofillSuggestionFn` untuk saran mapping dan `updateSiakadAutofillConfigFn` untuk menyimpan konfigurasi survei serta otomatis mengaktifkan `uniqueAnswer: true` pada pertanyaan NIM.
- **Admin UI Settings Tab (`src/routes/admin/surveys.$surveyId.tsx`)**: Menambahkan tombol "Atur Auto-Isi dari SIAKAD" dan komponen `Dialog` interaktif untuk mengonfigurasi pemetaan pertanyaan survei ke data SIAKAD. Menggunakan referensi `detail.survey.id` yang sesuai dengan loader data.
- **Public Server Function (`src/server/surveyFunctions.ts`)**: Menambahkan `lookupMahasiswaByNimFn` yang mengecek status submit ganda sebelum mengambil data mahasiswa dari backend SIAKAD.
- **Public Survey Taking UI (`src/routes/survey.$surveySlug.tsx`)**: Mengimplementasikan trigger pencarian otomatis (debounced 600ms) saat NIM diketik, auto-fill ke field terhubung, pemberian status visual ("Mencari data...", "Tidak ditemukan", "Sudah pernah mengisi"), badge "Diisi otomatis dari data SIAKAD", serta penandaan field terisi sebagai `disabled`.

## Impact on Graph
- Terbentuk modul baru `src/server/siakadClient.ts` dan `src/server/siakadFieldDetection.ts`.
- Terdapat hubungan baru antara `surveyFunctions.ts` -> `siakadClient.ts` dan `adminSurveyFunctions.ts` -> `siakadFieldDetection.ts`.
- Terbentuk keterhubungan baru pada rute UI admin (`surveys.$surveyId.tsx`) dan publik (`survey.$surveySlug.tsx`) ke server functions SIAKAD.
