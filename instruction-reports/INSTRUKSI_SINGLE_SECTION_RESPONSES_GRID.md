# Ringkasan Perubahan: Layout Grid Tab Jawaban (Ringkasan)

- **Modified Files:**
  - [`src/routes/admin/surveys.$surveyId.tsx`](file:///home/dwiwahyuilahi/Personal/Projects/FKG/tracert-study/source-code/src/routes/admin/surveys.$surveyId.tsx#L2313-L2354)

- **Logic Changes:**
  - Menambahkan pengecekan `isSingleSection = groups.length <= 1` pada sub-tab "Ringkasan" di halaman detail survei admin (`/admin/surveys/$surveyId`).
  - Apabila survei hanya memiliki **satu bagian** (`isSingleSection` bernilai true):
    - Container outer bagian survei menggunakan 1 kolom (`grid grid-cols-1 gap-6 items-start`).
    - Kartu-kartu pertanyaan di dalam bagian tersebut ditampilkan dalam layout 2 kolom (`p-5 grid grid-cols-1 md:grid-cols-2 gap-6 items-start`) pada layar medium/desktop untuk mengisi area kosong di sebelah kanan halaman.
  - Apabila survei memiliki **lebih dari satu bagian** (`isSingleSection` bernilai false):
    - Tampilan dipertahankan seperti semula di mana bagian-bagian survei ditampilkan side-by-side dalam 2 kolom (`grid grid-cols-1 md:grid-cols-2 gap-6 items-start`), dan pertanyaan di dalamnya tersusun secara vertikal (`p-5 space-y-6`).

- **Impact on Graph:**
  - Tidak ada penambahan atau penghapusan komponen baru; relasi antar node/komponen pada keterikatan router dan komponen `ChartCard` tetap stabil.
