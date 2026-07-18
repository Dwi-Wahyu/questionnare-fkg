# Instruksi Implementasi: Redesign Landing Page, Palet Merah, & Insight Real-time

**Proyek:** E-Questionnaire (tracert-study)
**Stack terdeteksi:** TanStack Start (`@tanstack/react-start`, file-based routing + `createServerFn`), Drizzle ORM + MySQL, Tailwind v4 (`@theme` tokens), autentikasi berbasis cookie (`session_token`).

Dokumen ini adalah instruksi kerja, bukan kode final — setiap bagian menunjuk file yang harus disentuh beserta pendekatan konkretnya.

---

## 0. Ringkasan Keputusan

| Area | Keputusan |
|---|---|
| Landing page | Tetap fokus pada **daftar survey** (mode tamu sudah ada), tapi dibungkus hero/copy bernuansa "E-Questionnaire = alat analitik pertumbuhan produk", ditambah elemen interaktif ringan (filter, stat strip, skeleton, hover) |
| Warna primary | Merah (`dark-red #B00000`) dengan `maroon #4A0000` sebagai varian gelap/hover |
| Realtime | **SSE (Server-Sent Events)**, satu arah server→client — sudah cukup untuk kasus ini (lihat §7) |
| Live presence badge | Dihitung dari **lifecycle koneksi SSE** (connect = hadir, disconnect = pergi), **bukan** polling/heartbeat DB → tidak menambah beban query |

---

## 1. Landing Page — Reposisi untuk Publik Umum

File: `src/routes/index.tsx`, server fn: `src/server/surveyFunctions.ts` (`getPublishedSurveysFn`)

Karena mode tamu sudah tersedia di alur pengisian survey, landing page **tidak perlu** login/CTA admin — cukup jadi *directory* survey yang hidup dan meyakinkan pengunjung awam bahwa platform ini serius soal data.

### 1.1 Struktur baru yang disarankan
1. **Hero ringkas** (bukan paragraf panjang) — reposisikan copy existing:
   - Judul besar: nama institusi/produk (bisa tetap "Fakultas Kedokteran Gigi · Universitas Hasanuddin" jika ini instansinya) + subjudul satu kalimat yang mencerminkan value prop E-Questionnaire: *"Bantu kami mengubah masukan Anda menjadi wawasan yang mendorong perbaikan layanan."* — hindari jargon "product and growth analytics" mentah-mentah untuk audiens awam, cukup sarikan jadi manfaat: **cepat diisi → langsung berkontribusi pada keputusan nyata**.
   - Tambahkan **stat strip** kecil (3 angka) di bawah hero untuk kesan "data-driven": jumlah survey aktif, total partisipan, rata-rata waktu pengisian. Butuh field tambahan pada `getPublishedSurveysFn` atau server fn baru ringan `getPublicLandingStatsFn` (agregat `COUNT` sederhana, cache di memory 60 detik agar tidak query berulang tiap load).
2. **Search & filter yang lebih interaktif**:
   - Search bar yang sudah ada dipertahankan.
   - Tambah **filter chip** (mis. berdasarkan kategori/tag survey jika ada di schema, atau minimal "Terbaru" / "Paling Banyak Diisi") — gunakan `useState` lokal, tidak perlu server roundtrip.
   - Tambah **skeleton loading state** (reuse `Skeleton.tsx` yang sudah jadi god node di codebase) saat `searchQuery` mengubah hasil, beri delay transisi halus (150–200ms) supaya terasa hidup tanpa flicker.
3. **Survey card** dipertahankan strukturnya (banner, jumlah pertanyaan, tombol "Mulai Survey") — tambahkan micro-interaction: hover scale sudah ada, tambahkan estimasi waktu pengisian (`~5 menit`) jika tersedia dari jumlah pertanyaan (`Math.ceil(questionCount * 0.5)` menit sebagai heuristik, tampil sebagai badge kedua di banner).
4. **Empty/loading states** tetap ramah — pertahankan komponen `CircleHelp` yang sudah ada, cukup ganti warna sesuai palet baru.

### 1.2 Yang TIDAK perlu ditambahkan
- Jangan tambahkan form login/register di landing — sudah ditegaskan mode tamu ada di alur lain.
- Jangan ubah landing jadi dashboard admin-style dengan grafik berat — cukup *directory* + sedikit social proof angka.

---

## 2. Refactor Palet Warna → Merah sebagai Primary

Sumber: `dent-unhas-ac-id-color-palette-hex.json`
```json
dark-slate-blue: #0B3E9C
maroon:          #4A0000
dark-red:        #B00000
```

### 2.1 Pemetaan token (mengikuti pola kontras yang sudah dipakai di kode: warna *gelap* dipakai untuk heading/hover, warna *terang* untuk background tombol default)

File: `src/styles.css` (dua tempat: blok `@theme` sekitar baris 4–26, dan blok `:root` sekitar baris 97–110 — keduanya harus disinkronkan, saat ini nilainya duplikat).

| Token | Nilai lama | Nilai baru | Alasan |
|---|---|---|---|
| `--color-primary` / `--primary` | `#002972` | `#4A0000` (Maroon) | Heading, teks emphasis, hover state tombol (paralel dengan pola lama: primary = varian gelap) |
| `--color-primary-container` / `--primary-container` | `#0b3e9c` | `#B00000` (Dark Red) | Background tombol/badge default (varian terang dari primary) |
| `--color-secondary` / `--secondary` | `#a03f32` | `#0B3E9C` (Dark Slate Blue) | Dipertahankan sebagai *aksen kontras* — lihat catatan di 2.2 |
| `--color-secondary-container` | `#fe8674` | `#3D6FC2` (tint dari `#0B3E9C`, ±20% lighten) | Pendamping secondary untuk badge/label sekunder |
| `--color-error` | `#ba1a1a` | **pertahankan** `#ba1a1a` atau geser ke `#D3410F` (lebih ke oranye) | Lihat peringatan di 2.3 |

### 2.2 Kenapa `dark-slate-blue` diusulkan tetap dipakai (sebagai secondary, bukan dibuang)
`chart.tsx`, `ChartContainer()`, `ChartTooltipContent()` adalah god nodes dengan koneksi tertinggi di `GRAPH_REPORT.md` — artinya banyak grafik multi-series (statistik jawaban, tab "Ringkasan"/"Pertanyaan" di survey detail). Jika seluruh palet full merah, series kedua/ketiga pada chart akan sulit dibedakan. Rekomendasi: biru gelap dipakai khusus sebagai warna seri data ke-2 pada chart & elemen info non-CTA (bukan tombol utama), sementara **semua CTA/branding utama tetap merah** sesuai permintaan.

### 2.3 Peringatan penting
`--color-error` (`#ba1a1a`) sudah sangat dekat secara visual dengan `dark-red` yang sekarang jadi primary (`#B00000`). Ini berisiko: tombol "Hapus Survey" (destructive) dan tombol "Mulai Survey" (primary) akan terlihat nyaris identik. **Wajib** dibedakan lebih jauh — geser `--color-error` sedikit ke arah oranye (mis. `#D3410F`) atau pastikan aksi destruktif selalu dibedakan lewat ikon + confirm dialog (yang tampaknya sudah ada, `ConfirmDialog()` di komunitas `surveys.index.tsx`).

### 2.4 Eksekusi teknis
Selain `styles.css`, warna di-hardcode sebagai *arbitrary Tailwind value* (bukan token) tersebar di hampir semua route:

```
src/routes/__root.tsx                    6 pemakaian
src/routes/admin/analytics.tsx          11
src/routes/admin/index.tsx              10
src/routes/admin/route.tsx               1
src/routes/admin/surveys.$surveyId.tsx  96
src/routes/admin/surveys.index.tsx      11
src/routes/admin/surveys.new.tsx        21
src/routes/admin/users.tsx              19
src/routes/index.tsx                     9
src/routes/login.tsx                     2
src/routes/survey.$surveySlug.thank-you.tsx  7
src/routes/survey.$surveySlug.tsx       37
```

Total ~230 titik `#002972` / `#0b3e9c` / `#a03f32` / `#fe8674` dalam className (`text-[#...]`, `bg-[#...]`, dll). Jangan diedit manual satu-satu. Lakukan **find & replace terskrip** per warna dari root proyek:

```bash
# jalankan berurutan, review diff sebelum commit
grep -rl '#002972' src --include=*.tsx | xargs sed -i 's/#002972/#4A0000/g'
grep -rl '#0b3e9c' src --include=*.tsx | xargs sed -i 's/#0b3e9c/#B00000/g'
grep -rl '#a03f32' src --include=*.tsx | xargs sed -i 's/#a03f32/#0B3E9C/g'
grep -rl '#fe8674' src --include=*.tsx | xargs sed -i 's/#fe8674/#3D6FC2/g'
```

**Lebih baik lagi (rekomendasi jangka panjang):** sekalian ganti pola `text-[#002972]` → `text-primary`, `bg-[#0b3e9c]` → `bg-primary-container`, dst., supaya ke depan cukup ubah `styles.css` saja tanpa perlu sed lagi. Ini pekerjaan tambahan tapi menghilangkan akar masalah (kode saat ini tidak konsisten memakai design token yang sudah didefinisikan).

---

## 3. Insight Real-time di Tab "Jawaban" (Survey Detail)

File terlibat: `src/routes/admin/surveys.$surveyId.tsx` (tab `responses`, subtab `ringkasan`/`pertanyaan`/`individual`), server fn `getAdminSurveyAnswersStatsFn` & `getAdminSurveyResponsesListFn` di `src/server/adminSurveyFunctions.ts`, submit terjadi di `submitResponseFn` (`src/server/surveyFunctions.ts`).

### 3.1 Prinsip desain (agar tidak membebani server & tidak leak)
> **SSE hanya mengirim *sinyal*, bukan data.** Query statistik tetap lewat server function yang sudah ada (`getAdminSurveyAnswersStatsFn`), dipanggil ulang secara **debounced** saat ada sinyal — bukan setiap submit mendorong payload penuh lewat stream.

### 3.2 Endpoint SSE baru
Buat API route: `src/routes/api/surveys.$surveyId.live.ts`

```ts
import { createServerFileRoute } from "@tanstack/react-start/server";

// Registry per-proses, dijaga agar tidak dobel saat HMR di dev
const g = globalThis as any;
const channels: Map<number, Set<ReadableStreamDefaultController>> =
  g.__surveyChannels ?? (g.__surveyChannels = new Map());
const fillerCounts: Map<number, number> =
  g.__fillerCounts ?? (g.__fillerCounts = new Map());

function broadcast(surveyId: number, event: string, data: unknown) {
  const subs = channels.get(surveyId);
  if (!subs) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of subs) {
    try { c.enqueue(new TextEncoder().encode(payload)); } catch { /* controller sudah closed, abaikan */ }
  }
}

export const ServerRoute = createServerFileRoute("/api/surveys/$surveyId/live").methods({
  GET: async ({ request, params }) => {
    const surveyId = Number(params.surveyId);
    const role = new URL(request.url).searchParams.get("role"); // "filler" | "viewer"

    let controller: ReadableStreamDefaultController;
    const stream = new ReadableStream({
      start(c) {
        controller = c;
        if (!channels.has(surveyId)) channels.set(surveyId, new Set());
        channels.get(surveyId)!.add(c);

        if (role === "filler") {
          fillerCounts.set(surveyId, (fillerCounts.get(surveyId) ?? 0) + 1);
          broadcast(surveyId, "presence", { count: fillerCounts.get(surveyId) });
        }
        // heartbeat comment tiap 25s agar koneksi tidak ditutup proxy/idle-timeout
        const ping = setInterval(() => {
          try { c.enqueue(new TextEncoder().encode(": ping\n\n")); } catch {}
        }, 25000);

        request.signal.addEventListener("abort", () => {
          clearInterval(ping);
          channels.get(surveyId)?.delete(c);
          if (role === "filler") {
            fillerCounts.set(surveyId, Math.max(0, (fillerCounts.get(surveyId) ?? 1) - 1));
            broadcast(surveyId, "presence", { count: fillerCounts.get(surveyId) });
          }
          try { c.close(); } catch {}
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  },
});

// dipanggil dari submitResponseFn setelah insert sukses
export function notifySurveyAnswered(surveyId: number) {
  broadcast(surveyId, "answer", { at: Date.now() });
}
```

> Catatan versi: nama import (`createServerFileRoute` vs pola API route lain di versi TanStack Start yang dipakai) bisa berbeda tergantung versi paket — cek `package.json`/dokumentasi TanStack Start yang terpasang sebelum copy-paste literal. Yang penting secara konsep: **satu `Response` dengan `ReadableStream` + `text/event-stream`**, dan **cleanup wajib di `request.signal` "abort"**.

### 3.3 Hubungkan ke `submitResponseFn`
Di `src/server/surveyFunctions.ts`, setelah blok `tx.insert(answers).values(answerRows)` berhasil commit, panggil `notifySurveyAnswered(surveyId)` dari modul endpoint di atas. Ini satu-satunya perubahan di jalur submit — **tidak** menambah query, hanya broadcast in-memory.

### 3.4 Client hook

File baru: `src/hooks/useSurveyLive.ts`

```ts
import { useEffect, useRef, useState } from "react";

export function useSurveyLive(surveyId: number, role: "filler" | "viewer", onAnswer?: () => void) {
  const [presenceCount, setPresenceCount] = useState(0);

  useEffect(() => {
    const es = new EventSource(`/api/surveys/${surveyId}/live?role=${role}`);

    es.addEventListener("presence", (e) => {
      setPresenceCount(JSON.parse(e.data).count);
    });

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    es.addEventListener("answer", () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      // gabungkan burst submission jadi 1 refetch tiap 2.5 detik
      debounceTimer = setTimeout(() => onAnswer?.(), 2500);
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      es.close(); // WAJIB — sumber utama memory leak jika lupa
    };
  }, [surveyId, role]);

  return presenceCount;
}
```

### 3.5 Pemakaian di tab "Jawaban" (`surveys.$surveyId.tsx`)

Di komponen yang me-render subtab `ringkasan`/`pertanyaan` (sekitar baris ~1540–2049), tambahkan:

```tsx
const [refreshTick, setRefreshTick] = useState(0);
const [isRefreshing, setIsRefreshing] = useState(false);
const liveCount = useSurveyLive(detail.id, "viewer", () => {
  setIsRefreshing(true);
  router.invalidate(); // atau refetch loader yang sudah dipakai, lalu:
  // setelah promise resolve -> setIsRefreshing(false)
});
```

Animasi "seperti reload" (tanpa reload halaman): saat `isRefreshing === true`, timpakan overlay tipis pakai komponen `Skeleton.tsx` yang sudah ada di codebase (sudah jadi hub node — konsisten dipakai di banyak tempat) selama data baru masuk, lalu fade-out. Contoh CSS minimal (tambahkan ke `styles.css`):

```css
@keyframes live-pulse {
  0% { opacity: 1; }
  50% { opacity: .4; }
  100% { opacity: 1; }
}
.live-updating { animation: live-pulse 900ms ease-in-out 1; }
```
Terapkan class `live-updating` ke angka statistik (Total Jawaban, dsb.) selama ~900ms setiap kali event `answer` memicu refetch — cukup untuk memberi kesan "live" tanpa perlu library animasi baru (framer-motion dsb. tidak wajib ditambahkan).

---

## 4. Badge "Sedang Mengisi" (Live Presence)

Dipakai di dua tempat:
1. **Halaman kelola survey** — `src/routes/admin/surveys.index.tsx` (list card)
2. **Halaman detail survey** — `src/routes/admin/surveys.$surveyId.tsx` (header)

### 4.1 Masalah yang harus dihindari: multiplikasi koneksi SSE
Jika setiap card di halaman *list* (`surveys.index.tsx`) membuka `EventSource` sendiri-sendiri, dan survey ada belasan, ini bisa membentur **batas browser 6 koneksi HTTP/1.1 per domain** (semua tab/card berebut slot koneksi yang sama) — bukan soal beban server, tapi bisa membuat badge macet/tidak update.

**Solusi:** buat endpoint agregat terpisah khusus halaman list:
`src/routes/api/surveys.live.ts` — satu koneksi SSE yang mem-broadcast `{ surveyId, count }` untuk **semua** survey sekaligus (loop sederhana atas `fillerCounts` Map yang sama dari §3.2, broadcast tiap kali salah satu channel berubah). Halaman list cukup buka **satu** `EventSource`, bukan N buah.

Halaman detail (`surveys.$surveyId.tsx`) tetap pakai hook per-survey dari §3.4 (`role="viewer"`) karena memang hanya butuh satu survey.

### 4.2 Sisi pengisi survey (trigger presence)
File: `src/routes/survey.$surveySlug.tsx` (halaman pengisian, termasuk mode tamu).

Saat komponen mount (survey mulai dibuka, bukan saat klik submit), buka `EventSource` dengan `role=filler` dari hook yang sama (§3.4), **tidak perlu ambil balik nilai presence-nya** di sisi pengisi — cukup efek sampingnya (mendaftarkan diri sebagai "sedang mengisi"). Saat tab ditutup / pindah halaman, browser otomatis memutus koneksi HTTP → event `abort` di server (§3.2) otomatis mengurangi hitungan **tanpa perlu heartbeat/polling tambahan apa pun**. Ini kunci kenapa desain ini ringan.

### 4.3 Komponen `LiveFillingBadge`

```tsx
function LiveFillingBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1.5 bg-primary-container/10 text-primary text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-container opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-container" />
      </span>
      {count} sedang mengisi
    </span>
  );
}
```
Pasang di card list (dekat badge "N pertanyaan" yang sudah ada) dan di header detail (dekat label `Jawaban ({detail.responseCount})`, baris ~1007).

---

## 5. Checklist Anti Memory-Leak & Anti Beban Server

- [ ] **Selalu** `es.close()` di cleanup `useEffect` — cek ulang tiap tempat hook dipakai.
- [ ] Registry channel (`Map`) memakai `globalThis` singleton agar HMR dev tidak membuat Map baru bertumpuk.
- [ ] `request.signal` "abort" listener wajib ada — ini satu-satunya jalan mendeteksi tab ditutup/koneksi putus; tanpa ini, `Set<controller>` akan terus membesar (leak).
- [ ] SSE **tidak** membawa payload data berat — hanya nama event; data asli tetap diambil lewat server fn yang sudah ada, dan dipanggil **debounced** (2–3 detik), bukan per-event.
- [ ] Heartbeat ping (`: ping\n\n`) minimal — sekadar comment kosong, bukan query DB, cukup untuk mencegah proxy/idle-timeout memutus koneksi.
- [ ] Halaman list (banyak survey) pakai **satu** koneksi agregat, bukan N koneksi per card.
- [ ] Tidak ada `setInterval` polling tambahan di client — semua update didorong server (event-driven), bukan ditarik berkala.

---

## 6. Apakah Implementasi SSE Sudah Cukup?

**Ya, cukup** untuk kebutuhan ini — alasannya:

- Arah data hanya **server → client** (update statistik jawaban, hitungan presence); tidak ada kasus client perlu mengirim data real-time balik lewat channel yang sama (submit jawaban tetap lewat `POST` biasa/`submitResponseFn`). WebSocket baru terasa perlu kalau butuh komunikasi dua arah frekuensi tinggi (mis. chat) — bukan kasus di sini.
- Frekuensi event rendah (submit survey & buka/tutup halaman survey, bukan ratusan pesan per detik) — beban jauh di bawah kapasitas normal SSE.
- `EventSource` browser **otomatis reconnect** kalau koneksi putus, tanpa kode tambahan.
- Terintegrasi natural dengan TanStack Start (route API biasa yang mengembalikan `Response` + `ReadableStream`), tidak perlu infra tambahan (Socket.io server, dsb).
- Autentikasi sudah cookie-based (`session_token`), jadi `EventSource` otomatis ikut terautentikasi tanpa perlu workaround header (`EventSource` tidak bisa kirim header custom, tapi cookie tetap terkirim otomatis).

**Catatan/batasan yang perlu diperhatikan** (bukan alasan untuk tidak pakai SSE, tapi wajib dicek sebelum deploy):

1. **Butuh server proses long-running.** SSE mengandalkan koneksi HTTP yang tetap terbuka. Kalau nanti proyek ini di-deploy ke platform serverless/edge yang membatasi durasi request (mis. beberapa detik saja), koneksi akan diputus paksa. Untuk deployment tradisional (VPS/Docker/Node server yang jalan terus, sesuai skala aplikasi survei kampus ini) — aman.
2. **Registry in-memory hanya berlaku per satu proses server.** Kalau ke depan aplikasi di-scale ke beberapa instance/replica di belakang load balancer, hitungan presence & broadcast antar-instance akan tidak sinkron kecuali pakai *sticky session* atau broker bersama (mis. Redis pub/sub). Untuk skala saat ini (single instance) tidak masalah — cukup dicatat sebagai keputusan sadar, bukan bug.
3. **Batas 6 koneksi per domain di HTTP/1.1** — sudah ditangani lewat desain endpoint agregat di §4.1; kalau server sudah jalan di atas HTTP/2, batas ini otomatis hilang (multiplexing).

Kesimpulan: SSE adalah pilihan yang **proporsional** — lebih sederhana dari WebSocket, jauh lebih ringan dari polling interval, dan cocok dengan pola trafik "kadang ada yang isi survey" bukan "streaming data tinggi".

---

## 7. Urutan Pengerjaan yang Disarankan

1. Update token warna di `src/styles.css` (§2.1–2.3).
2. Jalankan sed script (§2.4) untuk migrasi hex hardcoded, review diff, build & cek visual tiap halaman.
3. Redesign `src/routes/index.tsx` (§1) — bisa dikerjakan paralel dengan langkah warna karena tidak saling bergantung.
4. Buat endpoint SSE per-survey (`src/routes/api/surveys.$surveyId.live.ts`) + endpoint agregat (`src/routes/api/surveys.live.ts`).
5. Tambahkan `notifySurveyAnswered()` ke `submitResponseFn`.
6. Buat hook `useSurveyLive.ts`.
7. Pasang di `survey.$surveySlug.tsx` (role filler), `surveys.$surveyId.tsx` tab Jawaban (role viewer + animasi §3.5), `surveys.index.tsx` (role viewer agregat + `LiveFillingBadge`).
8. **QA manual:** buka 2 browser/tab — tab A isi survey sebagai tamu, tab B buka halaman admin kelola survey & detail survey. Verifikasi: badge presence naik saat tab A membuka survey, statistik di tab B berubah dengan animasi pulse setelah tab A submit (tanpa reload), dan badge presence turun begitu tab A ditutup — semua tanpa refresh manual di tab B.
