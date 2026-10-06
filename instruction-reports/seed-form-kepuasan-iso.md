# Laporan Perubahan: Seeding Form Kepuasan Kategori ISO (Dosen, Mahasiswa, Mitra, Tendik)

## Modified Files
- `src/server/db/seed-kepuasan-dosen-iso.ts` (Dibuat)
- `src/server/db/seed-kepuasan-mahasiswa-iso.ts` (Dibuat)
- `src/server/db/seed-kepuasan-mitra-iso.ts` (Dibuat)
- `src/server/db/seed-kepuasan-tendik-iso.ts` (Dibuat)
- `src/server/db/seed-iso-surveys.ts` (Dibuat)
- `src/routes/survey.$surveySlug.tsx` (Dimodifikasi)
- `src/server/adminSurveyFunctions.ts` (Dimodifikasi)
- `package.json` (Dimodifikasi)

## Logic Changes
1. **Seeder Form Kepuasan ISO (Dosen, Mahasiswa, Mitra, Tendik)**:
   - Dibuat seeder otomatis untuk seluruh survei kepuasan kategori ISO:
     - Dosen: `kepuasan-dosen-iso` (26 respons)
     - Mahasiswa: `kepuasan-mahasiswa-iso` (7 respons)
     - Mitra: `kepuasan-mitra-iso` (1 respons)
     - Tendik: `kepuasan-tendik-iso` (26 respons)
   - Setiap survei dikonfigurasi dengan:
     - **Bagian 1 (Data Pribadi / Demografi)**: Pertanyaan Email dan Nama bertipe `short_text`.
     - **Bagian 2**: 7 pertanyaan bertipe matriks (`grid`) yang masing-masing memiliki 2 baris (`Harapan / Kepentingan` dan `Persepsi / Kinerja`) serta 5 kolom skala penilaian (`Tidak Puas`, `Kurang Puas`, `Cukup Puas`, `Puas`, `Sangat puas` dengan nilai 1 s/d 5).
     - Khusus formulir Mitra: pertanyaan "Nama Perusahaan" ditempatkan di Bagian 2 (bukan demografi), sesuai arahan kebutuhan bisnis.
   - Semua respons dari berkas CSV di `@data-asli/iso/*` di-parse secara otomatis dan disimpan ke tabel `responses` dan `answers` dengan format `valueGrid` `{ [rowOptionId]: colOptionId }`.

2. **Penggabungan Tampilan Survei Publik (Single-Page View)**:
   - Menambahkan pengecualian kategori `iso` pada [`src/routes/survey.$surveySlug.tsx`](file:///home/dwiwahyu/Projects/FKG/survey/source-code/src/routes/survey.$surveySlug.tsx) bersamaan dengan `layanan-pengaduan`.
   - Seluruh pertanyaan ditampilkan sekaligus dalam 1 halaman formulir publik tanpa multi-step pagination.
   - Menambahkan divider pemisah antar seksi secara visual pada formulir single-page dan menyesuaikan tombol aksi langsung menampilkan "Kirim Jawaban".

3. **Perbaikan Penilaian Skala Negatif pada [`getNumericValueForOption`](file:///home/dwiwahyu/Projects/FKG/survey/source-code/src/server/adminSurveyFunctions.ts)**:
   - Memperbaiki deteksi kata kunci `isPositiveFirst` agar skala yang diawali dengan pilihan negatif seperti "Tidak Puas" atau "Kurang Puas" tidak terbalik nilainya akibat kecocokan parsial substring "puas".

4. **NPM Scripts**:
   - Menambahkan perintah seeder di `package.json`:
     - `db:seed:iso-dosen`
     - `db:seed:iso-mahasiswa`
     - `db:seed:iso-mitra`
     - `db:seed:iso-tendik`
     - `db:seed:iso` (menjalankan keempatnya sekaligus)

## Impact on Graph
- Terdapat penambahan relasi modul antara seeder `seed-iso-surveys.ts` dan modul masing-masing entitas survei ISO (`seed-kepuasan-dosen-iso.ts`, `seed-kepuasan-mahasiswa-iso.ts`, `seed-kepuasan-mitra-iso.ts`, `seed-kepuasan-tendik-iso.ts`) dengan skema basis data Drizzle (`surveys`, `sections`, `questions`, `questionOptions`, `responses`, `answers`).
- Kategori `iso` kini terhubung dengan logika render single-page formulir pada router TanStack Start `survey.$surveySlug.tsx`.
