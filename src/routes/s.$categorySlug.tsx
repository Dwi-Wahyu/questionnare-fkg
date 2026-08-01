import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { SearchX } from "lucide-react";
import { getActiveSurveyByCategoryFn } from "../server/surveyFunctions";

// Stable redirect target for per-category subdomains (nginx), e.g.:
//   kepuasan-mahasiswa.minmat2026.my.id -> /s/survey-kepuasan
//   pengaduan.minmat2026.my.id          -> /s/layanan-pengaduan
//   tracerstudy.minmat2026.my.id        -> /s/tracer-study
//   survey-pengguna.minmat2026.my.id    -> /s/survey-pengguna
//
// The nginx server block for a category never changes. Only the survey
// record in the DB changes each period (publish the new one, archive the
// old one) — this route always resolves to whichever survey is currently
// published in that category.
export const Route = createFileRoute("/s/$categorySlug")({
  loader: async ({ params }) => {
    const { category, survey } = await getActiveSurveyByCategoryFn({
      data: params.categorySlug,
    });

    if (survey) {
      throw redirect({
        to: "/survey/$surveySlug",
        params: { surveySlug: survey.slug },
      });
    }

    return { category, categorySlug: params.categorySlug };
  },
  component: NoActiveSurveyComponent,
});

function NoActiveSurveyComponent() {
  const { category, categorySlug } = Route.useLoaderData();

  return (
    <main className="grow flex items-center w-full justify-center px-3 py-6 sm:p-8 relative overflow-hidden bg-slate-50 min-h-screen">
      <div className="relative z-10 w-full text-center flex justify-center">
        <div className="bg-white w-fit md:w-120 rounded-xl shadow-lg border border-slate-200 p-8 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
            <SearchX className="h-10 w-10 block" />
          </div>
          <h2 className="text-2xl font-bold text-center text-[#1a1b21] mt-2">
            Belum Ada Survei Aktif
          </h2>
          <p className="text-sm text-[#434652] text-center leading-relaxed">
            Saat ini belum ada kuesioner{" "}
            <strong>{category?.name ?? categorySlug}</strong> yang
            dipublikasikan. Silakan coba lagi nanti.
          </p>
          <Link
            to="/"
            className="mt-4 bg-[#4A0000] hover:bg-[#B00000] text-white text-sm font-semibold py-2 px-5 rounded-lg transition-colors"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    </main>
  );
}
