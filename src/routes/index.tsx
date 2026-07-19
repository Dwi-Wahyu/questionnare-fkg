import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  ChartBar,
  CircleHelp,
  FileText,
  Search,
  Timer,
  UsersRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import LightRays from "../components/LightRays";
import { Skeleton } from "../components/ui/Skeleton";
import {
  getPublicLandingStatsFn,
  getPublishedSurveysFn,
} from "../server/surveyFunctions";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [surveys, stats] = await Promise.all([
      getPublishedSurveysFn(),
      getPublicLandingStatsFn(),
    ]);
    return { surveys, stats };
  },
  component: HomeComponent,
});

function LiveFillingBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1.5 bg-[#B00000]/10 text-primary text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border border-[#B00000]/10">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#B00000] opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#B00000]" />
      </span>
      {count} sedang mengisi
    </span>
  );
}

function AnimatedCounter({
  value,
  duration = 1200,
}: {
  value: number;
  duration?: number;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    const startValue = 0;
    const endValue = value;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * (endValue - startValue) + startValue));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  }, [value, duration]);

  return <>{count}</>;
}

function HomeComponent() {
  const { surveys, stats } = Route.useLoaderData();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Semua");
  const [sortBy, setSortBy] = useState("Terbaru"); // "Terbaru" | "Pertanyaan"
  const [isPending, setIsPending] = useState(false);
  const [liveCounts, setLiveCounts] = useState<Record<number, number>>({});

  // Listen to aggregate live survey presence (SSE)
  useEffect(() => {
    const es = new EventSource("/api/surveys/live");
    es.addEventListener("presence", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data && typeof data === "object") {
          setLiveCounts(data);
        }
      } catch (err) {
        console.error("Error parsing aggregate presence SSE:", err);
      }
    });
    return () => {
      es.close();
    };
  }, []);

  // Local debounce/pending effect for transitions
  useEffect(() => {
    setIsPending(true);
    const timer = setTimeout(() => {
      setIsPending(false);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategory, sortBy]);

  // Extract unique categories
  const categories = [
    "Semua",
    ...Array.from(new Set(surveys.map((s) => s.category).filter(Boolean))),
  ];

  // Filter and sort logic
  let filteredSurveys = surveys.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (selectedCategory !== "Semua") {
    filteredSurveys = filteredSurveys.filter(
      (s) => s.category === selectedCategory,
    );
  }

  if (sortBy === "Terbaru") {
    filteredSurveys = [...filteredSurveys].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  } else if (sortBy === "Pertanyaan") {
    filteredSurveys = [...filteredSurveys].sort(
      (a, b) => b.questionCount - a.questionCount,
    );
  }

  return (
    <div className="grow flex flex-col items-center w-full bg-[#faf8ff] min-h-screen custom-scrollbar">
      {/* Wrapper for Hero, Survey Section and Footer to span LightRays background */}
      <div className="grow flex flex-col items-center w-full relative overflow-hidden bg-[#faf8ff]">
        <div
          style={{
            width: "100%",
            height: "100%",
            position: "absolute",
            top: 0,
            left: 0,
            zIndex: 0,
            pointerEvents: "none",
          }}
        >
          <LightRays
            raysOrigin="top-center"
            raysColor="#B00000"
            raysSpeed={1}
            lightSpread={1}
            rayLength={3}
            followMouse={true}
            mouseInfluence={0.1}
            noiseAmount={0}
            distortion={0}
            className="custom-rays"
            pulsating={false}
            fadeDistance={1}
            saturation={1}
          />
        </div>

        {/* Hero Banner Section */}
        <section className="relative w-full bg-linear-to-b from-primary/8 via-primary/2 to-transparent pt-16 pb-12 md:pt-24 md:pb-16 flex flex-col items-center w-full">
          <div className="bg-blob opacity-40" />
          <div className="bg-blob-2 opacity-35" />

          <div className="max-w-[1280px] mx-auto px-6 relative z-10 flex flex-col items-center text-center w-full">
            {/* Title */}
            <h1 className="font-extrabold text-4xl md:text-5xl text-primary tracking-tight leading-tight animate-fade-slide-up">
              E-Questionnaire & Tracer Study
            </h1>

            {/* Description Value Prop */}
            <p className="text-sm md:text-base text-[#434652] mt-4 font-medium leading-relaxed animate-fade-slide-up animation-delay-100">
              Portal kuesioner dan Tracer Study Resmi FKG Unhas. Umpan balik
              Anda sangat berharga bagi evaluasi kurikulum dan akreditasi kami.
            </p>

            {/* Stat Strip */}
            <div className="grid md:grid-cols-3 grid-cols-1 gap-6 md:gap-12 w-full mt-10 bg-white/70 backdrop-blur-md border border-outline-variant/30 p-5 rounded-2xl shadow-sm animate-fade-slide-up animation-delay-200">
              <div className="text-center flex justify-center flex-col items-center gap-2">
                <FileText />

                <p className="text-3xl md:text-4xl font-extrabold text-primary">
                  <AnimatedCounter value={stats.activeSurveys} />
                </p>
                <p className="text-[9px] md:text-xs text-[#747683] font-bold uppercase tracking-widest mt-1">
                  Survei Aktif
                </p>
              </div>
              <div className="py-4 md:py-0 border-y md:border-y-0 md:border-x border-outline-variant/30 text-center flex justify-center flex-col items-center gap-2">
                <UsersRound />

                <p className="text-3xl md:text-4xl font-extrabold text-primary">
                  <AnimatedCounter value={stats.totalParticipants} />
                </p>
                <p className="text-[9px] md:text-xs text-[#747683] font-bold uppercase tracking-widest mt-1">
                  Total Responden
                </p>
              </div>
              <div className="text-center flex justify-center flex-col items-center gap-2">
                <Timer />

                <p className="text-3xl md:text-4xl font-extrabold text-primary">
                  <AnimatedCounter value={stats.avgTimeMinutes} />m
                </p>
                <p className="text-[9px] md:text-xs text-[#747683] font-bold uppercase tracking-widest mt-1">
                  Avg Pengisian
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Main Content Area */}
        <section className="max-w-[1280px] w-full px-6 py-10 flex flex-col gap-6 relative z-10">
          {/* Search & Filter Bar Container */}
          <div className="flex flex-col gap-4 bg-white border border-outline-variant/20 p-5 rounded-2xl shadow-sm animate-fade-slide-up animation-delay-300">
            {/* Search & Sort Row */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 w-full">
              {/* Search Input */}
              <div className="relative w-full">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#747683]" />
                <input
                  className="w-full pl-9 pr-4 py-2 text-sm border border-outline-variant rounded-xl bg-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                  placeholder="Cari judul kuesioner..."
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-2 flex gap-4 flex-wrap">
              {/* Sort Dropdown */}
              <div className="flex items-center gap-2 self-end md:self-auto">
                <span className="text-xs font-bold text-[#747683] uppercase tracking-wider">
                  Urutkan:
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="text-xs font-semibold text-[#1a1b21] bg-slate-50 border border-outline-variant/80 rounded-lg px-3 py-2 outline-none focus:border-primary cursor-pointer"
                >
                  <option value="Terbaru">Terbaru</option>
                  <option value="Pertanyaan">Pertanyaan Terbanyak</option>
                </select>
              </div>
            </div>
          </div>

          {/* Survey Grid & Skeleton Handler */}
          {isPending ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-xl flex flex-col p-5 border border-outline-variant/10 shadow-sm gap-4"
                >
                  <Skeleton className="h-40 w-full rounded-lg" />
                  <Skeleton className="h-6 w-3/4 rounded" />
                  <Skeleton className="h-4 w-1/2 rounded" />
                  <Skeleton className="h-10 w-full rounded-lg mt-2" />
                </div>
              ))}
            </div>
          ) : filteredSurveys.length === 0 ? (
            <div className="text-center bg-white p-16 rounded-2xl border border-outline-variant/20 shadow-sm max-w-[600px] mx-auto w-full my-8">
              <CircleHelp className="h-12 w-12 text-[#747683] block mx-auto opacity-70" />
              <p className="mt-4 text-[#434652] font-semibold text-sm">
                Tidak ada kuesioner aktif yang ditemukan.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSurveys.map((survey, idx) => {
                const liveCount = liveCounts[survey.id] || 0;
                return (
                  <div
                    key={survey.id}
                    style={{ animationDelay: `${(idx + 4) * 80}ms` }}
                    className="bg-white rounded-2xl flex flex-col shadow-[0_4px_12px_rgba(74,0,0,0.02)] hover:shadow-[0_12px_28px_rgba(74,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group border border-outline-variant/20 animate-fade-slide-up"
                  >
                    {/* Banner Header */}
                    <div className="h-40 w-full relative overflow-hidden bg-slate-100 shrink-0 border-b border-slate-100">
                      {survey.bannerUrl ? (
                        <img
                          src={survey.bannerUrl}
                          alt={survey.title}
                          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/10 to-[#0B3E9C]/10 flex items-center justify-center">
                          <ChartBar className="h-12 w-12 text-primary/25" />
                        </div>
                      )}
                      <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                        <span className="inline-flex gap-1.5 items-center bg-primary text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm">
                          <CircleHelp className="h-3 w-3" />
                          {survey.questionCount} pertanyaan
                        </span>
                        <span className="inline-flex items-center bg-[#0B3E9C] text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm">
                          ~{Math.max(1, Math.ceil(survey.questionCount * 0.5))}{" "}
                          menit
                        </span>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-5 flex-1 flex flex-col gap-3">
                      <div className="flex-grow">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-[#747683]">
                            {survey.category || "General"}
                          </span>
                          <LiveFillingBadge count={liveCount} />
                        </div>
                        <h3 className="font-extrabold text-base text-[#1a1b21] mb-2 group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                          {survey.title}
                        </h3>
                        <p className="text-xs text-[#434652] line-clamp-2 leading-relaxed">
                          {survey.description ||
                            "Silakan klik tombol di bawah untuk berpartisipasi dalam kuesioner ini."}
                        </p>
                      </div>

                      <div className="pt-3">
                        <Link
                          to="/survey/$surveySlug"
                          params={{ surveySlug: survey.slug }}
                          className="w-full bg-[#B00000] text-white hover:bg-primary text-xs font-bold py-2.5 rounded-xl hover:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm shadow-[#B00000]/10"
                        >
                          <span>Mulai Survey</span>
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Footer Component */}
        <footer className="w-full mt-auto relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-center px-6 py-10 max-w-[1280px] mx-auto w-full gap-4 text-xs text-[#434652]">
            <div className="flex flex-col md:flex-row items-center gap-2 md:gap-6">
              <span className="font-extrabold text-primary text-sm uppercase tracking-wide">
                FKG Universitas Hasanuddin
              </span>
              <p className="font-medium">
                © 2026 FKG Universitas Hasanuddin. All Rights Reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
