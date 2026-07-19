# Instruksi: Tabel Kategori Survey (Seeder + Wiring UI + Slug Mapping)

## 0. Kondisi kode saat ini (hasil cek)

`category` pada tabel `surveys` sekarang cuma `varchar(100)` bebas isi apa saja
(`src/server/db/schema.ts:38`), dan nilainya **sudah tidak konsisten** di berbagai tempat:

| Lokasi | Nilai yang dipakai |
|---|---|
| `src/server/db/seed.ts` (seeder utama) | `tracer_study`, `kepuasan_mahasiswa` |
| `src/routes/admin/surveys.new.tsx` (form buat survey) | `tracer`, `kepuasan`, `pengguna`, `lainnya` |
| `src/routes/admin/surveys.$surveyId.tsx` (tab Setelan) | `tracer`, `kepuasan`, `pengguna`, `lainnya` (duplikat dari atas) |
| `src/routes/admin/analytics.tsx` | `tracer`, `kepuasan`, `pengguna`, `lainnya` (mock data) |
| `src/routes/index.tsx` (landing page) | Menampilkan `survey.category` mentah sebagai label, **tanpa mapping nama** (`{survey.category || "General"}`) |

Selain itu, di `src/routes/index.tsx` sudah ada kode yang menghitung daftar kategori unik
(`const categories = [...]`, baris ~109) **tapi tidak pernah dipakai untuk render filter apa pun**
— jadi saat ini landing page belum benar-benar punya UI filter kategori yang berfungsi.

Instruksi di bawah ini membuat satu sumber kebenaran (`survey_categories` table) dengan 3 opsi
tetap, lalu menyambungkannya ke ketiga tempat yang diminta + memperbaiki filter di landing page.

---

## 1. Tambah tabel `survey_categories`

Edit `src/server/db/schema.ts`, tambahkan tabel baru **sebelum** definisi tabel `surveys`
(supaya urutan file tetap logis — kategori adalah data referensi untuk survey):

```ts
// ─────────────────────────────────────────────────────────────
// SURVEY CATEGORIES (fixed reference list, managed via seeder)
// ─────────────────────────────────────────────────────────────
export const surveyCategories = mysqlTable("survey_categories", {
	id: int("id").autoincrement().primaryKey(),
	// Machine-readable identifier, used as the value stored on surveys.category.
	// Kebab-case, e.g. "survey-kepuasan", "tracer-study".
	slug: varchar("slug", { length: 100 }).notNull().unique(),
	// Human-readable label shown in dropdowns/filters, e.g. "Survey Kepuasan".
	name: varchar("name", { length: 150 }).notNull(),
	order: int("order").notNull().default(0),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

`surveys.category` **tetap `varchar(100)`** seperti sekarang — tidak perlu diubah jadi
`categoryId` FK. Nilainya sekarang secara konvensi harus sama dengan salah satu
`survey_categories.slug`. Ini pilihan yang paling minim-risiko karena `category` dipakai sebagai
string biasa di banyak file (`adminSurveyFunctions.ts`, `surveyFunctions.ts`, `analytics.tsx`, dst.)
— mengubahnya jadi FK numerik akan menyentuh semua file itu tanpa manfaat langsung untuk 3 opsi
tetap seperti ini.

### Generate migration

```bash
bunx drizzle-kit generate
```

Ini akan membuat file baru di `migrations/` (mengikuti urutan yang sudah ada:
`0000_brave_pixie.sql` … `0008_true_boomer.sql`) berisi kurang lebih:

```sql
CREATE TABLE `survey_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(100) NOT NULL,
	`name` varchar(150) NOT NULL,
	`order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `survey_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `survey_categories_slug_unique` UNIQUE(`slug`)
);
```

Jalankan migration seperti biasa sesuai workflow project (`bunx drizzle-kit migrate` atau
mekanisme yang sudah dipakai untuk migration 0000–0008).

---

## 2. Seeder: 3 opsi kategori

Buat file baru `src/server/db/seedCategories.ts`:

```ts
import { db } from "./index";
import { surveyCategories } from "./schema";

export const CATEGORY_SEED_DATA = [
	{ slug: "survey-kepuasan", name: "Survey Kepuasan", order: 0 },
	{ slug: "tracer-study", name: "Tracer Study", order: 1 },
	{ slug: "survey-pengguna", name: "Survey Pengguna", order: 2 },
] as const;

export async function seedSurveyCategories() {
	console.log("📚 Seeding survey categories...");
	for (const cat of CATEGORY_SEED_DATA) {
		await db
			.insert(surveyCategories)
			.values(cat)
			.onDuplicateKeyUpdate({ set: { name: cat.name, order: cat.order } });
	}
	console.log(`✅ ${CATEGORY_SEED_DATA.length} survey categories seeded.`);
}
```

`onDuplicateKeyUpdate` (berdasarkan unique constraint di `slug`) membuat seeder ini **idempotent**
— aman dijalankan berkali-kali tanpa membuat duplikat atau butuh `TRUNCATE`.

### Panggil dari seeder utama

Edit `src/server/db/seed.ts`:

```diff
 import { db } from "./index";
 import {
 	answers,
 	questionOptions,
 	questions,
 	responses,
 	sections,
 	surveys,
 	users,
 } from "./schema";
+import { seedSurveyCategories } from "./seedCategories";
```

Lalu di dalam `main()`, panggil sebelum bagian "3. Process each survey" (setelah tables di-clear
dan users di-seed), supaya categories sudah ada saat survey rows dibuat:

```diff
 	const adminId = admin.id;
 	console.log(`✅ Users seeded. Admin ID = ${adminId}`);
 
+	// 2b. Seed fixed survey category options
+	await seedSurveyCategories();
+
 	// Paths
 	const rootDir = process.cwd();
```

### Selaraskan slug di `surveysToSeed`

Slug lama di `seed.ts` (`tracer_study`, `kepuasan_mahasiswa`) tidak cocok dengan slug baru.
Update:

```diff
 const surveysToSeed: SurveyConfig[] = [
 	{
 		asliFile: "Kuesioner Tracer Study (Responses) (9) - Form Responses 1.csv",
 		slug: "tracer-study",
 		title: "Kuesioner Tracer Study",
-		category: "tracer_study",
+		category: "tracer-study",
 	},
 	{
 		asliFile: "Survey Kepuasan Mahasiswa (Responses) - Form responses 1.csv",
 		slug: "kepuasan-mahasiswa",
 		title: "Survey Kepuasan Mahasiswa",
-		category: "kepuasan_mahasiswa",
+		category: "survey-kepuasan",
 	},
 ];
```

> Catatan: `slug` di objek ini adalah slug **survey** (untuk URL `/survey/:slug`), beda konsep
> dari slug **kategori** yang baru kita tambahkan — kebetulan `"tracer-study"` sama persis untuk
> keduanya di baris pertama, itu cuma kebetulan penamaan, bukan bug.

---

## 3. Server function: ambil daftar kategori

Tambahkan fungsi publik (dipakai baik oleh admin maupun landing page, tidak perlu login) di
`src/server/adminSurveyFunctions.ts` — taruh dekat fungsi list lain, sebelum
`getAdminSurveysListFn`:

```ts
// 2b. Fetch fixed list of survey categories (used by create/settings forms + public landing filter)
export const getSurveyCategoriesFn = createServerFn({ method: "GET" }).handler(
	async () => {
		return db
			.select({
				slug: surveyCategories.slug,
				name: surveyCategories.name,
			})
			.from(surveyCategories)
			.orderBy(surveyCategories.order);
	},
);
```

Tambahkan `surveyCategories` ke import di bagian atas file:

```diff
 import {
 	answers,
 	questionOptions,
 	questions,
 	reportGenerations,
 	responses,
 	sections,
 	surveys,
+	surveyCategories,
 	users,
 } from "./db/schema";
```

Fungsi ini sengaja **tidak** dipagari `assertUser()`/`assertAdmin()` karena landing page publik
(`src/routes/index.tsx`) juga perlu memanggilnya untuk membangun filter kategori.

---

## 4. Wiring: Form buat survey (`src/routes/admin/surveys.new.tsx`)

Route ini saat ini tidak punya `loader`, cuma `beforeLoad` untuk cek akses. Tambahkan loader
untuk fetch kategori:

```diff
 import { createAdminSurveyFn } from "../../server/adminSurveyFunctions";
+import { getSurveyCategoriesFn } from "../../server/adminSurveyFunctions";
 import { getSessionFn } from "../../server/authFunctions";

 export const Route = createFileRoute("/admin/surveys/new")({
 	beforeLoad: async () => {
 		const user = await getSessionFn();
 		if (user?.role === "visitor") {
 			toast.error("Anda tidak memiliki akses untuk membuat survei.");
 			throw redirect({ to: "/admin/surveys" });
 		}
 	},
+	loader: async () => {
+		const categories = await getSurveyCategoriesFn();
+		return { categories };
+	},
 	component: CreateSurveyComponent,
 });
```

(Kedua import dari file yang sama bisa digabung jadi satu baris `import { ... } from "../../server/adminSurveyFunctions"`.)

Update komponen — ambil `categories` dari loader dan default `category` state ke opsi pertama:

```diff
 function CreateSurveyComponent() {
 	const router = useRouter();
+	const { categories } = Route.useLoaderData();
 	const bannerFileInputRef = useRef<HTMLInputElement>(null);
 	const [title, setTitle] = useState("");
 	const [slug, setSlug] = useState("");
-	const [category, setCategory] = useState("tracer");
+	const [category, setCategory] = useState(categories[0]?.slug ?? "");
```

Ganti `<select>` kategori yang hardcode (baris ~194–207) dengan render dinamis:

```diff
 							<select
 								id="category"
 								value={category}
 								onChange={(e) => setCategory(e.target.value)}
 								className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 pr-10 text-sm text-[#1a1b21] focus:border-[#4A0000] focus:ring-1 focus:ring-[#4A0000] focus:bg-white outline-none transition-colors appearance-none cursor-pointer"
 								disabled={loading}
 							>
-								<option value="tracer">Tracer Study Alumni</option>
-								<option value="kepuasan">
-									Survei Kepuasan Mahasiswa (Internal)
-								</option>
-								<option value="pengguna">Survei Pengguna Layanan</option>
-								<option value="lainnya">Lainnya</option>
+								{categories.map((cat) => (
+									<option key={cat.slug} value={cat.slug}>
+										{cat.name}
+									</option>
+								))}
 							</select>
```

---

## 5. Wiring: Tab Setelan di detail survey (`src/routes/admin/surveys.$surveyId.tsx`)

Route ini sudah punya `loader`. Tambahkan fetch kategori paralel dengan fetch lain yang sudah ada:

```diff
 import {
+	getSurveyCategoriesFn,
 	deleteAdminSurveyResponseFn,
 	duplicateAdminSurveyFn,
 	...
 } from "../../server/adminSurveyFunctions";

 export const Route = createFileRoute("/admin/surveys/$surveyId")({
 	...
 	loader: async ({ params, deps }) => {
 		const surveyId = parseInt(params.surveyId, 10);
-		const detail = await getAdminSurveyDetailFn({ data: surveyId });
+		const [detail, categories] = await Promise.all([
+			getAdminSurveyDetailFn({ data: surveyId }),
+			getSurveyCategoriesFn(),
+		]);
 		let stats = null;
 		let responseDetail = null;
 		let responsesIndex = null;
 		...
-		return { detail, stats, responseDetail, responsesIndex, surveyId };
+		return { detail, stats, responseDetail, responsesIndex, surveyId, categories };
 	},
```

Update komponen:

```diff
 function SurveyDetailComponent() {
-	const { detail, stats, responseDetail, responsesIndex, surveyId } =
+	const { detail, stats, responseDetail, responsesIndex, surveyId, categories } =
 		Route.useLoaderData();
```

Ganti `<select>` kategori hardcode (baris ~2901–2914, di dalam tab Setelan) dengan render
dinamis — sama seperti form buat survey:

```diff
 								<select
 									id="settingsCategory"
 									value={settingsCategory}
 									onChange={(e) => setSettingsCategory(e.target.value)}
 									className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 pr-10 text-sm text-[#1a1b21] focus:border-[#4A0000] focus:ring-1 focus:ring-[#4A0000] focus:bg-white outline-none transition-colors appearance-none cursor-pointer"
 									disabled={isSavingSettings || user?.role === "visitor"}
 								>
-									<option value="tracer">Tracer Study Alumni</option>
-									<option value="kepuasan">
-										Survei Kepuasan Mahasiswa (Internal)
-									</option>
-									<option value="pengguna">Survei Pengguna Layanan</option>
-									<option value="lainnya">Lainnya</option>
+									{categories.map((cat) => (
+										<option key={cat.slug} value={cat.slug}>
+											{cat.name}
+										</option>
+									))}
 								</select>
```

`settingsCategory` sendiri sudah di-set dari `detail.survey.category` di `useEffect` yang ada
(baris ~295) — tidak perlu diubah, karena sekarang `detail.survey.category` akan berisi slug baru
seperti `"survey-kepuasan"`, yang otomatis match dengan salah satu `<option value>` di atas.

---

## 6. Wiring: Landing page — section daftar survey (`src/routes/index.tsx`)

### 6a. Fetch kategori di loader

```diff
 import {
   getPublicLandingStatsFn,
   getPublishedSurveysFn,
 } from "../server/surveyFunctions";
+import { getSurveyCategoriesFn } from "../server/adminSurveyFunctions";

 export const Route = createFileRoute("/")({
   loader: async () => {
-    const [surveys, stats] = await Promise.all([
+    const [surveys, stats, categories] = await Promise.all([
       getPublishedSurveysFn(),
       getPublicLandingStatsFn(),
+      getSurveyCategoriesFn(),
     ]);
-    return { surveys, stats };
+    return { surveys, stats, categories };
   },
   component: HomeComponent,
 });
```

### 6b. Bangun mapping slug → nama, dan ganti filter kategori yang "mati"

```diff
 function HomeComponent() {
-  const { surveys, stats } = Route.useLoaderData();
+  const { surveys, stats, categories } = Route.useLoaderData();
   const [searchQuery, setSearchQuery] = useState("");
   const [selectedCategory, setSelectedCategory] = useState("Semua");
   const [sortBy, setSortBy] = useState("Terbaru");
   ...

-  // Extract unique categories
-  const categories = [
-    "Semua",
-    ...Array.from(new Set(surveys.map((s) => s.category).filter(Boolean))),
-  ];
+  // slug -> readable name, e.g. "survey-kepuasan" -> "Survey Kepuasan"
+  const categoryNameBySlug: Record<string, string> = Object.fromEntries(
+    categories.map((c) => [c.slug, c.name]),
+  );
+  const categoryFilterOptions = [{ slug: "Semua", name: "Semua Kategori" }, ...categories];
```

`selectedCategory` state tetap disimpan sebagai **slug** (atau `"Semua"`), filter logic di bawahnya
tidak perlu diubah karena sudah membandingkan `s.category === selectedCategory` (sekarang otomatis
cocok karena `surveys.category` berisi slug).

### 6c. Render filter kategori (sebelumnya tidak ada UI-nya sama sekali)

Tambahkan di dekat dropdown "Urutkan" yang sudah ada (sekitar baris ~240), sebelum atau sesudahnya:

```tsx
{/* Category Filter */}
<div className="flex items-center gap-2 flex-wrap">
  <span className="text-xs font-bold text-[#747683] uppercase tracking-wider self-center">
    Kategori:
  </span>
  {categoryFilterOptions.map((cat) => (
    <button
      key={cat.slug}
      type="button"
      onClick={() => setSelectedCategory(cat.slug)}
      className={`text-xs font-semibold px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
        selectedCategory === cat.slug
          ? "bg-[#4A0000] border-[#4A0000] text-white"
          : "bg-slate-50 border-outline-variant/80 text-[#1a1b21] hover:border-primary"
      }`}
    >
      {cat.name}
    </button>
  ))}
</div>
```

Sesuaikan class Tailwind dengan gaya visual sekitar bila perlu (lihat panduan desain di
`frontend-design` skill kalau butuh referensi warna/spacing).

### 6d. Tampilkan nama kategori yang readable di kartu survey

```diff
                         <span className="text-[10px] font-bold uppercase tracking-widest text-[#747683]">
-                          {survey.category || "General"}
+                          {categoryNameBySlug[survey.category] || survey.category || "General"}
                         </span>
```

---

## 7. Migrasi data kategori yang sudah ada (WAJIB dijalankan sekali di data existing)

Karena nilai `category` yang sudah tersimpan di tabel `surveys` saat ini masih pakai skema lama
(`tracer`, `kepuasan`, `pengguna`, `lainnya`, `tracer_study`, `kepuasan_mahasiswa` — tergantung
survey dibuat lewat form yang mana), jalankan SQL berikut **sekali** setelah migration tabel baru
selesai, supaya data lama ikut selaras dengan slug baru:

```sql
UPDATE surveys SET category = 'survey-kepuasan' WHERE category IN ('kepuasan', 'kepuasan_mahasiswa');
UPDATE surveys SET category = 'tracer-study'    WHERE category IN ('tracer', 'tracer_study');
UPDATE surveys SET category = 'survey-pengguna' WHERE category IN ('pengguna');
```

`'lainnya'` (Lainnya / Other) tidak punya padanan di 3 opsi baru. Putuskan salah satu:
- **Opsi A (disarankan untuk konsistensi 3-opsi-saja):** map manual per-survey ke salah satu dari
  3 kategori yang paling sesuai isinya, lalu jalankan `UPDATE surveys SET category = '...' WHERE id = <id>;`
  untuk survey-survey tersebut.
- **Opsi B:** kalau memang butuh kategori "lainnya" tetap ada, tambahkan 1 baris lagi ke
  `CATEGORY_SEED_DATA` di `seedCategories.ts` (`{ slug: "lainnya", name: "Lainnya", order: 3 }`)
  dan biarkan `UPDATE surveys SET category = 'lainnya' WHERE category = 'lainnya';` (no-op, sudah
  cocok). Ini di luar permintaan awal (3 opsi), jadi lakukan hanya kalau memang dibutuhkan.

Cek dulu datanya sebelum menjalankan UPDATE:
```sql
SELECT category, COUNT(*) FROM surveys GROUP BY category;
```

---

## 8. Konsistensi tambahan (opsional, disarankan)

`src/routes/admin/analytics.tsx` masih pakai data mock dengan `category: "tracer"` /
`"kepuasan"` dan filter `<select>` hardcode senilai `tracer/kepuasan/pengguna/lainnya` (baris
~28–78, ~122). Ini terpisah dari perubahan wajib di atas (halaman analytics pakai data statis,
bukan dari DB), tapi kalau nanti dihubungkan ke data asli, sebaiknya pakai
`getSurveyCategoriesFn()` yang sama supaya labelnya konsisten dengan 3 tempat lain.

---

## 9. Checklist

- [ ] Tambahkan tabel `survey_categories` di `schema.ts`, generate & jalankan migration.
- [ ] Buat `seedCategories.ts` berisi 3 opsi (`survey-kepuasan`, `tracer-study`, `survey-pengguna`),
      panggil dari `seed.ts`.
- [ ] Selaraskan slug kategori di `surveysToSeed` (`seed.ts`) dengan slug baru.
- [ ] Tambah `getSurveyCategoriesFn` di `adminSurveyFunctions.ts`.
- [ ] Sambungkan ke form buat survey (`surveys.new.tsx`).
- [ ] Sambungkan ke tab Setelan (`surveys.$surveyId.tsx`).
- [ ] Sambungkan ke landing page: fetch di loader, mapping slug→nama, **render UI filter kategori
      yang sebelumnya tidak ada**, dan perbaiki label kartu survey.
- [ ] Jalankan SQL migrasi data kategori lama → slug baru, putuskan nasib kategori `"lainnya"`.
- [ ] `bun run db:seed` (atau perintah seeder yang dipakai project) lalu cek `SELECT * FROM survey_categories;`.
