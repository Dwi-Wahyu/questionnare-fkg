# Instruksi Implementasi — Survey Module

Konteks: source code diambil dari graph report (`267 nodes · 521 edges`, commit `a6346d77`), stack TanStack Start + Drizzle + MySQL + shadcn chart (recharts). Sudah diverifikasi terhadap source code asli (`src.zip`), bukan asumsi.

**ATURAN WAJIB:** setiap kali ada perubahan pada `src/server/db/schema.ts`, jalankan setelah edit:

```bash
bun run db:generate
bun run db:migrate
```

Urutan pengerjaan disusun agar dependensi antar poin tidak saling menabrak. Kerjakan sesuai urutan bab.

---

## BAB 0 — Perbaikan Bug Tersembunyi (prasyarat wajib untuk BAB 3 & 5)

`questions.config` (kolom JSON) **sudah ada di schema** tapi ternyata **tidak pernah diteruskan** oleh `updateAdminSurveyQuestionsFn`. Tanpa fix ini, flag "Jawaban Unik" di BAB 3 tidak akan pernah tersimpan ke DB. Tidak perlu migrasi (kolom sudah ada), hanya perbaikan kode.

### `src/server/adminSurveyFunctions.ts`

Di dalam validator `updateAdminSurveyQuestionsFn`, tambahkan field `config` pada tipe object di array `questions`:

```ts
questions: {
  id?: number;
  sectionOrder: number;
  type: "short_text" | "paragraph" | "multiple_choice" | "checkboxes" | "dropdown" | "linear_scale" | "grid" | "date";
  title: string;
  description?: string;
  required: boolean;
  order: number;
  config?: Record<string, unknown> | null; // TAMBAHAN
  options?: { id?: number; group: "choice" | "row" | "column"; label: string; order: number }[];
}[];
```

Di dalam handler, pada blok update (`q.id` ada) dan insert (`q.id` tidak ada), tambahkan `config: q.config ?? null,` pada `.set({...})` dan `.values({...})` question — sejajar dengan field `required`.

### `src/routes/admin/surveys.$surveyId.tsx`

Di `handleSaveQuestions`, pada `questionsPayload` map, tambahkan field:

```ts
config: q.config ?? null,
```

sejajar dengan `required: !!q.required,`.

---

## BAB 1 — Skema: Target Jumlah Responden

Diperlukan untuk progress bar pengisian survei (BAB 4). Ini **satu-satunya** perubahan skema pada dokumen ini.

### `src/server/db/schema.ts`

Tambahkan kolom baru pada `mysqlTable("surveys", ...)`, setelah `periodValueEnd`:

```ts
// Target jumlah responden untuk menghitung progress pengisian (opsional).
targetRespondentCount: int("target_respondent_count"),
```

Jalankan:

```bash
bun run db:generate
bun run db:migrate
```

### `src/server/adminSurveyFunctions.ts`

Tambahkan `targetRespondentCount?: number | null;` ke validator `createAdminSurveyFn` dan `updateAdminSurveySettingsFn`, lalu masukkan ke `.values({...})` / `.set({...})`:

```ts
targetRespondentCount: data.targetRespondentCount ?? null,
```

### UI form (2 tempat)

1. `src/routes/admin/surveys.new.tsx` — tambahkan state `targetRespondentCount` + input number opsional di bawah blok "Periode Survei", kirim di payload `createAdminSurveyFn`.
2. `src/routes/admin/surveys.$surveyId.tsx` tab **Settings** (sekitar baris 2618, setelah blok periode) — tambahkan field sama:

```tsx
<div className="flex flex-col gap-1.5">
  <label className="text-sm font-bold text-[#1a1b21]">
    Target Jumlah Responden (Opsional)
  </label>
  <input
    type="number"
    min={0}
    value={settingsTargetRespondentCount ?? ""}
    onChange={(e) =>
      setSettingsTargetRespondentCount(
        e.target.value === "" ? null : Number(e.target.value),
      )
    }
    className="w-full sm:w-56 bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-sm text-[#1a1b21] focus:border-[#002972] outline-none"
    placeholder="mis. 150"
    disabled={isSavingSettings || user?.role === "visitor"}
  />
  <p className="text-xxs text-[#747683] italic">
    Dipakai untuk menghitung progress pengisian kuesioner. Kosongkan jika tidak
    ingin melacak target.
  </p>
</div>
```

Tambahkan state `settingsTargetRespondentCount` (init dari `detail.survey.targetRespondentCount`) dan sertakan di payload `handleSaveSettings`.

---

## BAB 2 — Chart Dinamis Dikelompokkan per Bagian (Dosen / Tenaga Pendidik / Sarpras)

Target: tab **Jawaban → Ringkasan**, `src/routes/admin/surveys.$surveyId.tsx` (sekitar baris 1780–1793, blok "Visual Charts list").

**Objektif perubahan:** saat ini `activeStats.stats` dirender sebagai list flat satu `ChartCard` di bawah yang lain. Ubah jadi: kelompokkan stat berdasarkan `sectionId` pertanyaan (section = "Bagian" pada survei, judulnya bebas ditulis admin — misalnya "Dosen", "Tenaga Pendidik", "Sarpras", dll — tidak di-hardcode nama section, dibaca dinamis dari `detail.sections`). Setiap grup jadi satu card container berjudul nama bagian tersebut, isinya semua chart pertanyaan di bagian itu (stack vertikal di dalam card). Semua card grup ditata dalam grid responsif: 1 kolom di layar sempit, **2 kolom di breakpoint `md`**.

Ganti blok:

```tsx
{
  /* Visual Charts list */
}
<div className="space-y-6">
  {activeStats.stats
    .filter((stat: any) => !stat.redacted)
    .map((stat: any) => (
      <ChartCard
        key={stat.questionId}
        stat={stat}
        responseCount={activeStats.responseCount}
        isExporting={isExporting}
      />
    ))}
</div>;
```

Dengan:

```tsx
{
  /* Visual Charts — dikelompokkan per Bagian, responsif 2 kolom di md+ */
}
{
  (() => {
    const sortedSections = [...(detail.sections || [])].sort(
      (a: any, b: any) => a.order - b.order,
    );
    const questionSectionMap = new Map(
      (detail.questions || []).map((q: any) => [q.id, q.sectionId]),
    );
    const visibleStats = activeStats.stats.filter((s: any) => !s.redacted);

    const groups = sortedSections
      .map((sec: any) => ({
        section: sec,
        stats: visibleStats.filter(
          (s: any) => questionSectionMap.get(s.questionId) === sec.id,
        ),
      }))
      .filter((g) => g.stats.length > 0);

    // Stat "virtual" (mis. distribusi angkatan hasil turunan NIM, lihat BAB 3)
    // tidak terikat sectionId — tampilkan di luar grid, di atasnya.
    const ungroupedStats = visibleStats.filter(
      (s: any) => !questionSectionMap.has(s.questionId),
    );

    return (
      <div className="space-y-6">
        {ungroupedStats.map((stat: any) => (
          <ChartCard
            key={stat.questionId}
            stat={stat}
            responseCount={activeStats.responseCount}
            isExporting={isExporting}
          />
        ))}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {groups.map(({ section, stats }) => (
            <div
              key={section.id}
              className="bg-white rounded-xl border border-[#c4c6d4] shadow-sm overflow-hidden"
            >
              <div className="bg-[#eeedf6] px-5 py-3 border-b border-[#c4c6d4]">
                <h3 className="font-bold text-sm text-[#002972]">
                  {section.title}
                </h3>
                {section.description && (
                  <p className="text-xs text-[#747683] mt-0.5">
                    {section.description}
                  </p>
                )}
              </div>
              <div className="p-5 space-y-6">
                {stats.map((stat: any) => (
                  <ChartCard
                    key={stat.questionId}
                    stat={stat}
                    responseCount={activeStats.responseCount}
                    isExporting={isExporting}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  })();
}
```

Tidak perlu perubahan backend untuk bab ini — `detail.questions[].sectionId` dan `detail.sections[].title` sudah tersedia dari `getAdminSurveyDetailFn` yang sudah ter-load di komponen yang sama.

Catatan penamaan bagian: karena "Dosen", "Tenaga Pendidik", "Sarpras" adalah judul **Bagian (section)** yang diisi admin sendiri saat membuat pertanyaan (tab Pertanyaan → "Tambah Bagian Baru"), tidak perlu logika deteksi kata kunci apa pun — cukup pastikan admin menamai section sesuai kategori tersebut saat menyusun survei baru.

---

## BAB 3 — Bar Chart Persentase Responden per Angkatan (dari NIM) + Progress Bar Pengisian

### 3.1 Backend: turunkan angkatan dari NIM bila tidak ada pertanyaan "Angkatan" eksplisit

Aturan NIM (`peraturan-nim.md`): format `F PPP YY NNN` (10 digit). Digit ke-5 dan ke-6 (index string 4–5) = 2 digit tahun masuk/angkatan.

Edit `computeSurveyStats` di `src/server/adminSurveyFunctions.ts`. Tambahkan helper di atas fungsi tersebut:

```ts
// Ekstrak angkatan dari NIM sesuai peraturan-nim.md: format F PPP YY NNN (10 digit),
// digit ke-5–6 (index 4–5) = 2 digit tahun masuk. "24" -> "2024".
function extractAngkatanFromNim(nim: string | null | undefined): string | null {
  if (!nim) return null;
  const clean = nim.trim();
  if (!/^[A-Za-z]\d{9}$/.test(clean)) return null;
  const yy = clean.slice(4, 6);
  const yearNum = Number(yy);
  if (Number.isNaN(yearNum)) return null;
  // Heuristik abad: asumsikan NIM Unhas dimulai era 2000-an.
  return `20${yy}`;
}
```

Di akhir `computeSurveyStats`, sebelum `return { stats, ... }`, sisipkan logika berikut (setelah variabel `stats` selesai dihitung dari `surveyQuestions.map(...)`):

```ts
// Distribusi Angkatan: pakai pertanyaan "Angkatan" eksplisit jika ada,
// jika tidak ada, turunkan dari pertanyaan NIM (lihat peraturan-nim.md).
const hasAngkatanQuestion = surveyQuestions.some((q) =>
  q.title?.toLowerCase().includes("angkatan"),
);
const nimQuestion = surveyQuestions.find((q) =>
  q.title?.toLowerCase().includes("nim"),
);

if (!hasAngkatanQuestion && nimQuestion && userRole === "admin") {
  const nimAnswers = scopedAnswers.filter(
    (a) => a.questionId === nimQuestion.id,
  );
  const angkatanCounts: Record<string, number> = {};
  nimAnswers.forEach((a) => {
    const angkatan = extractAngkatanFromNim(a.valueText);
    if (angkatan)
      angkatanCounts[angkatan] = (angkatanCounts[angkatan] || 0) + 1;
  });
  const total = nimAnswers.length;
  if (total > 0) {
    stats.push({
      questionId: -1, // stat virtual, tidak terikat pertanyaan manapun
      title: "Distribusi Angkatan (diturunkan dari NIM)",
      type: "short_text",
      data: Object.entries(angkatanCounts)
        .map(([label, count]) => ({
          label,
          count,
          percentage: Math.round((count / total) * 100),
        }))
        .sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { numeric: true }),
        ),
    } as any);
  }
}
```

Lalu perluas `pickChartKind` di `src/routes/admin/surveys.$surveyId.tsx` agar stat ini otomatis dirender sebagai bar chart (mengikuti pola stat "tahun masuk" yang sudah ada):

```ts
if (
  stat.title?.toLowerCase().includes("tahun masuk") ||
  stat.title?.toLowerCase().includes("angkatan")
) {
  return "bar-vertical";
}
```

Stat ini punya `questionId: -1` sehingga otomatis masuk ke `ungroupedStats` pada BAB 2 (tidak match `sectionId` manapun) dan tampil di atas grid grup — sesuai karena ini metrik level-survei, bukan per bagian.

**Catatan penting:** stat ini sengaja hanya dihitung untuk `userRole === "admin"` (bukan `visitor`) karena NIM adalah data pribadi (section pertama/`isPersonalInfoQuestion`) — konsisten dengan pola redaksi yang sudah ada di file ini.

### 3.2 Progress Bar Pengisian Survei (target ≥80–85% = baik)

Tambahkan card baru di tab **Ringkasan**, sejajar dengan card "Total Jawaban" / "Status Pengumpulan" (baris ±1740–1778). Butuh `detail.survey.targetRespondentCount` dari BAB 1.

```tsx
{
  detail.survey.targetRespondentCount != null &&
    detail.survey.targetRespondentCount > 0 &&
    (() => {
      const target = detail.survey.targetRespondentCount;
      const count = activeStats.responseCount ?? detail.responseCount;
      const pct = Math.min(100, Math.round((count / target) * 100));
      const isGood = pct >= 80;
      const barColor =
        pct >= 85
          ? "bg-emerald-600"
          : pct >= 80
            ? "bg-amber-500"
            : "bg-[#0b3e9c]";
      return (
        <div className="bg-white rounded-xl p-6 border border-[#c4c6d4] shadow-sm md:col-span-2 lg:col-span-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#434652] uppercase tracking-wider">
              Progress Pengisian Survei
            </span>
            <span className="text-sm font-bold text-[#1a1b21]">
              {count} / {target} ({pct}%)
            </span>
          </div>
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {isGood ? (
            <p className="text-xs font-semibold text-emerald-700 mt-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">
                check_circle
              </span>
              Partisipasi sudah mencapai ambang baik (≥80%).
            </p>
          ) : (
            <p className="text-xs font-semibold text-amber-700 mt-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">warning</span>
              Partisipasi masih di bawah ambang baik (80–85%). Perlu dorongan
              pengisian lebih lanjut.
            </p>
          )}
        </div>
      );
    })();
}
```

Tempatkan di dalam grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` yang sudah ada agar full-width (pakai `md:col-span-2 lg:col-span-3` seperti di atas).

---

## BAB 4 — Kategori Survei (4 Jenis) — Catatan Desain, Bukan Migrasi Wajib

`surveys.category` sudah berupa `varchar(100)` bebas (bukan enum), jadi **tidak perlu migrasi skema** untuk menambah jenis baru — cukup tambah `<option>` di 3 tempat UI:

1. `src/routes/admin/surveys.new.tsx` (baris ±189)
2. `src/routes/admin/surveys.$surveyId.tsx` tab Settings (baris ±2549)
3. `src/routes/admin/analytics.tsx` filter dropdown (baris ±122) + logic `showTracer`/`showKepuasan`

Value yang sudah dipakai di data existing **jangan diganti** (`tracer`, `kepuasan`) supaya data lama tidak orphan. Tambahkan value baru:

```tsx
<option value="tracer">Tracer Study Alumni</option>
<option value="kepuasan">Survei Kepuasan Mahasiswa (Internal)</option>
<option value="pengguna">Survei Pengguna Layanan</option>
<option value="lainnya">Lainnya</option>
```

Kategori ke-4 ("masih abu-abu") sengaja diberi value generik `lainnya` sebagai placeholder — **putuskan nama & definisinya sebelum implementasi final**, karena taxonomy kategori ini murni untuk pengelompokan dropdown navigasi admin (PRD §6.5, lihat komentar di `schema.ts` baris 37), tidak memengaruhi logika bisnis lain di dokumen ini (fitur NIM unik & progress bar di BAB 3/5 bekerja independen dari kategori, berbasis judul pertanyaan & flag per-pertanyaan).

---

## BAB 5 — NIM Wajib & Unik per Survei (Survei Kepuasan Mahasiswa Internal)

Desain: **bukan** fitur khusus kategori survei, melainkan flag generik per-pertanyaan (`config.uniqueAnswer`) supaya bisa dipakai di survei manapun yang butuh identitas unik (NIM, email, dsb), tidak cuma "kepuasan".

### 5.1 Wajib diisi

Cukup admin centang "Wajib Diisi" pada pertanyaan NIM di tab Pertanyaan (fitur `required` sudah ada & sudah divalidasi di `survey.$surveySlug.tsx` → `validateSection`). Tidak ada kode baru.

### 5.2 Toggle "Jawaban Unik" di editor pertanyaan

`src/routes/admin/surveys.$surveyId.tsx`, sejajar dengan checkbox "Wajib Diisi" (baris ±1481–1496), tambahkan (hanya relevan untuk tipe `short_text`):

```tsx
{
  q.type === "short_text" && (
    <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
      <span>Jawaban Unik (mis. NIM)</span>
      <input
        type="checkbox"
        checked={!!q.config?.uniqueAnswer}
        onChange={(e) =>
          handleQuestionFieldChange(q.id, "config", {
            ...(q.config || {}),
            uniqueAnswer: e.target.checked,
          })
        }
        className="rounded border-slate-300 text-[#002972] focus:ring-[#002972] h-4 w-4"
        disabled={user?.role === "visitor"}
      />
    </label>
  );
}
```

Butuh BAB 0 (fix passthrough `config`) agar toggle ini benar-benar tersimpan.

### 5.3 Validasi unik di server saat submit

`src/server/surveyFunctions.ts`, di dalam `submitResponseFn`, **sebelum** blok `return await db.transaction(...)`, tambahkan pengambilan pertanyaan unik:

```ts
const uniqueQuestions = await db
  .select({
    id: questions.id,
    title: questions.title,
    config: questions.config,
  })
  .from(questions)
  .where(eq(questions.surveyId, data.surveyId));

const uniqueQuestionIds = new Set(
  uniqueQuestions
    .filter((q) => (q.config as any)?.uniqueAnswer === true)
    .map((q) => q.id),
);
```

Lalu di dalam transaksi, **sebelum** insert jawaban baru (setelah blok cari/insert `responseId`, sebelum `await tx.insert(answers)...`), tambahkan pengecekan duplikat per pertanyaan unik:

```ts
for (const a of data.answers) {
  if (!uniqueQuestionIds.has(a.questionId)) continue;
  const value = (a.valueText || "").trim();
  if (!value) continue;

  const [dup] = await tx
    .select({ id: answers.id })
    .from(answers)
    .innerJoin(responses, eq(answers.responseId, responses.id))
    .where(
      and(
        eq(answers.questionId, a.questionId),
        eq(responses.surveyId, data.surveyId),
        eq(responses.status, "completed"),
        sql`${answers.valueText} = ${value}`,
      ),
    );

  // Izinkan jika duplikat itu adalah response yang sedang di-overwrite sendiri (draft yang sama)
  if (dup && dup.id !== undefined) {
    const [dupResponse] = await tx
      .select({ responseId: answers.responseId })
      .from(answers)
      .where(eq(answers.id, dup.id));
    if (!dupResponse || dupResponse.responseId !== responseId) {
      throw new Error(
        "NIM ini sudah pernah mengirimkan jawaban untuk survei ini. Setiap NIM hanya dapat mengisi satu kali.",
      );
    }
  }
}
```

Frontend (`src/routes/survey.$surveySlug.tsx`) sudah menangkap error dari `submitResponseFn` secara generik (catch + tampilkan pesan) — pastikan pesan error di atas tampil apa adanya ke pengguna, tidak perlu perubahan tambahan di sana kecuali ingin styling khusus.

---

## BAB 6 — Fitur Edit Respon (Admin) di Tab Jawaban → Individual

### 6.1 Server function baru

`src/server/adminSurveyFunctions.ts`, tambahkan setelah `getAdminSurveyResponseDetailFn`:

```ts
export const updateAdminSurveyResponseFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      surveyId: number;
      responseId: number;
      answers: {
        questionId: number;
        valueText?: string | null;
        valueOptionIds?: number[] | null;
        valueGrid?: Record<string, number> | null;
      }[];
    }) => data,
  )
  .handler(async ({ data }) => {
    await assertAdmin();

    const [response] = await db
      .select()
      .from(responses)
      .where(
        and(
          eq(responses.id, data.responseId),
          eq(responses.surveyId, data.surveyId),
          eq(responses.status, "completed"),
        ),
      );
    if (!response) throw new Error("Respon tidak ditemukan");

    // Validasi jawaban unik (config.uniqueAnswer), kecualikan respon ini sendiri
    const surveyQuestions = await db
      .select({ id: questions.id, config: questions.config })
      .from(questions)
      .where(eq(questions.surveyId, data.surveyId));
    const uniqueQuestionIds = new Set(
      surveyQuestions
        .filter((q) => (q.config as any)?.uniqueAnswer === true)
        .map((q) => q.id),
    );

    for (const a of data.answers) {
      if (!uniqueQuestionIds.has(a.questionId)) continue;
      const value = (a.valueText || "").trim();
      if (!value) continue;

      const dupRows = await db
        .select({ responseId: answers.responseId })
        .from(answers)
        .innerJoin(responses, eq(answers.responseId, responses.id))
        .where(
          and(
            eq(answers.questionId, a.questionId),
            eq(responses.surveyId, data.surveyId),
            eq(responses.status, "completed"),
            sql`${answers.valueText} = ${value}`,
          ),
        );
      if (dupRows.some((d) => d.responseId !== data.responseId)) {
        throw new Error(
          "Nilai jawaban unik ini sudah dipakai oleh respon lain (mis. NIM sudah terdaftar).",
        );
      }
    }

    await db.transaction(async (tx) => {
      await tx.delete(answers).where(eq(answers.responseId, data.responseId));
      const rows = data.answers.map((a) => ({
        responseId: data.responseId,
        questionId: a.questionId,
        valueText: a.valueText || null,
        valueOptionIds: a.valueOptionIds || null,
        valueGrid: a.valueGrid || null,
      }));
      if (rows.length > 0) await tx.insert(answers).values(rows);
    });

    return { success: true };
  });
```

### 6.2 Frontend — mode edit di tab Individual

File: `src/routes/admin/surveys.$surveyId.tsx`, blok `subtab === "individual"` (baris ±1983–2308).

**Objektif perubahan** (tidak ditulis penuh agar hemat token — pola berikut cukup jelas untuk diterapkan CLI agent):

1. Import `updateAdminSurveyResponseFn` dari `adminSurveyFunctions`.
2. Tambahkan state di komponen utama: `const [isEditingResponse, setIsEditingResponse] = useState(false);` dan `const [editAnswers, setEditAnswers] = useState<Record<number, any>>({});` dan `const [isSavingResponse, setIsSavingResponse] = useState(false);`.
3. Saat masuk mode edit (tombol baru "Edit", ikon `edit`, hanya untuk `user?.role === "admin"`, ditaruh sejajar tombol print/hapus di "Individual Pager Header"), inisialisasi `editAnswers` dari `responseDetail.items` (map `questionId -> { valueText, valueOptionIds, valueGrid }`), lalu `setIsEditingResponse(true)`.
4. Di dalam blok render tiap `item` (baris ±2138–2304), untuk setiap tipe input yang saat ini `disabled` statis, ubah kondisinya jadi `disabled={!isEditingResponse || item.hidden}`, dan tambahkan `onChange` yang menulis ke `editAnswers[item.questionId]` ketika `isEditingResponse === true` (memakai `value={isEditingResponse ? (editAnswers[item.questionId]?.valueText ?? "") : (item.valueText ?? "—")}` sebagai pola umum untuk short_text/paragraph/date; untuk radio/checkbox pakai `checked` dari `editAnswers[...]?.valueOptionIds` dan toggle array saat `onChange`; untuk grid pakai `editAnswers[...]?.valueGrid` object dan set `{ [rowId]: colId }` saat radio diklik). Field yang `item.hidden` (data pribadi utk visitor) **tetap tidak bisa diedit** kapan pun.
5. Tambahkan tombol "Simpan Perubahan" & "Batal" (muncul hanya saat `isEditingResponse`) di footer bawah list jawaban:

```tsx
{
  isEditingResponse && (
    <div className="flex justify-end gap-3 sticky bottom-4">
      <button
        type="button"
        onClick={() => setIsEditingResponse(false)}
        className="bg-white border border-slate-200 text-[#434652] font-bold px-5 py-2.5 rounded-lg text-sm"
        disabled={isSavingResponse}
      >
        Batal
      </button>
      <button
        type="button"
        onClick={async () => {
          setIsSavingResponse(true);
          try {
            await updateAdminSurveyResponseFn({
              data: {
                surveyId,
                responseId: responseDetail.responseId,
                answers: Object.entries(editAnswers).map(([qId, v]: any) => ({
                  questionId: Number(qId),
                  valueText: v.valueText ?? null,
                  valueOptionIds: v.valueOptionIds ?? null,
                  valueGrid: v.valueGrid ?? null,
                })),
              },
            });
            toast.success("Perubahan respon berhasil disimpan.");
            setIsEditingResponse(false);
            await router.invalidate();
          } catch (err: any) {
            toast.error(err.message || "Gagal menyimpan perubahan respon.");
          } finally {
            setIsSavingResponse(false);
          }
        }}
        className="bg-[#002972] text-white font-bold px-5 py-2.5 rounded-lg text-sm shadow-sm"
        disabled={isSavingResponse}
      >
        {isSavingResponse ? "Menyimpan..." : "Simpan Perubahan"}
      </button>
    </div>
  );
}
```

6. Saat `isEditingResponse === true`, sembunyikan tombol print & hapus (agar tidak bentrok) atau `disabled`-kan.

Karena `responseDetail` berasal dari route loader (bukan local state), pola `await router.invalidate()` setelah mutasi sukses **sudah dipakai** di `handleConfirmDeleteResponse` (baris ±394) — ikuti pola yang sama persis supaya data ter-refresh otomatis setelah simpan.

---

## Ringkasan Perintah yang Perlu Dijalankan

```bash
# Hanya sekali, setelah BAB 1 (tambah targetRespondentCount)
bun run db:generate
bun run db:migrate
```

Tidak ada migrasi lain di sepanjang dokumen ini — BAB 0, 2, 3.1, 4, 5, dan 6 murni perubahan kode aplikasi (kolom `config` sudah ada, `category` sudah varchar bebas).
