import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { getPublishedSurveysFn } from "../server/surveyFunctions";

export const Route = createFileRoute("/")({
  loader: async () => {
    return await getPublishedSurveysFn();
  },
  component: HomeComponent,
});

function HomeComponent() {
  const surveys = Route.useLoaderData();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSurveys = surveys.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="grow flex flex-col items-center w-full">
      {/* Main Content Canvas */}
      <section className="max-w-[1280px] w-full px-6 py-12 md:py-16 flex flex-col gap-8">
        {/* Page Header */}
        <div className="flex flex-col gap-2">
          <h1 className="font-bold text-3xl md:text-4xl text-[#002972] tracking-tight text-center md:text-left">
            Fakultas Kedokteran Gigi
          </h1>
          <p className="text-[10px] md:text-xs text-[#434652] font-semibold uppercase tracking-widest text-center md:text-left leading-none mt-0.5">
            Universitas Hasanuddin
          </p>
          <p className="text-sm md:text-base text-[#434652] mt-4 w-full text-center md:text-left">
            Selamat datang di portal kuesioner dan Tracer Study. Silakan pilih
            salah satu kuesioner aktif di bawah ini untuk mulai memberikan umpan
            balik Anda. Umpan balik Anda sangat berharga bagi evaluasi kurikulum
            dan akreditasi fakultas.
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-[#eeedf6] rounded-xl shadow-sm w-full">
          <div className="relative w-full grow">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#747683]">
              search
            </span>
            <input
              className="w-full pl-10 pr-4 py-2 border border-outline-variant rounded-lg text-sm bg-white"
              placeholder="Cari judul survey..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Survey Grid */}
        {filteredSurveys.length === 0 ? (
          <div className="text-center bg-white p-12 rounded-xl border border-surface-variant shadow-sm max-w-[600px] mx-auto w-full">
            <span className="material-symbols-outlined text-4xl text-[#747683]">
              help_outline
            </span>
            <p className="mt-4 text-[#434652] font-semibold">
              Tidak ada kuesioner aktif yang ditemukan.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSurveys.map((survey) => (
              <div
                key={survey.id}
                className="bg-white rounded-xl flex flex-col shadow-[0_4px_12px_rgba(11,62,156,0.03)] hover:shadow-[0_8px_24px_rgba(11,62,156,0.08)] transition-all duration-300 relative overflow-hidden group border border-slate-100"
              >
                {/* Banner Header */}
                <div className="h-40 w-full relative overflow-hidden bg-slate-100 shrink-0">
                  {survey.bannerUrl ? (
                    <img
                      src={survey.bannerUrl}
                      alt={survey.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#0b3e9c]/20 to-[#fe8674]/15 flex items-center justify-center">
                      <span className="material-symbols-outlined text-4xl text-[#0b3e9c]/45">
                        poll
                      </span>
                    </div>
                  )}
                  <div className="absolute top-3 left-3">
                    <span className="inline-flex gap-2 items-center bg-[#0b3e9c] text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm">
                      <span className="material-symbols-outlined text-xs">
                        help
                      </span>
                      {survey.questionCount} pertanyaan
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 flex-1 flex flex-col gap-3">
                  <div className="flex-grow">
                    <h3 className="font-bold text-base text-[#1a1b21] mb-1 group-hover:text-[#002972] transition-colors line-clamp-2 leading-snug">
                      {survey.title}
                    </h3>
                    <p className="text-xs text-[#434652] line-clamp-2 leading-relaxed">
                      {survey.description ||
                        "Silakan klik tombol di bawah untuk berpartisipasi dalam kuesioner ini."}
                    </p>
                  </div>

                  <div className="pt-2">
                    <Link
                      to="/survey/$surveySlug"
                      params={{ surveySlug: survey.slug }}
                      className="w-full bg-[#0b3e9c] text-white hover:bg-[#002972] text-xs font-semibold py-2.5 rounded-lg hover:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                    >
                      <span>Mulai Survey</span>
                      <span className="material-symbols-outlined text-sm">
                        arrow_forward
                      </span>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Footer Component */}
      <footer className="bg-[#eeedf6] w-full mt-auto border-t border-outline-variant">
        <div className="flex flex-col md:flex-row justify-between items-center px-6 py-8 max-w-[1280px] mx-auto w-full gap-4 text-xs text-[#434652]">
          <div className="flex flex-col md:flex-row items-center gap-2 md:gap-6">
            <span className="font-bold text-[#002972] text-sm">
              FKG Universitas Hasanuddin
            </span>
            <p>© 2026 FKG Universitas Hasanuddin. All Rights Reserved.</p>
          </div>
          <nav className="flex gap-4">
            <span className="text-secondary-fixed-variant">
              Hasanuddin University, Makassar, Indonesia
            </span>
          </nav>
        </div>
      </footer>
    </div>
  );
}
