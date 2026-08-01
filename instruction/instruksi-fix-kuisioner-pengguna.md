# Instruksi: Perbaikan Kuisioner Pengguna Lulusan (Grid Label + Single Page)

## Konteks

Survei "Kuisioner Pengguna Lulusan 2025/2026" punya 2 masalah:

1. **Header kolom matrix/grid menampilkan angka (1 2 3 4)**, bukan label
   ("Sangat baik", "Baik", "Cukup", "Kurang").
2. **Form terbagi jadi 4 halaman terpisah** ("Langkah 1 dari 4") karena tiap
   alumni (Alumni 1/3/4/5) diseed sebagai `section` sendiri-sendiri, padahal
   harusnya tampil dalam satu halaman.

Root cause SUDAH dikonfirmasi lewat pembacaan source code langsung
(bukan tebakan) — lihat detail di tiap task di bawah.

Kerjakan **Task 1 dan Task 2 secara berurutan**. Setelah selesai, jalankan
verifikasi di bagian akhir.

---

## Task 1 — Fix render header grid (root cause masalah #1)

**File:** `src/routes/survey.$surveySlug.tsx`

**Root cause:** Pada blok render `{/* MATRIX GRID */}` (tipe soal `"grid"`),
header `<th>` untuk tiap kolom di-hardcode menampilkan `index + 1` (angka
urutan array), bukan `col.label` (teks opsi jawaban yang sebenarnya sudah
tersimpan benar di database lewat seeder).

Cari blok berikut (di dalam kondisi `q.type === "grid"`, bagian `<thead>`):

```tsx
                              {q.options
                                .filter((o) => o.group === "column")
                                .map((col, index) => (
                                  <th
                                    key={col.id}
                                    className="py-3 px-2 text-center text-xs font-bold text-[#434652] uppercase"
                                  >
                                    {index + 1}
                                  </th>
                                ))}
```

Ganti `{index + 1}` menjadi `{col.label}`, sehingga menjadi:

```tsx
                              {q.options
                                .filter((o) => o.group === "column")
                                .map((col) => (
                                  <th
                                    key={col.id}
                                    className="py-3 px-2 text-center text-xs font-bold text-[#434652] uppercase"
                                  >
                                    {col.label}
                                  </th>
                                ))}
```

Catatan: parameter `index` sudah tidak dipakai lagi setelah perubahan ini,
jadi boleh dihapus dari signature `.map()` (lihat contoh di atas) supaya
tidak ada unused-variable warning dari linter/TypeScript.

**Jangan ubah bagian lain** dari file ini (validasi, stepper, handler grid,
dll) — hanya blok `<thead>` pada render grid ini yang perlu disentuh.

---

## Task 2 — Gabungkan 4 section alumni jadi 1 section (root cause masalah #2)

**File:** `src/server/db/seed-kuisioner-pengguna.ts`

**Root cause:** Halaman survey (`survey.$surveySlug.tsx`) memakai jumlah
`sections` sebagai jumlah langkah/halaman (`currentSectionIndex`,
`"Langkah X dari Y"`). Seeder saat ini membuat **1 section per blok alumni**
(4 section total: "Alumni 1", "Alumni 3", "Alumni 4", "Alumni 5") di dalam
loop `for (const block of ALUMNI_BLOCKS)`, sehingga form otomatis terbagi 4
halaman. Solusinya: buat **hanya 1 section** untuk seluruh survei, lalu
tempatkan semua pertanyaan (12 pertanyaan: 4 blok × 3 pertanyaan) di
dalamnya secara berurutan. Label "Alumni 1/3/4/5" dipindah ke **judul tiap
pertanyaan** supaya responden tetap tahu itu penilaian untuk alumni yang
mana, walau sudah dalam satu halaman.

### 2a. Ganti bagian pembuatan section + pertanyaan

Cari blok ini (dimulai dari komentar `// 5. Create one section per alumnus
block...`):

```ts
  let sectionOrder = 0;
  for (const block of ALUMNI_BLOCKS) {
    const [secInsert] = await db.insert(sections).values({
      surveyId,
      title: block.label,
      description: `Data dan penilaian untuk ${block.label}.`,
      order: sectionOrder++,
    });
    const sectionId = (secInsert as any).insertId;

    let qOrder = 0;

    // Nama Alumni (short_text)
    const [namaInsert] = await db.insert(questions).values({
      surveyId,
      sectionId,
      type: "short_text",
      title: `Nama ${block.label}`,
      required: block.required,
      order: qOrder++,
    });
```

Ganti seluruh blok loop tersebut (dari `let sectionOrder = 0;` sampai akhir
`for (const block of ALUMNI_BLOCKS) { ... }`, termasuk bagian "Lama kerja"
dan "Kriteria Penilaian" grid di dalamnya) menjadi:

```ts
  // Satu section untuk seluruh survei — semua alumni tampil di 1 halaman
  // (sections dipakai sebagai jumlah "langkah" pada survey.$surveySlug.tsx,
  // jadi 1 section = 1 halaman, tidak ada lagi stepper per-alumni).
  const [secInsert] = await db.insert(sections).values({
    surveyId,
    title: "Penilaian Alumni",
    description:
      "Data dan penilaian kompetensi untuk setiap alumni yang bekerja di instansi Anda.",
    order: 0,
  });
  const sectionId = (secInsert as any).insertId;

  let qOrder = 0;

  for (const block of ALUMNI_BLOCKS) {
    // Nama Alumni (short_text)
    const [namaInsert] = await db.insert(questions).values({
      surveyId,
      sectionId,
      type: "short_text",
      title: `Nama ${block.label}`,
      required: block.required,
      order: qOrder++,
    });
```

### 2b. Perbaiki judul "Lama kerja" dan "Kriteria Penilaian" supaya menyebut nama alumni

Masih di dalam loop yang sama, cari:

```ts
    // Lama kerja (multiple_choice, 5 options)
    const [lamaInsert] = await db.insert(questions).values({
      surveyId,
      sectionId,
      type: "multiple_choice",
      title: "Lama kerja alumni FKG Unhas yang ada di instansi anda",
      required: block.required,
      order: qOrder++,
    });
```

Ganti `title` menjadi (tambahkan label alumni di akhir):

```ts
      title: `Lama kerja ${block.label} di instansi Anda`,
```

Lalu cari:

```ts
    const [gridInsert] = await db.insert(questions).values({
      surveyId,
      sectionId,
      type: "grid",
      title: "Kriteria Penilaian",
      required: block.required,
      order: qOrder++,
      config: { rowsRequired: block.required },
    });
```

Ganti `title` menjadi:

```ts
      title: `Kriteria Penilaian — ${block.label}`,
```

### 2c. Tutup loop dengan benar

Pastikan tanda kurung kurawal penutup loop `for (const block of ALUMNI_BLOCKS) { ... }` tetap ada persis di akhir (setelah blok `builtQuestions.push({ id: gridQuestionId, kind: "kriteria_grid", ... })`), dan **hapus** baris log lama yang menyebut section per alumni bila ada duplikasi. Baris log berikut (di luar loop, setelah `}`) tidak perlu diubah:

```ts
  console.log(
    `⚙️ Created ${builtQuestions.length} questions across ${ALUMNI_BLOCKS.length} sections`,
  );
```

Ganti jadi lebih akurat (opsional tapi disarankan, karena sekarang cuma 1 section):

```ts
  console.log(
    `⚙️ Created ${builtQuestions.length} questions in 1 section, covering ${ALUMNI_BLOCKS.length} alumni blocks`,
  );
```

---

## Verifikasi

1. `bun run db:seed-kuisioner-pengguna` — pastikan tidak ada error, dan log
   akhir menunjukkan 1 section (bukan 4).
2. Jalankan dev server, buka halaman isi survei
   (`/survey/kuisioner-pengguna-2025-2026`):
   - Header kolom matrix harus menampilkan **"Sangat baik / Baik / Cukup /
     Kurang"**, bukan angka.
   - Tidak ada lagi indikator "Langkah X dari 4" — seluruh 4 alumni (Nama +
     Lama kerja + Kriteria Penilaian) tampil dalam **satu halaman scroll**.
   - Judul tiap blok kriteria penilaian menyebut alumni yang sesuai
     (mis. "Kriteria Penilaian — Alumni 3").
3. Cek halaman admin/laporan survei ini juga menampilkan label yang benar
   (bukan angka) untuk kolom grid — kalau ternyata halaman admin punya
   komponen render grid terpisah dari `survey.$surveySlug.tsx` dan masih
   menampilkan angka, itu perlu fix terpisah (beri tahu saya file-nya).
