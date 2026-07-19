# Fix: "Rendered fewer hooks than expected" saat Submit Response

**File:** `src/routes/survey.$surveySlug.tsx`
**Komponen:** `SurveyTakingComponent()`
**Kapan muncul:** tepat setelah responden submit jawaban dan aplikasi `router.navigate()` ke
`/survey/$surveySlug/thank-you`.

---

## 1. Root cause

`SurveyTakingComponent` adalah komponen parent untuk route `/survey/$surveySlug` **dan** route
anak `/survey/$surveySlug/thank-you` (lihat `src/routes/survey.$surveySlug.thank-you.tsx`). Ia
menangani path thank-you dengan cara `return <Outlet />` di paling atas komponen:

```tsx
function SurveyTakingComponent() {
	const loaderData = Route.useLoaderData();
	const router = useRouter();
	const location = useLocation();

	// If the active route is the nested thank-you page, render the child Outlet
	if (location.pathname.endsWith("/thank-you")) {
		return <Outlet />;                    // <-- early return #1
	}

	if (loaderData.error) {
		return ( /* error card */ );          // <-- early return #2
	}

	const { survey, sections, questions } = loaderData.data!;

	useSurveyLive(survey?.id || 0, "filler"); // <-- hook AFTER 2 early returns

	const isExpired = isSurveyExpired(...);
	if (isExpired) {
		return ( /* expired card */ );        // <-- early return #3
	}

	const [clientDraftId, setClientDraftId] = useState("");  // <-- hooks AFTER 3 early returns
	const [currentSectionIndex, setCurrentSectionIndex] = useState(-1);
	const [answersState, setAnswersState] = useState(...);
	const [errors, setErrors] = useState(...);
	const [loading, setLoading] = useState(false);
	const formRef = useRef<HTMLFormElement>(null);

	useEffect(() => { ... }, [survey.id]);
	// ...rest of the component
}
```

React requires the **same hooks, in the same order, on every render** of a given component
instance. Here:

- On the render *while filling the survey*, the component takes the "normal" path and calls
  `useSurveyLive` + 5× `useState` + `useRef` + `useEffect` → **9 hooks** (on top of the 3 always‑called
  ones: `useLoaderData`, `useRouter`, `useLocation`).
- After a successful submit, `handleSubmit` calls:
  ```ts
  router.navigate({ to: "/survey/$surveySlug/thank-you", params: { surveySlug: survey.slug } });
  ```
  Because `SurveyTakingComponent` is the **same mounted component instance** for both the parent
  route and its `/thank-you` child, this navigation causes the *same instance* to re‑render — but
  this time `location.pathname.endsWith("/thank-you")` is `true`, so it hits `return <Outlet />`
  immediately and **none of the 9 hooks below it run**.

React sees 12 hooks on one render and 3 on the next, from the same component instance, and throws:

```
Error: Rendered fewer hooks than expected. This may be caused by an accidental early return statement.
```

This is a straightforward violation of the [Rules of Hooks](https://react.dev/warnings/invalid-hook-call-warning):
**hooks must be called unconditionally, before any early `return`.**

---

## 2. Fix

Move every hook call (`useSurveyLive`, all `useState`, `useRef`, `useEffect`) to the **top** of the
component — right after the 3 hooks that are already unconditional — and only branch (`if (...)
return ...`) **after** all hooks have been called. Guard the *bodies* of hooks that depend on
`survey` instead of skipping the hook call itself.

### Patch

```diff
 function SurveyTakingComponent() {
 	const loaderData = Route.useLoaderData();
 	const router = useRouter();
 	const location = useLocation();
 
-	// If the active route is the nested thank-you page, render the child Outlet
-	if (location.pathname.endsWith("/thank-you")) {
-		return <Outlet />;
-	}
-
-	if (loaderData.error) {
-		return (
-			<main ...>...Survei Tidak Ditemukan...</main>
-		);
-	}
-
-	const { survey, sections, questions } = loaderData.data!;
-
-	// Register presence as filler (respondent)
-	useSurveyLive(survey?.id || 0, "filler");
-
-	const isExpired = isSurveyExpired(
-		(survey as any).periodValueEnd,
-		(survey as any).periodType || "month",
-	);
-	if (isExpired) {
-		return (
-			<main ...>...Survei Telah Berakhir...</main>
-		);
-	}
-
-	const [clientDraftId, setClientDraftId] = useState("");
+	const isThankYouPath = location.pathname.endsWith("/thank-you");
+	const hasError = !!loaderData.error;
+	const survey = loaderData.data?.survey;
+	const sections = loaderData.data?.sections ?? [];
+	const questions = loaderData.data?.questions ?? [];
+	const isExpired = survey
+		? isSurveyExpired(
+				(survey as any).periodValueEnd,
+				(survey as any).periodType || "month",
+			)
+		: false;
+
+	// Register presence as filler (respondent).
+	// Hook is ALWAYS called — survey?.id may legitimately be 0 while loading/erroring.
+	useSurveyLive(survey?.id || 0, "filler");
+
+	const [clientDraftId, setClientDraftId] = useState("");
 	const [currentSectionIndex, setCurrentSectionIndex] = useState(-1); // -1 = Welcome Screen
 	const [answersState, setAnswersState] = useState<
 		Record<
 			number,
 			{
 				valueText?: string;
 				valueOptionIds?: number[];
 				valueGrid?: Record<string, number>;
 			}
 		>
 	>({});
 	const [errors, setErrors] = useState<Record<number, string>>({});
 	const [loading, setLoading] = useState(false);
 
 	const formRef = useRef<HTMLFormElement>(null);
 
 	// Load or initialize local draft
 	useEffect(() => {
+		if (!survey) return; // nothing to load yet (error state / thank-you path)
 		const draftKey = `fkg_survey_draft_${survey.id}`;
 		const savedDraftStr = localStorage.getItem(draftKey);
 
 		if (savedDraftStr) {
 			try {
 				const savedDraft = JSON.parse(savedDraftStr);
 				setClientDraftId(savedDraft.clientDraftId);
 				setAnswersState(savedDraft.answers || {});
 				setCurrentSectionIndex(savedDraft.currentSectionIndex ?? -1);
 			} catch (e) {
 				initializeNewDraft();
 			}
 		} else {
 			initializeNewDraft();
 		}
-	}, [survey.id]);
+	}, [survey?.id]);
+
+	// ── All hooks have now been called unconditionally. Safe to branch. ──
+
+	if (isThankYouPath) {
+		return <Outlet />;
+	}
+
+	if (hasError || !survey) {
+		return (
+			<main className="grow flex  items-center w-full justify-center px-3 py-6 sm:p-8 relative overflow-hidden bg-slate-50">
+				<div className="relative z-10 w-fulltext-center flex justify-center">
+					<div className="bg-white w-fit md:w-120 rounded-xl shadow-lg border border-slate-200 p-8 flex flex-col items-center gap-4">
+						<div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
+							<SearchX className="h-10 w-10 block" />
+						</div>
+						<h2 className="text-2xl font-bold text-center text-[#1a1b21] mt-2">
+							Survei Tidak Ditemukan
+						</h2>
+						<p className="text-sm text-[#434652] text-center leading-relaxed">
+							Maaf, kuesioner yang Anda cari tidak dapat ditemukan atau belum
+							dipublikasikan oleh administrator.
+						</p>
+						<Link
+							to="/"
+							className="mt-4 bg-[#4A0000] hover:bg-[#B00000] text-white text-sm font-semibold py-2 px-5 rounded-lg transition-colors"
+						>
+							Kembali ke Beranda
+						</Link>
+					</div>
+				</div>
+			</main>
+		);
+	}
+
+	if (isExpired) {
+		return (
+			<main className="grow flex  items-center w-full justify-center px-3 py-6 sm:p-8 relative overflow-hidden bg-slate-50">
+				<div className="relative z-10 w-fulltext-center flex justify-center">
+					<div className="bg-white w-fit md:w-120 rounded-xl shadow-lg border border-slate-200 p-8 flex flex-col items-center gap-4">
+						<div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
+							<Clock className="h-10 w-10 block" />
+						</div>
+						<h2 className="text-2xl font-bold text-[#1a1b21] mt-2">
+							Survei Telah Berakhir
+						</h2>
+						<p className="text-sm text-[#434652] leading-relaxed">
+							Maaf, kuesioner <strong>{survey.title}</strong> telah ditutup dan
+							tidak dapat diisi lagi karena sudah melewati periode pengisian.
+						</p>
+						<div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 w-full text-xs font-semibold text-slate-600 flex items-center justify-center gap-1.5">
+							<Clock className="h-4 w-4 block" />
+							Batas Waktu:{" "}
+							{getFormattedPeriod(
+								(survey as any).periodValueEnd,
+								(survey as any).periodType || "month",
+							)}
+						</div>
+						<Link
+							to="/"
+							className="mt-4 bg-[#4A0000] hover:bg-[#B00000] text-white text-sm font-semibold py-2 px-5 rounded-lg transition-colors"
+						>
+							Kembali ke Beranda
+						</Link>
+					</div>
+				</div>
+			</main>
+		);
+	}
 
 	// ...rest of the component (updateDraft, currentSection, handleStartSurvey,
 	// validateSection, handleNext, handleSubmit, dst.) TETAP SAMA seperti sekarang,
 	// hanya butuh menghapus `!` yang sekarang tidak perlu lagi kalau ada, karena
 	// TypeScript sudah bisa menyimpulkan `survey` non-null setelah guard di atas.
```

### Ringkasan perubahan
1. Ganti `const { survey, sections, questions } = loaderData.data!;` (yang melempar kalau
   `loaderData.data` undefined) dengan optional chaining + default array kosong, dideklarasikan
   **sebelum** hook manapun dipanggil.
2. Pindahkan `useSurveyLive(...)`, kelima `useState`, `useRef`, dan `useEffect` ke atas —
   sebelum blok `if` apa pun.
3. Tambahkan guard `if (!survey) return;` di dalam body `useEffect` (bukan skip pemanggilan
   hook‑nya).
4. Pindahkan ketiga `return` (thank‑you Outlet, error card, expired card) ke **bawah**, setelah
   semua hook dipanggil.
5. Dependency array `useEffect` berubah dari `[survey.id]` → `[survey?.id]` karena `survey` kini
   bisa `undefined` di render pertama sebelum guard.

### Kenapa ini aman
- Hook count sekarang **selalu 12** pada setiap render dari instance komponen ini, apa pun
  path‑nya (`/survey/:slug`, `/survey/:slug/thank-you`, error, atau expired). React tidak akan
  lagi melihat mismatch jumlah hook.
- `useSurveyLive(survey?.id || 0, "filler")` sudah lama ditulis dengan fallback `|| 0` — itu sinyal
  bahwa penulis kode sebelumnya sudah mengantisipasi `survey` bisa kosong, hanya saja
  peletakannya salah (setelah 2 early return, bukan sebelum semuanya).

---

## 3. Cara verifikasi

1. Jalankan dev server, buka `/survey/<slug-survey-aktif>`.
2. Isi dan submit jawaban sampai selesai.
3. Buka console browser — pastikan **tidak lagi muncul**:
   ```
   Error: Rendered fewer hooks than expected...
   ```
   dan halaman thank‑you tampil normal tanpa layar merah (`CatchBoundaryImpl`) sebelum
   ter‑recover.
4. Ulangi 2–3 kali berturut‑turut (submit → kembali isi ulang via link publik → submit lagi)
   untuk memastikan tidak ada flake.

## 4. Catatan tambahan (opsional, tidak wajib untuk fix ini)

`initializeNewDraft` dan beberapa handler lain di bawah `useEffect` masih mereferensikan
`survey.id` / `survey.slug` tanpa optional chaining. Karena baris‑baris itu **hanya
dieksekusi setelah** guard `if (hasError || !survey) return (...)` di langkah 2 lolos, TypeScript
akan otomatis mempersempit tipe `survey` menjadi non‑`undefined` di titik itu — jadi tidak perlu
diubah, asal urutan kode tetap: **hooks dulu → guard → sisa komponen**.
