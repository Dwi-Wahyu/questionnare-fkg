# Laporan Perbaikan CSV Filter Select & Layout Ringkasan (Instruction 09)

- **Modified Files:**
  - `src/routes/admin/surveys.$surveyId.tsx`
- **Logic Changes:**
  - **Filter CSV:**
    - Menambahkan prop `items` pada komponen kustom `<Select>` yang berisikan mapping value-to-label (menggunakan `React.useMemo`). Ini memperbaiki isu di mana nilai terpilih (selected value) sebelumnya tidak muncul pada trigger select (karena Base UI membutuhkan daftar item untuk mencocokkan label pada `<SelectValue>`).
  - **Bento Card Ringkasan:**
    - Menghapus card "Status Pengumpulan" dari bento ringkasan.
    - Memindahkan card "Progress Pengisian Survei" ke sebelah kanan card "Total Jawaban" dengan layout grid responsif (`lg:col-span-1` untuk total jawaban dan `lg:col-span-2` untuk progress pengisian) di viewport lebar.
    - Menyesuaikan Skeleton loader agar mencerminkan tata letak kolom yang baru secara presisi saat halaman sedang direfresh/dimuat.
  - **Visual Charts per Bagian:**
    - Menambahkan properti `noCard?: boolean` pada komponen `ChartCard`.
    - Ketika `noCard` bernilai `true` (saat dirender di dalam card bagian/section card), `ChartCard` akan dirender tanpa layout pembungkus card bawaannya (`bg-white border shadow-sm rounded-xl` dan header bergaya berat), melainkan flat agar tidak ada nested card yang terlihat sempit/berantakan di dalam card bagian.
- **Impact on Graph:**
  - Dependensi tetap sama. Struktur modular `ChartCard` dan `Select` dipertahankan namun disesuaikan propertinya untuk memberikan tampilan visual yang lebih bersih dan standar.
