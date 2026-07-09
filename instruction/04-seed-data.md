# Instruksi: Seed Data Asli di VPS

## 0. Temuan penting — baca dulu sebelum eksekusi apapun

`src/server/db/seed.ts` saat ini **BUKAN** importer "seluruh data asli". Berdasarkan cara kerjanya dan dikonfirmasi oleh `instruction/02-database-schema.md` §5.1:

1. Untuk tiap survey di array `surveysToSeed`, script mencari file di folder `../cleaned/<nama-file>.csv` (relatif terhadap root project, artinya folder `cleaned` ada **satu level di atas** folder project di VPS).
2. Dari file itu, HANYA baris data PERTAMA setelah header (`cleanedLines[cleanedHeaderIdx + 1]`) yang dipakai sebagai 1 response asli.
3. Folder `../data-asli/<nama-file>.csv` dipakai hanya untuk mengekstrak **daftar nilai unik per kolom** (dipakai sebagai pilihan jawaban dropdown/pilihan ganda) — bukan untuk mengimpor semua barisnya sebagai response.
4. Sisa response (25–45 per survey, random) di-generate pakai `@faker-js/faker` — nama, email, dan jawaban acak (walau dibobotkan mendekati pola nilai asli).
5. Di awal proses, script **MENGHAPUS SEMUA ISI TABEL** (`users`, `surveys`, `sections`, `questions`, `question_options`, `responses`, `answers`) tanpa konfirmasi apapun, sebelum menulis ulang dari nol.

**Konsekuensi:** kalau Anda punya file CSV ekspor asli (dari Google Forms misalnya) yang berisi puluhan/ratusan baris respons nyata dan ingin SEMUANYA masuk ke database — bukan cuma 1 baris + isian Faker — Anda **wajib memodifikasi `seed.ts` dulu** (lihat Bagian 3). Kalau Anda hanya punya 1 baris data asli per survey (seperti kondisi awal project ini) dan memang cukup dengan itu + data sintetis sebagai pengisi demo, script yang ada sudah cukup dan bisa langsung dipakai (lompat ke Bagian 2).

---

## 1. Persiapan struktur folder & environment di VPS

### 1.1 Struktur direktori yang dibutuhkan

Berdasarkan `seed.ts`:

```ts
const rootDir = process.cwd();
const cleanedDir = resolve(rootDir, "../cleaned");
const asliDir = resolve(rootDir, "../data-asli");
```

`process.cwd()` = folder project saat `bun run db:seed` dijalankan. Maka struktur di VPS harus:

```
/path/ke/parent/
├── cleaned/
│   ├── form kepuasan dosen fkg (Responses).csv
│   ├── Form Kepuasan Pegawai (Responses).csv
│   ├── Kuesioner Mahasiswa terhadap Pengelola FKG - UNHAS (Responses).csv
│   ├── Kuisioner Pengguna (Responses).csv
│   ├── Copy of Kuisioner Pengguna (Responses).csv
│   ├── Form Kepuasan Mahasiswa (Responses).csv
│   ├── Form Kepuasan Mahasiswa 2025 (Responses).csv
│   ├── Form Kepuasan Mahasiswa Rev (Responses).csv
│   └── Kusioner Alumni (Responses).csv
├── data-asli/
│   └── (9 file dengan nama SAMA PERSIS seperti di atas)
└── <folder-project-ini>/        ← ini root project (tempat package.json berada)
    ├── src/
    ├── package.json
    └── ...
```

**Nama file harus sama persis** (termasuk spasi, huruf besar/kecil, tanda kurung) dengan yang tertulis di `surveysToSeed` (`src/server/db/seed.ts` baris ~104–163) — kalau tidak, script akan `console.error` dan skip survey tersebut secara diam-diam (tidak crash, tapi survey itu tidak akan ter-seed).

Upload kedua folder (`cleaned` dan `data-asli`) ke VPS di lokasi yang tepat (satu level di atas folder project) via `scp`/`rsync`/SFTP.

### 1.2 Environment variable database

Dari `src/server/db/index.ts`:

```ts
const poolConnection = mysql.createPool({ uri: process.env.DATABASE_URL });
```

Pastikan di VPS ada `DATABASE_URL` yang valid, contoh format (lihat komentar di `drizzle.config.ts`):

```
DATABASE_URL="mysql://<user>:<password>@localhost:3306/<nama_database>"
```

Set ini di file `.env` di root project (pastikan project sudah load `.env`, cek apakah ada `dotenv`/`bun --env-file` di setup — kalau belum ada mekanisme load env, tambahkan `bun run --env-file=.env ...` atau load manual), **atau** export sebagai environment variable sebelum menjalankan perintah, **atau** tambahkan di `ecosystem.config.cjs` pada blok `env_production` (saat ini `DATABASE_URL` belum ada di sana — perlu ditambahkan supaya PM2 juga meneruskannya ke proses runtime aplikasi, bukan cuma saat migrate/seed manual).

Pastikan juga:

- Database MySQL dengan nama yang sesuai `DATABASE_URL` sudah dibuat di server (`CREATE DATABASE <nama_database>;`).
- User MySQL yang dipakai punya hak akses penuh ke database tersebut.

### 1.3 Install dependencies & migrasi schema

Di root project, di VPS:

```bash
bun install
bun run db:generate   # hanya perlu jika ada perubahan schema.ts yang belum di-generate
bun run db:migrate
```

Ini akan membuat seluruh tabel (`users`, `surveys`, `sections`, `questions`, `question_options`, `responses`, `answers`) sesuai `drizzle/0000_brave_pixie.sql` (dan migration baru lain jika ada).

---

## 2. Menjalankan seed (kondisi: cukup dengan skrip yang ada)

Jika Anda memang hanya punya 1 baris data asli per survey (kondisi bawaan project) dan itu cukup:

```bash
bun run db:seed
```

**PERINGATAN KERAS:** perintah ini akan **menghapus seluruh isi tabel** sebelum mengisi ulang. Jangan pernah menjalankan ini di VPS produksi setelah aplikasi sudah dipakai oleh pengguna sungguhan (responden sudah mulai mengisi survey) — semua data yang sudah masuk akan hilang permanen tanpa backup otomatis. Sebelum menjalankan di VPS:

- Pastikan ini benar-benar **inisialisasi pertama kali** database produksi, ATAU
- Ambil backup dulu: `mysqldump -u <user> -p <nama_database> > backup-sebelum-seed-$(date +%Y%m%d%H%M).sql`

Setelah seed selesai, login dengan kredensial yang di-hardcode di `seed.ts`:

- Admin: `admin` / `_Admin123_`
- Visitor: `visitor` / `visitor123`

**Segera ganti password ini setelah seed pertama di produksi** (tidak ada mekanisme ganti password otomatis di script — perlu update manual via `db:studio` atau tambahkan fitur ganti password jika belum ada di halaman admin).

---

## 3. Jika Anda punya SEMUA data asli (bukan cuma 1 baris) dan ingin semuanya masuk

Modifikasi `src/server/db/seed.ts` sebelum dijalankan di VPS:

### 3.1 Ganti sumber "cleaned" jadi file CSV lengkap

Pastikan file-file di `../cleaned/` yang Anda upload memang berisi SEMUA baris respons asli (bukan versi 1-baris yang dipakai untuk demo). Kalau data asli lengkap Anda justru ada di `../data-asli/`, sesuaikan agar `cleanedDir` menunjuk ke situ juga, atau satukan logikanya.

### 3.2 Ubah bagian "G. Insert the 1 Real Response row" (sekitar baris 330–360)

Kode saat ini:

```ts
const cleanedRow = parseCSVLine(cleanedLines[cleanedHeaderIdx + 1]);
// ...
const [respInsert] = await db.insert(responses).values({ ... });
const realResponseId = (respInsert as any).insertId;
const realAnswerRows = questionsList.map((q) => ({
  responseId: realResponseId,
  ...formatAnswer(q, cleanedRow),
}));
await db.insert(answers).values(realAnswerRows);
```

Ganti jadi loop atas SEMUA baris data (bukan cuma 1 baris `cleanedHeaderIdx + 1`), pola:

```ts
const allDataRows = cleanedLines
  .slice(cleanedHeaderIdx + 1)
  .filter((l) => l !== "")
  .map((l) => parseCSVLine(l));

for (const row of allDataRows) {
  let rowTimestamp = new Date();
  const tsStr = row[0]?.trim();
  if (tsStr) {
    const parsed = new Date(tsStr);
    if (!Number.isNaN(parsed.getTime())) rowTimestamp = parsed;
  }

  const [respInsert] = await db.insert(responses).values({
    surveyId,
    status: "completed",
    startedAt: new Date(rowTimestamp.getTime() - 10 * 60 * 1000),
    submittedAt: rowTimestamp,
    clientDraftId: faker.string.uuid(),
  });
  const responseId = (respInsert as any).insertId;

  const answerRows = questionsList.map((q) => ({
    responseId,
    ...formatAnswer(q, row),
  }));
  await db.insert(answers).values(answerRows);
}
console.log(`📥 Seeded ${allDataRows.length} real responses for ${sDef.title}`);
```

### 3.3 Matikan atau kurangi drastis data sintetis

Karena sekarang datanya sudah nyata semua, bagian "H. Generate 20-60 Synthetic Responses" sebaiknya **dihapus sepenuhnya** untuk produksi, atau dibuat opsional lewat environment variable, misalnya:

```ts
const shouldSeedSynthetic = process.env.SEED_SYNTHETIC === "true";
if (shouldSeedSynthetic) {
  // ...blok generate synthetic yang sudah ada...
}
```

Supaya default-nya (tanpa `SEED_SYNTHETIC=true`) hanya data asli yang masuk, tidak tercampur data karangan Faker — penting karena laporan/analytics di halaman admin (`admin/analytics.tsx`) akan menghitung data palsu ini seolah-olah respons sungguhan kalau tidak dimatikan.

### 3.4 Perhatikan performa untuk dataset besar

Loop `await db.insert(...)` satu-per-satu untuk ratusan/ribuan baris bisa lambat. Kalau jumlah baris asli besar (>500 per survey), pertimbangkan:

- Bungkus loop per survey dalam satu `db.transaction(async (tx) => { ... })` seperti pola yang sudah dipakai di bagian synthetic (mempercepat commit).
- Batch insert `answers` per response (sudah begitu — `db.insert(answers).values(answerRows)` per response, ini cukup wajar).

### 3.5 Validasi sebelum full-run

Sebelum menjalankan ke seluruh dataset asli di VPS, uji dulu di environment lokal/staging dengan salinan database terpisah (`DATABASE_URL` mengarah ke DB temporary), untuk memastikan:

- Semua baris CSV asli berhasil ter-parse tanpa error (`parseCSVLine` cukup sederhana — CSV dengan koma di dalam teks bebas/paragraf yang tidak diapit tanda kutip ganda bisa salah parse; cek manual beberapa baris "paragraph"/teks bebas).
- Jumlah `responses` yang ter-insert sama dengan jumlah baris di CSV asli (`SELECT survey_id, COUNT(*) FROM responses GROUP BY survey_id;`).
- Tidak ada `answers.value_grid` atau `value_option_ids` yang kosong secara tidak wajar akibat mismatch label pilihan (function `formatAnswer` melakukan fallback ke opsi index tertentu kalau nilai CSV tidak persis cocok dengan label pilihan yang terdeteksi — cek log/`console.error` untuk mismatch semacam ini kalau ingin ditambahkan).

---

## 4. Verifikasi setelah seeding di VPS

```bash
bun run db:studio
```

Buka Drizzle Studio (biasanya expose lewat tunnel/port forwarding karena ini VPS — cek dokumentasi `drizzle-kit studio` untuk opsi `--host`/`--port` agar bisa diakses dari luar, atau jalankan via SSH tunnel: `ssh -L 4983:localhost:4983 user@vps`), lalu cek:

- Jumlah baris di `surveys` sesuai jumlah survey yang diharapkan (9, sesuai `surveysToSeed`, kecuali ada yang di-skip karena file tidak ditemukan — cek log terminal saat seeding untuk pesan `❌`).
- Jumlah `responses` per survey sesuai jumlah baris asli di CSV masing-masing.
- Login ke aplikasi (`/login`) dengan akun admin, cek halaman "Kelola Survey" dan "Analytics" menampilkan angka yang masuk akal (bukan angka aneh dari campuran data Faker jika Bagian 3.3 sudah diterapkan).

Terakhir, jalankan/reload PM2 untuk memastikan aplikasi runtime memakai `DATABASE_URL` yang sama:

```bash
pm2 reload scratch --update-env
pm2 logs scratch
```
