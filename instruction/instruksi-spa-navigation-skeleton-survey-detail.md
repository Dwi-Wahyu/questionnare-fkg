# Instruksi: SPA Navigation + Skeleton Loading — Halaman Detail Survey Admin

## Target File
`src/routes/admin/surveys.$surveyId.tsx`

## Analisis Masalah (root cause)

Setelah membaca file ini secara menyeluruh, jeda yang dirasakan saat pindah tab/subtab atau saat masuk ke halaman **bukan** karena tidak ada state loading, tapi karena arsitektur data-fetching-nya salah tempat:

1. **`loaderDeps` menyertakan `tab`, `subtab`, `qid`, `page`.**
   ```ts
   loaderDeps: ({ search: { tab, subtab, qid, page } }) => ({ tab, subtab, qid, page }),
   ```
   Ini membuat **setiap** perubahan tab/subtab/qid/page (baik lewat `<Link search={...}>` maupun `router.navigate({ search: ... })`) dianggap TanStack Router sebagai navigasi baru yang wajib menunggu `loader` selesai sebelum route di-commit. Karena tidak ada `pendingComponent`, selama loader berjalan UI benar-benar diam (tidak ada skeleton) — inilah jeda yang dirasakan.

2. **`loader` melakukan fetch berat & kondisional di dalam blocking navigation**, termasuk `getAdminSurveyAnswersStatsFn`, `getAdminSurveyResponsesListFn`, dan `getAdminSurveyResponseDetailFn` (baris ±93-113). Semua fetch ini seharusnya bisa terjadi *setelah* tab sudah berpindah secara instan di client, bukan menjadi syarat sebelum tab boleh berpindah.

3. **Double-fetch untuk data statistik.** Sudah ada `useEffect` di baris ±271-301 yang memanggil `getAdminSurveyAnswersStatsFn` secara client-side setiap kali `tab` berubah ke `"responses"`. Artinya saat pindah ke tab Jawaban, stats di-fetch **dua kali**: sekali oleh `loader` (blocking, karena `tab` ada di `loaderDeps`) dan sekali lagi oleh effect ini (client-side, non-blocking). Pola client-side effect ini sudah benar — tinggal dilepas dari ketergantungan pada loader, dan pola yang sama perlu dibuat untuk `responsesIndex`/`responseDetail` yang saat ini **hanya** disuplai oleh `loader` tanpa ada effect client-side sama sekali (ini penyebab jeda paling terasa saat masuk subtab "individual" atau ganti halaman respon).

Kesimpulan: solusinya bukan menambah loading spinner di atas arsitektur yang ada, tapi memindahkan tanggung jawab fetch data spesifik-tab dari `loader` (blocking) ke `useEffect` client-side (non-blocking), lalu menampilkan skeleton yang sudah tersedia (`components/ui/Skeleton.tsx`) selama effect tersebut berjalan.

## Tujuan Perubahan

- Klik tab (`Pertanyaan` / `Jawaban` / `Setelan`), subtab (`ringkasan` / `pertanyaan` / `individual`), pilih pertanyaan (`qid`), dan navigasi halaman respon (`page`) harus **instan** mengganti URL & tampilan (SPA murni, tidak menunggu network).
- Data yang butuh fetch baru untuk tab/subtab/page yang aktif ditampilkan lewat **skeleton loading** di area kontennya saja, bukan blocking seluruh halaman.
- `loader` hanya bertanggung jawab atas data yang benar-benar dibutuhkan semua tab (`detail`, `categories`) plus seeding awal untuk direct link/refresh, dan tetap dipakai untuk live-refresh (`router.invalidate()` dari `useSurveyLive`) — perilaku live update yang sudah ada **tidak boleh berubah**.

---

## Langkah 1 — Ubah `loaderDeps` agar tidak trigger ulang loader saat tab/subtab/qid/page berubah

Cari:
```ts
loaderDeps: ({ search: { tab, subtab, qid, page } }) => ({
    tab,
    subtab,
    qid,
    page,
}),
```

Ganti menjadi (loader hanya bergantung pada `surveyId`, tidak lagi pada search params):
```ts
loaderDeps: () => ({}),
```

Lalu ubah signature `loader` agar tetap bisa membaca `search` saat ini untuk **seeding data awal** (initial load / direct link / refresh), tanpa membuatnya jadi dependency yang memicu re-run:

```ts
loader: async ({ params, location }) => {
    const surveyId = parseInt(params.surveyId, 10);
    const search = location.search as {
        tab: string;
        subtab: string;
        qid?: number;
        page: number;
    };

    const [detail, categories] = await Promise.all([
        getAdminSurveyDetailFn({ data: surveyId }),
        getSurveyCategoriesFn(),
    ]);
    let stats = null;
    let responseDetail = null;
    let responsesIndex = null;

    if (
        search.tab === "responses" &&
        (search.subtab === "ringkasan" || search.subtab === "pertanyaan")
    ) {
        stats = await getAdminSurveyAnswersStatsFn({ data: { surveyId } });
    }
    if (search.tab === "responses" && search.subtab === "individual") {
        responsesIndex = await getAdminSurveyResponsesListFn({
            data: { surveyId, page: search.page, limit: 1 },
        });
        const targetId = responsesIndex.responses[0]?.id;
        if (targetId) {
            responseDetail = await getAdminSurveyResponseDetailFn({
                data: { surveyId, responseId: targetId },
            });
        }
    }

    return {
        detail,
        stats,
        responseDetail,
        responsesIndex,
        surveyId,
        categories,
    };
},
```

**Penting:** karena `loaderDeps` sekarang selalu `{}`, loader **tidak akan re-run** saat user klik tab/subtab/qid/page — hanya re-run saat `params.surveyId` berubah, atau saat ada `router.invalidate()` eksplisit (dipakai `useSurveyLive` untuk live refresh, lihat baris ±157-165 — perilaku ini tetap jalan karena `invalidate()` memaksa re-run terlepas dari `deps`).

## Langkah 2 — Tambahkan `pendingComponent` untuk initial load

Ini menangani jeda saat **pertama kali masuk halaman** (dari list survey ke detail), yang tetap butuh network round-trip tapi sekarang harus punya feedback visual. Tambahkan di `createFileRoute` config, sejajar dengan `loader`:

```ts
pendingComponent: () => (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <div className="flex gap-6 border-b border-[#c4c6d4] pb-3">
            <Skeleton className="h-5 w-24 rounded" />
            <Skeleton className="h-5 w-24 rounded" />
            <Skeleton className="h-5 w-24 rounded" />
        </div>
        <Skeleton className="h-[320px] w-full rounded-xl" />
        <Skeleton className="h-[200px] w-full rounded-xl" />
    </div>
),
pendingMs: 100,
pendingMinMs: 400,
```

`pendingMs`/`pendingMinMs` boleh disesuaikan dengan `defaultPendingMs`/`defaultPendingMinMs` di `src/router.tsx` (100ms / 400ms) — cukup eksplisit di sini agar behavior route ini tidak bergantung diam-diam pada default global.

## Langkah 3 — Buat state + effect client-side untuk `responsesIndex` & `responseDetail`

Saat ini `responsesIndex` dan `responseDetail` dipakai **langsung** dari `Route.useLoaderData()` (baris ±140-148) tanpa state lokal. Ini yang membuat subtab "individual" dan navigasi halaman respon (tombol prev/next, input nomor halaman di baris ±2650-2698) selalu menunggu network sebelum apapun berubah di layar.

Tambahkan state baru di dekat `activeStats`/`isLoadingStats` (baris ±263-264):

```ts
const [activeResponsesIndex, setActiveResponsesIndex] = useState(responsesIndex);
const [activeResponseDetail, setActiveResponseDetail] = useState(responseDetail);
const [isLoadingResponseDetail, setIsLoadingResponseDetail] = useState(false);

useEffect(() => {
    setActiveResponsesIndex(responsesIndex);
    setActiveResponseDetail(responseDetail);
}, [responsesIndex, responseDetail]);

useEffect(() => {
    if (tab !== "responses" || subtab !== "individual") return;
    let cancelled = false;
    setIsLoadingResponseDetail(true);
    (async () => {
        try {
            const list = await getAdminSurveyResponsesListFn({
                data: { surveyId, page, limit: 1 },
            });
            if (cancelled) return;
            setActiveResponsesIndex(list);
            const targetId = list.responses[0]?.id;
            if (targetId) {
                const detailRes = await getAdminSurveyResponseDetailFn({
                    data: { surveyId, responseId: targetId },
                });
                if (!cancelled) setActiveResponseDetail(detailRes);
            } else if (!cancelled) {
                setActiveResponseDetail(null);
            }
        } catch (err: any) {
            if (!cancelled)
                toast.error(err.message || "Gagal memuat respon.");
        } finally {
            if (!cancelled) setIsLoadingResponseDetail(false);
        }
    })();
    return () => {
        cancelled = true;
    };
}, [surveyId, tab, subtab, page]);
```

Pola ini persis meniru effect stats yang sudah ada di baris ±271-301 — konsisten dengan gaya kode yang sudah dipakai di file ini.

## Langkah 4 — Ganti semua referensi `responsesIndex` / `responseDetail` di JSX

Karena sekarang sumber data untuk render adalah state, bukan loader data langsung, cari **semua** pemakaian `responsesIndex` dan `responseDetail` di body komponen (di luar deklarasi loader, sekitar baris 2560-3200 dan baris 601-611 untuk handler hapus respon) dan ganti jadi `activeResponsesIndex` / `activeResponseDetail`. Loader data (`responsesIndex`, `responseDetail`) tetap dipertahankan hanya sebagai initial seed untuk `useState`, jangan dihapus dari destructuring `Route.useLoaderData()`.

Lokasi yang perlu diganti (berdasarkan hasil grep di file ini):
- Baris ±601-611 (`handleDeleteResponse` atau sejenisnya — cek nama fungsi persis di file)
- Baris ±2563-2565 (kondisi render kosong)
- Baris ±2580, ±3137 (`Respon #{page} dari {responsesIndex.totalCount}`)
- Baris ±2598 (`for (const item of responseDetail.items)`)
- Baris ±2634-2646 (`responseDetail.submittedAt`)
- Baris ±2667-2698 (kontrol pagination: `max`, validasi `val <= responsesIndex.totalCount`, `responsesIndex.totalCount`)
- Baris ±2704 (`responseDetail.items`)
- Baris ±3051 (`responseId: responseDetail.responseId`)
- Baris ±3145-3171 (`responseDetail.submittedAt`, `responseDetail.items.map`)

Tambahkan juga skeleton saat `isLoadingResponseDetail` true, bungkus panel detail respon (area sekitar baris ±2560-2710 dan ±3130-3175) dengan pola yang sama seperti panel stats (baris ±2410, pakai class `transition-opacity duration-200 ${isLoadingResponseDetail ? "opacity-50" : ""}` plus overlay `<Skeleton>` mengikuti pola `isRefreshing` di baris ±2205-2214).

## Langkah 5 — Pastikan effect stats yang sudah ada tetap konsisten

Effect di baris ±271-301 sudah benar (client-side, tidak lagi redundant dengan loader setelah Langkah 1). Tidak perlu diubah, hanya pastikan dependency array-nya (`[surveyId, tab, csvFilterQuestionId, csvFilterOptionIds, refreshTick]`) tetap dipertahankan — ini sudah menangani re-fetch saat pindah ke tab "responses" maupun saat filter berubah.

## Langkah 6 — Verifikasi interaksi dengan live update (`useSurveyLive`)

`router.invalidate()` di baris ±161 (dipanggil saat ada jawaban baru masuk) harus tetap memicu ulang `loader` penuh (untuk refresh `detail` + `stats`/`responsesIndex`/`responseDetail` sesuai tab aktif saat itu) — ini otomatis tetap bekerja karena `invalidate()` mem-bypass memoization `loaderDeps`. Tidak perlu perubahan tambahan di `useSurveyLive` maupun handler `onAnswer` (baris ±157-165).

---

## Checklist Pengujian Manual

- [ ] Klik tab Pertanyaan → Jawaban → Setelan bolak-balik: URL berubah instan, tidak ada freeze, skeleton muncul singkat di konten tab Jawaban saat stats masih fetch.
- [ ] Di tab Jawaban, pindah subtab Ringkasan → Per Pertanyaan → Individual: instan, skeleton muncul di area yang relevan saat data spesifik subtab masih dimuat.
- [ ] Di subtab Individual, klik next/prev page dan ubah input nomor halaman: instan, skeleton/opacity muncul di kartu respon saat data respon baru dimuat, tidak reload seluruh halaman.
- [ ] Ganti pilihan pertanyaan (`qid`) di subtab Per Pertanyaan: instan tanpa network baru (karena data sudah ada di `activeStats`).
- [ ] Refresh halaman langsung di URL dengan `?tab=responses&subtab=individual&page=3`: data ter-render benar dari initial loader seed (bukan array kosong), dengan `pendingComponent` skeleton muncul sebelum data pertama kali siap.
- [ ] Simulasikan ada respon baru masuk (live update via `useSurveyLive`): banner "sedang mengisi" & auto-refresh stats/respon tetap berjalan seperti sebelumnya.
- [ ] Hapus/edit respon di subtab Individual: state `activeResponsesIndex`/`activeResponseDetail` ter-update dengan benar setelah aksi.
