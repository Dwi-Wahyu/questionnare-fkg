# Instruksi Migrasi Ikon — Material Symbols → lucide-react

Sudah diverifikasi terhadap source code: proyek saat ini memakai `<span className="material-symbols-outlined">nama_ikon</span>` yang di-load via Google Fonts di `src/routes/__root.tsx` (line 227), dan dipakai di **11 file**:

```
src/routes/__root.tsx
src/routes/admin/analytics.tsx
src/routes/admin/surveys.index.tsx
src/routes/admin/surveys.$surveyId.tsx
src/routes/admin/users.tsx
src/routes/admin/surveys.new.tsx
src/routes/admin/route.tsx
src/routes/admin/index.tsx
src/routes/login.tsx
src/routes/survey.$surveySlug.tsx
src/routes/survey.$surveySlug.thank-you.tsx
src/routes/index.tsx
```

Tidak ada `package.json` di source yang dianalisis (di luar cakupan zip) — pastikan dependency berikut ditambahkan di proyek nyata:
```bash
bun add lucide-react
```

## Langkah 1 — Hapus font Material Symbols

`src/routes/__root.tsx` (±line 226-228): hapus tag `<link>` untuk `Material+Symbols+Outlined`. **Jangan** hapus link `Plus+Jakarta+Sans` (font teks, tidak terkait ikon).

## Langkah 2 — Strategi penggantian

Karena jumlah pemakaian tersebar di 11 file dengan puluhan nama ikon berbeda (`add`, `delete`, `edit`, `search`, `close`, `check_circle`, `filter_alt`, `chevron_left/right`, `arrow_upward/downward`, `print`, `lock`, `schedule`, `groups`, `poll`, `analytics`, `dashboard`, `logout`, `account_circle`, `content_copy`, `cloud_done`, `wifi_tethering`, `splitscreen`, `add_box`, `add_circle`, `verified`, `visibility`, `error`, `help_outline`, `table_view`, `query_stats`, `assignment_turned_in`, `radio_button_unchecked`, `expand_less/more`, `download`, `file_download`, `upload`, `inbox`, `search_off`, `lock_clock`, `calendar_month/today`, `person_add`, `home`, `group`, dsb.), lakukan penggantian **per file, satu per satu**, bukan regex massal — supaya ukuran (`text-sm`, `text-base`, `text-2xl`, dst.) dan warna tetap konsisten dengan konteks masing-masing pemakaian.

Pola penggantian umum:

**Sebelum:**
```tsx
<span className="material-symbols-outlined text-sm">
  delete
</span>
```

**Sesudah:**
```tsx
<Trash2 className="h-4 w-4" />
```

Aturan ukuran (samakan dari class Tailwind lama ke lucide `className` + prop `size` bila perlu presisi px):
| Class lama | Padanan lucide |
|---|---|
| `text-xs` / `text-sm` | `h-3.5 w-3.5` atau `h-4 w-4` |
| `text-base` | `h-5 w-5` |
| `text-lg` / `text-xl` | `h-6 w-6` |
| `text-2xl` / `text-3xl` | `h-8 w-8` / `h-9 w-9` |

Untuk kasus `style={{ fontVariationSettings: "'FILL' 1" }}` (varian filled, dipakai di `analytics.tsx` untuk ikon `work`), lucide tidak punya konsep fill-toggle seperti Material Symbols — pakai prop `fill="currentColor"` pada komponen ikon lucide sebagai padanan visual terdekat, atau pilih varian ikon lucide yang secara desain sudah solid.

## Langkah 3 — Tabel Padanan Nama Ikon (berdasarkan pemakaian nyata di project ini)

Import semua dari `lucide-react`, contoh: `import { Trash2, Pencil, Search } from "lucide-react";`

| Material Symbols | Komponen lucide-react |
|---|---|
| `add` | `Plus` |
| `add_box` | `SquarePlus` |
| `add_circle` | `CirclePlus` |
| `person_add` | `UserPlus` |
| `delete` | `Trash2` |
| `edit` | `Pencil` |
| `search` | `Search` |
| `search_off` | `SearchX` |
| `close` | `X` |
| `check_circle` | `CircleCheck` |
| `error` | `CircleAlert` |
| `warning` | `TriangleAlert` |
| `filter_alt` | `Filter` |
| `chevron_left` | `ChevronLeft` |
| `chevron_right` | `ChevronRight` |
| `arrow_upward` | `ArrowUp` |
| `arrow_downward` | `ArrowDown` |
| `arrow_drop_down` | `ChevronDown` |
| `expand_less` | `ChevronUp` |
| `expand_more` | `ChevronDown` |
| `print` | `Printer` |
| `lock` | `Lock` |
| `lock_clock` | `Clock` |
| `schedule` | `Clock` |
| `groups` | `Users` |
| `group` | `Users` |
| `poll` | `ChartBar` |
| `analytics` | `ChartColumn` |
| `query_stats` | `TrendingUp` |
| `dashboard` | `LayoutDashboard` |
| `logout` | `LogOut` |
| `account_circle` | `CircleUser` |
| `content_copy` | `Copy` |
| `cloud_done` | `CloudCheck` |
| `wifi_tethering` | `Wifi` |
| `splitscreen` | `PanelsTopLeft` |
| `verified` | `BadgeCheck` |
| `visibility` | `Eye` |
| `help_outline` | `CircleHelp` |
| `table_view` | `Table` |
| `assignment_turned_in` | `ClipboardCheck` |
| `radio_button_unchecked` | `Circle` |
| `download` / `file_download` | `Download` |
| `upload` | `Upload` |
| `inbox` | `Inbox` |
| `calendar_month` / `calendar_today` | `Calendar` |
| `home` | `Home` |
| `save` | `Save` |
| `description` | `FileText` |

Ikon lain yang muncul di luar tabel ini (jika ditemukan saat menyisir file satu per satu) dicari padanannya langsung di https://lucide.dev/icons — konvensi penamaan lucide umumnya `PascalCase` dari nama deskriptif ikon.

## Langkah 4 — Checklist eksekusi per file

Untuk tiap file di daftar Langkah 1, lakukan:
1. Cari semua `<span className="material-symbols-outlined ...">nama_ikon</span>`.
2. Tambahkan/lengkapi import lucide di bagian atas file (hanya ikon yang benar-benar dipakai di file itu, untuk tree-shaking optimal).
3. Ganti tiap span dengan komponen lucide sesuai tabel, pindahkan class ukuran/warna Tailwind lain (mis. `text-[#002972]`, `text-rose-600`) langsung ke `className` komponen lucide (lucide otomatis mewarisi `currentColor`, jadi class warna teks tetap berfungsi).
4. Untuk kasus ikon di dalam tombol dengan `disabled:opacity-40` dsb., class tersebut aman dipindah apa adanya ke elemen `<button>` pembungkus (tidak perlu ada di ikon itu sendiri) — cek per kasus.
5. Jalankan `bun run build` (atau `bun run dev`) untuk memastikan tidak ada import ikon yang salah nama/tidak ditemukan di `lucide-react`.

Tidak ada perubahan skema database untuk instruksi ini — murni perubahan dependency + UI.
