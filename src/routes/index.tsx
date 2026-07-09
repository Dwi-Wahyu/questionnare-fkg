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
      {/* Hero Section */}
      <section className="w-full relative border-b border-surface-variant flex flex-col items-center justify-center py-[80px] px-6 overflow-hidden bg-white">
        {/* Grid background pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(#002972 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        ></div>
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-fixed opacity-40 rounded-full mix-blend-multiply filter blur-3xl translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary-fixed opacity-20 rounded-full mix-blend-multiply filter blur-3xl -translate-x-1/2 translate-y-1/2 pointer-events-none"></div>

        <div className="relative z-10 max-w-[800px] text-center flex flex-col items-center gap-6">
          <img
            alt="Logo Unhas"
            className="h-24 w-auto mb-2 drop-shadow-md"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCYJY1XQGTzHS5Ne0th7CSuT_H-kZPorNu5NvD9yVyzDiKAaOW5YygJ3_UOGgKoCx-4eriSMzcSonCnz1AiEL3U9zVuhG2HdJV-lci_T8EvW8UBoq0KYP8IeGq4WcG_fbpJn1ruKDMbfhB2ChTWZEMZ-9EjAoOasT5IUZaeqTb_XrxRzVSRktjdfoDrMYHV0OyRcBEtWURGhLHTX6frMWzrxFmAuP6-8iXOtSd2zUcW2UKKBgpxIS9vu6rQEKSRGuKOVw"
          />
          <h1 className="font-bold text-4xl md:text-5xl text-[#002972] tracking-tight">
            Platform Tracer Study &amp; Survey FKG Unhas
          </h1>
          <p className="text-lg text-[#434652] max-w-[600px]">
            Membangun masa depan pendidikan kedokteran gigi yang lebih baik
            melalui data yang akurat dan partisipasi aktif seluruh alumni dan
            sivitas akademika.
          </p>
          <div className="mt-4">
            <a
              href="#surveys-list"
              className="bg-[#002972] text-white font-semibold px-8 py-3 rounded-lg hover:scale-95 transition-transform shadow-md inline-block"
            >
              Jelajahi Survey
            </a>
          </div>
        </div>
      </section>

      {/* Main Content Canvas */}
      <section
        id="surveys-list"
        className="max-w-[1280px] w-full px-6 py-16 flex flex-col gap-12"
      >
        {/* Search & Filter Bar */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-[#eeedf6] p-4 rounded-xl border border-surface-variant shadow-sm w-full max-w-[800px] mx-auto">
          <div className="relative w-full grow">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#747683]">
              search
            </span>
            <input
              className="w-full pl-10 pr-4 py-2 border border-outline-variant rounded-lg text-sm bg-white focus:border-[#002972] focus:ring-1 focus:ring-[#002972] focus:outline-none transition-colors"
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
                className="bg-white border border-surface-variant rounded-xl p-6 flex flex-col gap-4 shadow-[0_4px_12px_rgba(11,62,156,0.03)] hover:shadow-[0_8px_24px_rgba(11,62,156,0.08)] transition-shadow duration-300 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#ffdad4] opacity-0 group-hover:opacity-20 rounded-bl-full transition-opacity duration-300"></div>
                <div className="flex justify-between items-start">
                  <span className="inline-flex items-center bg-[#dbe1ff] text-[#0f409e] text-xs font-semibold px-2.5 py-1 rounded-full">
                    {survey.category === "tracer"
                      ? "Tracer Study"
                      : "Survei Kepuasan"}
                  </span>
                  <span className="text-[#747683] text-xs flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">
                      help
                    </span>
                    {survey.questionCount} pertanyaan
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-[#1a1b21] mb-1 group-hover:text-[#002972] transition-colors">
                    {survey.title}
                  </h3>
                  <p className="text-sm text-[#434652] line-clamp-2">
                    {survey.description ||
                      "Silakan klik tombol di bawah untuk berpartisipasi dalam kuesioner ini."}
                  </p>
                </div>
                <div className="mt-auto pt-4">
                  <Link
                    to="/survey/$surveySlug"
                    params={{ surveySlug: survey.slug }}
                    className="w-full bg-[#0b3e9c] text-white hover:bg-[#002972] text-sm font-semibold py-2.5 rounded-lg hover:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                  >
                    <span>Mulai Survey</span>
                    <span className="material-symbols-outlined text-sm">
                      arrow_forward
                    </span>
                  </Link>
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
