import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/survey/$surveySlug/thank-you")({
  component: ThankYouComponent,
});

function ThankYouComponent() {
  return (
    <main className="grow flex items-center justify-center px-3 py-6 sm:p-8 md:p-12 w-full bg-slate-50 min-h-[calc(100vh-80px)]">
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-[0_8px_32px_rgba(11,62,156,0.04)] border border-slate-200 overflow-hidden">
        {/* Hero Graphic Section */}
        <div className="relative h-48 md:h-64 w-full bg-slate-100 flex items-center justify-center overflow-hidden">
          {/* Gradient backdrop */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#dbe1ff] to-white opacity-60"></div>
          <div className="relative z-10 bg-[#002972] rounded-full pb-2 p-4 shadow-lg animate-bounce">
            <span className="material-symbols-outlined text-white text-5xl md:text-6xl block">
              check_circle
            </span>
          </div>
        </div>
        {/* Content Section */}
        <div className="p-6 md:p-12 text-center space-y-6">
          <div className="space-y-3">
            <h1 className="font-bold text-3xl text-[#002972]">
              Data Berhasil Disimpan
            </h1>
            <p className="text-base text-[#434652] mx-auto">
              Terima kasih atas partisipasi Anda mengisi kuesioner. Kontribusi
              dan data yang Anda berikan sangat berharga bagi evaluasi kurikulum
              dan mutu Fakultas Kedokteran Gigi, Universitas Hasanuddin.
            </p>
          </div>
          {/* <div className="inline-flex items-center gap-1.5 bg-[#eeedf6] px-4 py-2 rounded-full border border-slate-200">
            <span className="material-symbols-outlined text-[#a03f32] text-sm">
              verified
            </span>
            <span className="text-xs md:text-sm font-semibold text-[#1a1b21]">
              Respons Anda telah berhasil terekam dengan aman.
            </span>
          </div> */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/"
              className="sm:w-auto inline-flex items-center justify-center gap-2 bg-[#002972] text-white hover:bg-[#0b3e9c] px-6 py-3 rounded-lg text-sm font-semibold shadow-sm transition-all scale-98 active:scale-95"
            >
              <span className="material-symbols-outlined text-lg">home</span>
              <span>Kembali ke Beranda</span>
            </Link>
          </div>
        </div>
        {/* Decorative Bottom Bar */}
        <div className="h-2 w-full bg-gradient-to-r from-[#002972] to-[#a03f32]"></div>
      </div>
    </main>
  );
}
