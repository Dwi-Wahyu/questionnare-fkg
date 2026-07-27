# Instruksi: Fitur Survey "Layanan Pengaduan" (Conditional Questions + Export Colspan)

Konteks proyek: Simlab Survey Module (TanStack Start + Drizzle ORM + MySQL). Baca dulu file berikut sebelum mulai supaya paham pola yang sudah ada, JANGAN menebak-nebak struktur:

- `src/server/db/schema.ts` — semua tabel (`surveys`, `sections`, `questions`, `questionOptions`, `responses`, `answers`, dst)
- `src/server/db/seedCategories.ts` — pola seeder kategori survey
- `src/server/surveyFunctions.ts` — server functions publik (submit response, dsb)
- `src/server/adminSurveyFunctions.ts` — server functions admin (CRUD survey/questions, export CSV/XLSX, generate laporan docx)
- `src/routes/survey.$surveySlug.tsx` — halaman publik pengisian survey (render pertanyaan per tipe)
- `src/routes/admin/surveys.$surveyId.tsx` — halaman admin detail survey (Tab "Pertanyaan" = builder, sub-tab "Statistik"/"Pertanyaan" untuk chart)

Fitur ini butuh kemampuan baru yang BELUM ada di codebase: **pertanyaan bersyarat (conditional questions)** yang muncul/hilang berdasarkan jawaban pertanyaan lain. Buat ini generik (bisa dipakai survey lain ke depannya), bukan hardcode khusus satu survey — hanya *data seed*-nya yang spesifik untuk "Layanan Pengaduan".

---

## 1. Schema: tambah kolom conditional visibility pada `questions`

Tambahkan 2 kolom nullable di tabel `questions` (`src/server/db/schema.ts`):

```ts
conditionalParentQuestionId: int("conditional_parent_question_id").references(
  () => questions.id,
  { onDelete: "cascade" },
),
// Pertanyaan ini hanya tampil jika jawaban parent question memuat salah satu
// option id berikut (match via valueOptionIds, seperti pola filter export
// yang sudah ada di buildSurveyResponseExport).
conditionalParentOptionIds: json(
  "conditional_parent_option_ids",
).$type<number[]>(),
```

Tambahkan index untuk `conditionalParentQuestionId` (ikuti pola `questionIdx`/`sectionIdx` yang sudah ada di tabel `questions`).

Generate migration dengan `drizzle-kit` (ikuti pola file di `drizzle/000X_*.sql`, jangan tulis SQL manual).

Catatan: parent question WAJIB bertipe `multiple_choice` (radio, single-select) — untuk `checkboxes`/`grid` belum perlu didukung sekarang (boleh divalidasi & ditolak di server function kalau parent bukan `multiple_choice`).

---

## 2. Kategori & Seeder Survey "Layanan Pengaduan"

### 2.1 Kategori
Tambahkan entri baru ke `CATEGORY_SEED_DATA` di `src/server/db/seedCategories.ts`:

```ts
{ slug: "layanan-pengaduan", name: "Layanan Pengaduan", order: 3 },
```

### 2.2 Seeder survey
Buat file baru `src/server/db/seedLayananPengaduan.ts` (pola insert langsung ke `surveys`/`sections`/`questions`/`questionOptions` via drizzle, JANGAN pakai CSV importer di `seed.ts` — itu untuk keperluan lain). Tambahkan entrypoint run terpisah (mis. `src/server/db/seed-layanan-pengaduan.ts`) mengikuti pola `seed-categories.ts`, lalu tambahkan script `package.json` (`db:seed:layanan-pengaduan` atau sejenis, cek script existing dulu).

Struktur data yang harus diseed:

- **Survey**
  - `title`: `"LAPOR !!! Layanan Pengaduan Fakultas Kedokteran Gigi Universitas Hasanuddin"`
  - `slug`: `"layanan-pengaduan"` (atau slug lain yang belum dipakai — cek unique constraint)
  - `category`: `"layanan-pengaduan"`
  - `description`: bebas, boleh pakai tagline dari contoh file excel: "Layanan Aspirasi dan Pengaduan Online" / "Sampaikan Laporan Anda!"
  - `status`: `"draft"` (biar admin bisa review dulu sebelum publish)

- **Section 1** — judul bebas mis. "Klarifikasi Laporan"
  - **Q1** `"Klarifikasi Laporan"` — type `multiple_choice`, `required: true`, ini adalah **pertanyaan filter utama**. Opsi (urut):
    1. `PENGADUAN`
    2. `ASPIRASI/ SARAN`
    3. `PERMINTAAN INFORMASI`

- **Section 2** — judul bebas mis. "Detail Laporan" (pertanyaan-pertanyaan di sini SEMUA conditional terhadap Q1)
  - **Q2** `"Akademik dan Kemahasiswaan"` — type `multiple_choice`, `required: false`, `conditionalParentQuestionId = Q1.id`, `conditionalParentOptionIds = [id opsi "PENGADUAN"]`. Opsi (urut, 6 opsi):
    1. Akademik
    2. Kemahasiswaan
    3. Administrasi Akademik
    4. Layanan Staf/ Tenaga Kependidikan
    5. Kesejahteraan Mahasiswa
    6. Perpustakaan
  - **Q3** `"Sarana dan Prasarana"` — type `multiple_choice`, `required: false`, `conditionalParentQuestionId = Q1.id`, `conditionalParentOptionIds = [id opsi "PENGADUAN"]`. Opsi (urut, 4 opsi):
    1. Ruang Kuliah
    2. Toilet
    3. Layanan Psikologi
    4. Laporan Tindak Kekerasan (Fisik Seksual dan Verbal)
  - **Q4** `"Uraian Laporan"` — type `paragraph`, `required: true`, `conditionalParentQuestionId = Q1.id`, `conditionalParentOptionIds = [id opsi "ASPIRASI/ SARAN", id opsi "PERMINTAAN INFORMASI"]`. Ini textarea bebas yang tampil untuk KEDUA klasifikasi tsb (bukan cuma satu) — sesuai instruksi: "langsung munculkan text area editor" untuk ASPIRASI/SARAN & PERMINTAAN INFORMASI.

  > Catatan Q2 & Q3 sengaja `required: false` karena keduanya sama-sama muncul saat PENGADUAN dipilih, tapi responden biasanya hanya relevan mengisi salah satu (isu akademik ATAU isu sarpras). Kalau Wahil mau salah satunya wajib diisi (minimal salah satu dari Q2/Q3), itu butuh validasi custom tambahan — tandai sebagai TODO, jangan diam-diam diasumsikan.

Semua `questions.surveyId` denormalized sesuai schema — isi juga field ini saat insert (lihat komentar `// denormalized, see §1` di `schema.ts`).

---

## 3. Halaman publik: render conditional questions (`survey.$surveySlug.tsx`)

Tujuan: pertanyaan dengan `conditionalParentQuestionId` tidak dirender / disembunyikan dari alur pengisian sampai jawaban parent-nya cocok dengan salah satu `conditionalParentOptionIds`.

Langkah:
1. Saat build daftar pertanyaan section (sekitar baris ~290-320, tempat logic per-tipe `q.type === "grid" / "checkboxes" / ...` untuk validasi berada), tambahkan helper `isQuestionVisible(q, answersState)`:
   - Kalau `q.conditionalParentQuestionId` null → selalu visible.
   - Kalau tidak null → ambil jawaban terkini untuk `conditionalParentQuestionId` dari state jawaban form, cek apakah salah satu `valueOptionIds`-nya termasuk dalam `q.conditionalParentOptionIds`.
2. Filter render pertanyaan per section pakai `isQuestionVisible` — reaktif terhadap perubahan pilihan radio (pakai state form yang sudah ada, bukan bikin state baru terpisah).
3. **Validasi wajib isi**: pertanyaan yang `required: true` TAPI sedang tidak visible harus di-skip dari validasi submit (jangan blokir submit gara-gara pertanyaan tersembunyi).
4. **Cleanup jawaban saat parent berubah**: kalau user ganti pilihan Klarifikasi Laporan dari PENGADUAN ke ASPIRASI/SARAN, jawaban Q2/Q3 yang sudah keisi sebelumnya harus dikosongkan dari state (supaya tidak ikut ter-submit sebagai data nyasar). Sama untuk progress bar/step counter kalau ada — jangan hitung pertanyaan yang sedang hidden.
5. Pastikan payload submit (`answers` yang dikirim ke `surveyFunctions.ts`) tidak menyertakan jawaban untuk pertanyaan yang non-visible saat submit final.

Buat logic ini generik (helper function terpisah, bisa diimpor/dipakai survey lain), bukan `if (survey.slug === "layanan-pengaduan")`.

---

## 4. Admin builder (Tab "Pertanyaan", `surveys.$surveyId.tsx`)

### 4.1 Form edit pertanyaan
Di form edit/tambah pertanyaan (builder tab, BUKAN sub-tab statistik yang sudah ada di sekitar baris 2065-2120), tambahkan section "Tampilkan hanya jika" (conditional visibility):
- Dropdown pilih "Pertanyaan induk" — hanya tampilkan pertanyaan lain di survey yang sama, bertipe `multiple_choice`, dan urutannya SEBELUM pertanyaan ini (hindari circular reference).
- Multi-select opsi dari pertanyaan induk yang dipilih → jadi `conditionalParentOptionIds`.
- Tombol clear untuk hapus kondisi (balik jadi selalu tampil).
- Validasi FE + BE (`updateAdminSurveyQuestionsFn`, baris ~867): tolak kalau parent bukan `multiple_choice`, tolak circular reference (parent tidak boleh berupa descendant dari pertanyaan itu sendiri).

### 4.2 Preview mode / filter utama di daftar pertanyaan builder
Requirement dari user: *"pada tampilan detail survey ... dapat memilih pertanyaan yang berupa sebagai filter utama seluruh pertanyaan pada Tab Pertanyaan, ketika memilih salah satu opsi dari pertanyaan tersebut daftar pertanyaan dibawahnya akan berubah"*

Tambahkan di atas daftar pertanyaan builder (tab `questions`, sekitar baris ~1185 dst):
- Auto-detect "pertanyaan filter utama" = pertanyaan `multiple_choice` yang punya ≥1 pertanyaan lain mereferensikan dia via `conditionalParentQuestionId` (tidak perlu kolom boolean baru, cukup derive dari data).
- Kalau survey punya filter utama, tampilkan selector "Preview cabang" dengan opsi: "Semua" + tiap opsi dari pertanyaan filter utama tsb.
- Saat admin pilih salah satu opsi (mis. "PENGADUAN"), daftar pertanyaan di builder difilter: tampilkan pertanyaan yang selalu-visible + pertanyaan yang `conditionalParentOptionIds` cocok dengan opsi terpilih; sembunyikan/dim cabang lain. Ini murni state UI lokal (tidak perlu ubah data), tujuannya biar admin gampang ngedit survey yang punya banyak cabang tanpa scroll bingung.

---

## 5. Export: mode khusus untuk kategori `layanan-pengaduan`

File: `src/server/adminSurveyFunctions.ts`, fungsi `buildSurveyResponseExport` (baris ~1333) dipakai bareng oleh `exportAdminSurveyResponsesCSVFn` (~1573) dan `exportAdminSurveyResponsesXLSXFn` (~1619).

### 5.1 Filter wajib dipilih dulu
Untuk `survey.category === "layanan-pengaduan"`:
- `filterQuestionId` + `filterOptionIds` (tepat 1 opsi, dari pertanyaan "Klarifikasi Laporan") WAJIB diisi sebelum export bisa jalan — kalau kosong, `buildSurveyResponseExport` harus `throw new Error(...)` dengan pesan jelas ("Pilih Klarifikasi Laporan terlebih dahulu untuk mengekspor data").
- Di sisi FE (`surveys.$surveyId.tsx`, sekitar baris 269/348/818/846/945 tempat `csvFilterQuestionId` dipakai untuk dialog export): kalau `survey.category === "layanan-pengaduan"`, jadikan pemilihan filter mandatory (disable tombol export sampai user pilih satu opsi Klarifikasi Laporan), dan batasi jadi single-select radio (bukan multi-checkbox seperti filter export biasa) — karena struktur kolom colspan di bawah ini cuma valid untuk 1 klasifikasi sekaligus.

### 5.2 Kolom "Klarifikasi Laporan" TIDAK ikut jadi kolom data
Saat build `columnPlans` (loop `for (const q of surveyQuestions)`, baris ~1474), skip pertanyaan yang `q.id === filterQuestionId` — ini bedanya dari behavior export biasa sekarang (yang tetap ikut nampilin semua kolom pertanyaan termasuk yang dipakai sebagai filter). Cocokkan dengan contoh file Excel yang diberikan user: kolom "Pilih Klarifikasi Laporan" (`B5:D6` + `B7:D7` = "PENGADUAN"/"ASPIRASI/ SARAN"/"PERMINTAAN INFORMASI") itu yang harus HILANG di format baru.

### 5.3 Header 2-baris dengan colspan (khusus XLSX)
Ini bagian yang beda dari export generik yang sudah ada. Untuk `survey.category === "layanan-pengaduan"` di `exportAdminSurveyResponsesXLSXFn`:

- Cari semua pertanyaan yang `conditionalParentOptionIds` mencakup opsi filter yang dipilih (mis. opsi "PENGADUAN" → dapat Q2 "Akademik dan Kemahasiswaan" & Q3 "Sarana dan Prasarana"). Tiap pertanyaan begini jadi 1 **grup kolom**:
  - Baris header atas: label pertanyaan (mis. "Akademik dan Kemahasiswaan"), merge cell horizontal sepanjang jumlah opsinya (`sheet.mergeCells(...)`, colspan = jumlah `questionOptions` milik pertanyaan itu — utk Akademik dan Kemahasiswaan = 6, Sarana dan Prasarana = 4 sesuai daftar opsi di §2.2).
  - Baris header bawah: label tiap opsi jadi header kolom sendiri-sendiri (Akademik | Kemahasiswaan | Administrasi Akademik | ... dst).
  - Isi kolom per opsi: kalau jawaban responden untuk pertanyaan itu = opsi kolom tsb, isi dengan tanda (mis. `"✓"` atau label itu sendiri) — pola ini beda dari `multiple_choice` resolver biasa yang cuma 1 kolom per pertanyaan (baris ~1497-1516); di sini 1 kolom PER OPSI (mirip pola grid/matrix tapi row-nya cuma 1 respons).
- Kalau klasifikasi terpilih = ASPIRASI/SARAN atau PERMINTAAN INFORMASI → pertanyaan yang match cuma Q4 "Uraian Laporan" (`paragraph`), header-nya normal 1 baris (tidak perlu merge/colspan), isi teks jawaban apa adanya.
- Pertanyaan lain di survey yang TIDAK terhubung ke opsi filter terpilih (baik non-conditional questions kalau ada, atau cabang lain) tetap ikut kolom seperti biasa mengikuti resolver default yang sudah ada per tipe (`short_text`/`paragraph`/dll) — hanya cabang conditional yang match filter yang dapat treatment colspan khusus.
- Sesuaikan `headerRowIndex`, `sheet.views` (frozen pane), dan `sheet.autoFilter` yang sudah ada (baris ~1651-1700) supaya tetap benar dengan 2 baris header alih-alih 1 baris.

### 5.4 CSV export
CSV tidak punya konsep merge cell / colspan. Untuk `layanan-pengaduan` di CSV, gabungkan label grup + opsi jadi 1 header string per kolom, contoh: `"Akademik dan Kemahasiswaan — Akademik"`, `"Akademik dan Kemahasiswaan — Kemahasiswaan"`, dst (pola penamaan ini sudah ada presedennya di kode untuk grid row label collision, baris ~1480: `` `${q.title} — ${r.label}` ``, tinggal reuse pola yang sama). Filter question tetap di-skip seperti §5.2.

### 5.5 Jangan sentuh docx report generator
`generateSurveyReportFn` (baris ~1798, pakai `docx-templates`) TIDAK diminta berubah oleh user — fokus perubahan cuma di export CSV/XLSX row-level data. Kalau ada overlap logic (mis. `buildFilterSubtitle`, baris ~1314) yang kepakai bareng, pastikan perubahan di §5 tidak merusak alur docx report yang sudah jalan untuk survey lain.

---

## 6. Urutan pengerjaan yang disarankan

1. Schema + migration (§1)
2. Seeder kategori + survey (§2) — jalankan lokal, cek hasilnya lewat admin panel dulu sebelum lanjut
3. Render conditional di halaman publik (§3) — test isi form manual utk 3 skenario klasifikasi
4. Builder admin: form conditional + preview mode (§4)
5. Export CSV/XLSX kustom (§5) — bandingkan hasil XLSX-nya langsung dengan struktur di file `Layanan_Pengaduan_Fakultas_Kedokteran_Gigi_Universitas_Hasanuddin.xlsx` yang sudah diberikan sebagai acuan visual header (minus kolom Klarifikasi Laporan yang dihapus)

Setiap langkah, jalankan `bun run` type-check / lint sesuai konvensi repo (`biome.json` ada) sebelum lanjut ke langkah berikutnya. Jangan generate migration SQL manual — selalu lewat `drizzle-kit generate`.
