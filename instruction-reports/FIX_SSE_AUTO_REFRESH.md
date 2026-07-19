# Laporan Perbaikan SSE Auto Refresh (Jawaban Tab Not Auto-Refreshing)

- **Modified Files:**
  - `src/server/surveyFunctions.ts`
  - `src/hooks/useSurveyLive.ts`
- **Logic Changes:**
  - **Required Fix (`src/server/surveyFunctions.ts`):** Mengubah `return await db.transaction(...)` menjadi `const result = await db.transaction(...)` agar eksekusi fungsi `submitResponseFn` berlanjut setelah transaksi database selesai. Dengan perubahan ini, pemanggilan `broadcast(data.surveyId, "answer", { at: Date.now() })` dapat dieksekusi dengan sukses untuk memberi tahu client yang sedang mendengarkan kanal SSE, lalu mengembalikan `result`.
  - **Optional Hardening (`src/hooks/useSurveyLive.ts`):** Mengubah event handler `es.onerror` pada hook client agar tidak mencatat log error pada setiap kegagalan koneksi transient (karena EventSource secara otomatis melakukan rekoneksi). Log warning (`console.warn`) hanya dicatat apabila koneksi benar-benar ditutup secara permanen (`EventSource.CLOSED`), guna mereduksi noise log di PM2/konsol browser.
- **Impact on Graph:**
  - Tidak ada relasi komponen baru yang terbentuk. Hubungan antara `submitResponseFn` (produsen event) dan `useSurveyLive` (konsumen event) sudah ada sebelumnya, namun sekarang berfungsi secara aktif dan benar.
