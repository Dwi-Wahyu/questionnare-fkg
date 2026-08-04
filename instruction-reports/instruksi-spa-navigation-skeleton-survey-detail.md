# Ringkasan Perubahan: SPA Navigation + Skeleton Loading Halaman Detail Survey Admin

- **Modified Files:**
  - [`src/routes/admin/surveys.$surveyId.tsx`](file:///home/dwiwahyuilahi/Personal/Projects/FKG/tracert-study/source-code/src/routes/admin/surveys.$surveyId.tsx)

- **Logic Changes:**
  1. **Non-blocking Route Loader (`loaderDeps` & `loader`):**
     - Mengubah `loaderDeps` menjadi `() => ({})` sehingga perubahan search params (`tab`, `subtab`, `qid`, `page`) tidak lagi memicu re-fetch blocking dari route loader.
     - Mengubah signature `loader` menjadi `({ params, location })` untuk hanya melakukan initial seed saat pertama kali membuka halaman atau refresh.
  2. **Feedback Visual Initial Load (`pendingComponent`):**
     - Menambahkan `pendingComponent` dengan elemen `Skeleton` (`pendingMs: 100`, `pendingMinMs: 400`) pada konfigurasi `createFileRoute("/admin/surveys/$surveyId")` untuk me-render skeleton loading saat pengguna masuk ke halaman detail survei dari halaman lain.
  3. **Data Fetching Client-Side Non-blocking (`useEffect`):**
     - Menambahkan state `activeResponsesIndex`, `activeResponseDetail`, dan `isLoadingResponseDetail`.
     - Menambahkan `useEffect` client-side untuk memuat daftar & detail respon individual secara async saat berpindah ke `subtab === "individual"` atau mengubah `page` tanpa menghambat perpindahan UI/URL (SPA murni).
  4. **Pembaruan Referensi Component & Skeleton State:**
     - Mengganti seluruh referensi `responsesIndex` & `responseDetail` pada JSX dan event handler menjadi `activeResponsesIndex` & `activeResponseDetail`.
     - Menambahkan overlay skeleton & efek `opacity-50` selama `isLoadingResponseDetail` bernilai true saat berpindah halaman respon individual.

- **Impact on Graph:**
  - `surveys.$surveyId.tsx` memanfaatkan state & effect internal baru untuk menangani loading state client-side. Node `src/routes/admin/surveys.$surveyId.tsx` diperbarui di graphify dengan keterikatan ke `getAdminSurveyResponsesListFn` dan `getAdminSurveyResponseDetailFn` melalui client-side effects.
