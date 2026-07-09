import {
  createFileRoute,
  Link,
  useRouter,
  useLocation,
  Outlet,
} from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import {
  getSurveyDetailsFn,
  startResponseFn,
  submitResponseFn,
} from "../server/surveyFunctions";

export const Route = createFileRoute("/survey/$surveySlug")({
  loader: async ({ params }) => {
    const data = await getSurveyDetailsFn({ data: params.surveySlug });
    return data;
  },
  component: SurveyTakingComponent,
});

function SurveyTakingComponent() {
  const { survey, sections, questions } = Route.useLoaderData();
  const router = useRouter();
  const location = useLocation();

  // If the active route is the nested thank-you page, render the child Outlet
  if (location.pathname.endsWith("/thank-you")) {
    return <Outlet />;
  }

  const [clientDraftId, setClientDraftId] = useState("");
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
  }, [survey.id]);

  const initializeNewDraft = async () => {
    const newDraftId =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
    const draftKey = `fkg_survey_draft_${survey.id}`;

    localStorage.setItem(
      draftKey,
      JSON.stringify({
        clientDraftId: newDraftId,
        answers: {},
        currentSectionIndex: -1,
      }),
    );

    setClientDraftId(newDraftId);
    setAnswersState({});
    setCurrentSectionIndex(-1);

    try {
      await startResponseFn({
        data: { surveyId: survey.id, clientDraftId: newDraftId },
      });
    } catch (err) {
      console.error("Failed to start response session:", err);
    }
  };

  // Save draft locally whenever answers or step change
  const updateDraft = (newAnswers: typeof answersState, nextStep: number) => {
    const draftKey = `fkg_survey_draft_${survey.id}`;
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        clientDraftId,
        answers: newAnswers,
        currentSectionIndex: nextStep,
      }),
    );
    setAnswersState(newAnswers);
    setCurrentSectionIndex(nextStep);
  };

  const currentSection =
    currentSectionIndex >= 0 ? sections[currentSectionIndex] : null;
  const currentQuestions = currentSection
    ? questions.filter((q) => q.sectionId === currentSection.id)
    : [];

  const handleStartSurvey = () => {
    updateDraft(answersState, 0);
    window.scrollTo(0, 0);
  };

  // Validate inputs for current section
  const validateSection = () => {
    const newErrors: Record<number, string> = {};
    let isValid = true;

    for (const q of currentQuestions) {
      if (!q.required) continue;

      const ans = answersState[q.id];
      if (q.type === "grid") {
        // Matrix question: each row must have a value
        const rows = q.options.filter((o) => o.group === "row");
        const gridVal = ans?.valueGrid || {};

        const missingRows = rows.filter((r) => gridVal[r.id] === undefined);
        if (missingRows.length > 0) {
          newErrors[q.id] =
            `Mohon pilih jawaban untuk semua baris kompetensi/pertanyaan`;
          isValid = false;
        }
      } else if (q.type === "checkboxes") {
        const optIds = ans?.valueOptionIds || [];
        if (optIds.length === 0) {
          newErrors[q.id] = "Pilih minimal satu opsi jawaban";
          isValid = false;
        }
      } else if (
        q.type === "multiple_choice" ||
        q.type === "dropdown" ||
        q.type === "linear_scale"
      ) {
        const optIds = ans?.valueOptionIds || [];
        if (optIds.length === 0) {
          newErrors[q.id] = "Pilih salah satu opsi jawaban";
          isValid = false;
        }
      } else {
        // Text questions
        const textVal = ans?.valueText || "";
        if (textVal.trim() === "") {
          newErrors[q.id] = "Pertanyaan ini wajib diisi";
          isValid = false;
        }
      }
    }

    setErrors(newErrors);

    if (!isValid) {
      // Auto scroll to first error
      setTimeout(() => {
        const firstErrEl = document.querySelector(".error-highlight");
        if (firstErrEl) {
          firstErrEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    }

    return isValid;
  };

  const handleNext = () => {
    if (!validateSection()) return;

    const nextIndex = currentSectionIndex + 1;
    if (nextIndex < sections.length) {
      updateDraft(answersState, nextIndex);
      setErrors({});
      window.scrollTo(0, 0);
    }
  };

  const handleBack = () => {
    const prevIndex = currentSectionIndex - 1;
    updateDraft(answersState, prevIndex);
    setErrors({});
    window.scrollTo(0, 0);
  };

  const handleSubmit = async () => {
    if (!validateSection()) return;

    setLoading(true);
    try {
      // Prepare answers payload
      const answerPayload = Object.entries(answersState).map(
        ([qIdStr, ans]) => ({
          questionId: parseInt(qIdStr, 10),
          valueText: ans.valueText || null,
          valueOptionIds: ans.valueOptionIds || null,
          valueGrid: ans.valueGrid || null,
        }),
      );

      const response = await submitResponseFn({
        data: {
          surveyId: survey.id,
          clientDraftId,
          answers: answerPayload,
        },
      });

      if (response.success) {
        // Clear draft from localStorage
        localStorage.removeItem(`fkg_survey_draft_${survey.id}`);

        // Invalidate router cache
        await router.invalidate();

        // Navigate to thank you page
        router.navigate({
          to: "/survey/$surveySlug/thank-you",
          params: { surveySlug: survey.slug },
        });
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Terjadi kesalahan saat mengirim jawaban.");
    } finally {
      setLoading(false);
    }
  };

  // Handlers for inputs
  const handleTextChange = (qId: number, val: string) => {
    const newAnswers = {
      ...answersState,
      [qId]: { ...answersState[qId], valueText: val },
    };
    setAnswersState(newAnswers);
    const draftKey = `fkg_survey_draft_${survey.id}`;
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        clientDraftId,
        answers: newAnswers,
        currentSectionIndex,
      }),
    );
    // Clear error when typing
    if (errors[qId]) {
      const newErrors = { ...errors };
      delete newErrors[qId];
      setErrors(newErrors);
    }
  };

  const handleOptionSelect = (
    qId: number,
    optionId: number,
    isMulti = false,
  ) => {
    const currentOptIds = answersState[qId]?.valueOptionIds || [];
    let nextOptIds: number[];

    if (isMulti) {
      if (currentOptIds.includes(optionId)) {
        nextOptIds = currentOptIds.filter((id) => id !== optionId);
      } else {
        nextOptIds = [...currentOptIds, optionId];
      }
    } else {
      nextOptIds = [optionId];
    }

    const newAnswers = {
      ...answersState,
      [qId]: { ...answersState[qId], valueOptionIds: nextOptIds },
    };
    setAnswersState(newAnswers);
    const draftKey = `fkg_survey_draft_${survey.id}`;
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        clientDraftId,
        answers: newAnswers,
        currentSectionIndex,
      }),
    );

    if (errors[qId]) {
      const newErrors = { ...errors };
      delete newErrors[qId];
      setErrors(newErrors);
    }
  };

  const handleGridSelect = (
    qId: number,
    rowOptId: number,
    colOptId: number,
  ) => {
    const currentGrid = answersState[qId]?.valueGrid || {};
    const nextGrid = {
      ...currentGrid,
      [rowOptId]: colOptId,
    };

    const newAnswers = {
      ...answersState,
      [qId]: { ...answersState[qId], valueGrid: nextGrid },
    };
    setAnswersState(newAnswers);
    const draftKey = `fkg_survey_draft_${survey.id}`;
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        clientDraftId,
        answers: newAnswers,
        currentSectionIndex,
      }),
    );

    if (errors[qId]) {
      const newErrors = { ...errors };
      delete newErrors[qId];
      setErrors(newErrors);
    }
  };

  // 1. Welcome Screen View
  if (currentSectionIndex === -1) {
    return (
      <main className="grow flex items-center justify-center p-6 relative overflow-hidden bg-slate-50 min-h-[calc(100vh-80px)]">
        <div
          className="absolute inset-0 opacity-[0.1]"
          style={{
            backgroundImage:
              "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBY5jTi3ACJEiR0bz09BYIZYaY5IPSTjWFFpg-tNUh3Ve88ptrGBd9yXQYcPFRuLY0tG3ToVuyxojALfR9FQcKkKI9lt1QCdLUqAhuvpwMTcjz2zWO80vvMGlYSvmIXU9NZfkgRyuV3L_DFnFCcZ6jBNnPIW1XDbuSfm2RjmoyVXY6bzJwkMJopuAmcN8k5Fef4NVcyomzIfGwD9xJjacbYY4MInWLDWEYUjqJMQ3dfpXPaLHiIc2M4')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-b from-white/90 to-white/95"></div>

        <div className="relative z-10 w-full max-w-4xl">
          <div className="bg-white rounded-xl p-8 md:p-12 flex flex-col items-center text-center space-y-6 shadow-[0_8px_32px_rgba(11,62,156,0.06)] border border-surface-variant">
            <div className="inline-flex items-center justify-center p-4 bg-primary-container rounded-full text-[#0b3e9c] mb-2">
              <span
                className="material-symbols-outlined text-4xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                assignment
              </span>
            </div>
            <h1 className="font-bold text-3xl md:text-4xl text-[#002972] tracking-tight">
              {survey.title}
            </h1>
            <p className="text-base md:text-lg text-[#434652] max-w-2xl">
              {survey.description ||
                "Selamat datang di Survei FKG Unhas. Partisipasi Anda sangat berharga bagi peningkatan mutu kurikulum dan penjaminan mutu fakultas."}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 w-full justify-center mt-6">
              <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
                <span className="material-symbols-outlined text-[#002972] text-xl">
                  schedule
                </span>
                <span className="text-xs md:text-sm font-medium text-[#1a1b21]">
                  Estimasi waktu: 10-15 menit
                </span>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
                <span className="material-symbols-outlined text-[#a03f32] text-xl">
                  lock
                </span>
                <span className="text-xs md:text-sm font-medium text-[#1a1b21]">
                  Data Anda dijamin kerahasiaannya.
                </span>
              </div>
            </div>

            <div className="mt-8 w-full max-w-md">
              <button
                onClick={handleStartSurvey}
                className="w-full bg-[#002972] text-white font-bold py-3.5 px-8 rounded-lg shadow-sm hover:bg-[#0b3e9c] hover:shadow-md transition-all flex items-center justify-center gap-2 group"
              >
                <span>Mulai Survey</span>
                <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Calculate overall progress percentage
  const progressPercent = Math.round(
    ((currentSectionIndex + 1) / (sections.length + 1)) * 100,
  );

  // 2. Active Form Section View
  return (
    <main className="grow w-full max-w-4xl mx-auto py-12 px-6 flex flex-col items-center justify-start min-h-[calc(100vh-80px)]">
      {/* Survey Card container */}
      <div className="w-full bg-white border border-slate-200 rounded-xl shadow-[0_8px_32px_rgba(11,62,156,0.04)] p-6 md:p-10 relative overflow-hidden">
        {/* Progress Indicator */}
        <div className="w-full mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#434652]">
              Langkah {currentSectionIndex + 1} dari {sections.length}
            </span>
            <span className="text-sm font-bold text-[#a03f32]">
              {progressPercent}%
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#a03f32] rounded-full transition-all duration-500 ease-in-out"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>

        {/* Section Header */}
        <div className="mb-8 border-b border-slate-100 pb-6">
          <h1 className="font-bold text-2xl md:text-3xl text-[#002972] mb-2">
            {currentSection?.title}
          </h1>
          {currentSection?.description && (
            <p className="text-sm text-[#434652]">
              {currentSection.description}
            </p>
          )}
        </div>

        {/* Questions List */}
        <form ref={formRef} className="flex flex-col gap-8">
          {currentQuestions.map((q) => {
            const isError = !!errors[q.id];

            return (
              <div
                key={q.id}
                className={`flex flex-col gap-3 p-4 md:p-6 rounded-lg transition-all border ${
                  isError
                    ? "border-[#ba1a1a] bg-[#ffdad6]/20 error-highlight"
                    : "border-slate-100 bg-white"
                }`}
              >
                {/* Question Label */}
                <div className="flex items-start justify-between">
                  <label className="font-bold text-base text-[#1a1b21]">
                    {q.title}{" "}
                    {q.required && <span className="text-[#ba1a1a]">*</span>}
                  </label>
                </div>
                {q.description && (
                  <p className="text-xs text-[#747683] italic">
                    {q.description}
                  </p>
                )}

                {/* Error message */}
                {isError && (
                  <span className="text-xs text-[#ba1a1a] font-semibold flex items-center gap-1 mt-1">
                    <span className="material-symbols-outlined text-sm">
                      error
                    </span>
                    {errors[q.id]}
                  </span>
                )}

                {/* Question Fields Rendering */}
                <div className="mt-2">
                  {/* SHORT TEXT */}
                  {q.type === "short_text" && (
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-sm text-[#1a1b21] focus:border-[#002972] focus:ring-1 focus:ring-[#002972] focus:bg-white outline-none transition-colors"
                      placeholder="Masukkan jawaban singkat..."
                      value={answersState[q.id]?.valueText || ""}
                      onChange={(e) => handleTextChange(q.id, e.target.value)}
                    />
                  )}

                  {/* PARAGRAPH */}
                  {q.type === "paragraph" && (
                    <textarea
                      rows={4}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-sm text-[#1a1b21] focus:border-[#002972] focus:ring-1 focus:ring-[#002972] focus:bg-white outline-none transition-colors"
                      placeholder="Masukkan jawaban detail..."
                      value={answersState[q.id]?.valueText || ""}
                      onChange={(e) => handleTextChange(q.id, e.target.value)}
                    />
                  )}

                  {/* DROPDOWN */}
                  {q.type === "dropdown" && (
                    <div className="relative">
                      <select
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 pr-10 text-sm text-[#1a1b21] focus:border-[#002972] focus:ring-1 focus:ring-[#002972] focus:bg-white outline-none transition-colors appearance-none cursor-pointer"
                        value={answersState[q.id]?.valueOptionIds?.[0] || ""}
                        onChange={(e) =>
                          handleOptionSelect(q.id, parseInt(e.target.value, 10))
                        }
                      >
                        <option value="" disabled>
                          Pilih salah satu opsi...
                        </option>
                        {q.options.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        arrow_drop_down
                      </span>
                    </div>
                  )}

                  {/* MULTIPLE CHOICE (RADIOS) */}
                  {q.type === "multiple_choice" && (
                    <div className="flex flex-col gap-2">
                      {q.options.map((opt) => {
                        const checked = answersState[
                          q.id
                        ]?.valueOptionIds?.includes(opt.id);
                        return (
                          <label
                            key={opt.id}
                            className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                          >
                            <input
                              type="radio"
                              name={`question_${q.id}`}
                              checked={checked}
                              onChange={() => handleOptionSelect(q.id, opt.id)}
                              className="w-4 h-4 text-[#002972] focus:ring-[#002972] border-slate-300"
                            />
                            <span className="text-sm text-[#1a1b21] font-medium">
                              {opt.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* CHECKBOXES */}
                  {q.type === "checkboxes" && (
                    <div className="flex flex-col gap-2">
                      {q.options.map((opt) => {
                        const checked = answersState[
                          q.id
                        ]?.valueOptionIds?.includes(opt.id);
                        return (
                          <label
                            key={opt.id}
                            className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                handleOptionSelect(q.id, opt.id, true)
                              }
                              className="w-4 h-4 text-[#002972] focus:ring-[#002972] border-slate-300 rounded"
                            />
                            <span className="text-sm text-[#1a1b21] font-medium">
                              {opt.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* LINEAR SCALE */}
                  {q.type === "linear_scale" && (
                    <div className="flex flex-col items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div className="flex justify-between w-full text-xs font-semibold text-[#747683] px-2">
                        <span>Sangat Rendah (1)</span>
                        <span>Sangat Tinggi (5)</span>
                      </div>
                      <div className="flex justify-between items-center w-full max-w-sm gap-2">
                        {q.options.map((opt, idx) => {
                          const scoreValue = idx + 1;
                          const checked = answersState[
                            q.id
                          ]?.valueOptionIds?.includes(opt.id);
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handleOptionSelect(q.id, opt.id)}
                              className={`flex-1 py-3 text-center border font-bold text-sm rounded-lg transition-all ${
                                checked
                                  ? "bg-[#0b3e9c] border-[#0b3e9c] text-white shadow-sm"
                                  : "bg-white border-slate-200 text-[#1a1b21] hover:bg-slate-50"
                              }`}
                            >
                              {scoreValue}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* MATRIX GRID */}
                  {q.type === "grid" && (
                    <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm">
                      <table className="w-full min-w-[600px] border-collapse bg-white">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="py-3 px-4 text-left text-xs font-bold text-[#434652] uppercase w-1/3">
                              Kompetensi
                            </th>
                            {q.options
                              .filter((o) => o.group === "column")
                              .map((col, index) => (
                                <th
                                  key={col.id}
                                  className="py-3 px-2 text-center text-xs font-bold text-[#434652] uppercase"
                                >
                                  {index + 1}
                                </th>
                              ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {q.options
                            .filter((o) => o.group === "row")
                            .map((row) => (
                              <tr key={row.id} className="hover:bg-slate-50/50">
                                <td className="py-3.5 px-4 text-sm font-medium text-[#1a1b21]">
                                  {row.label}
                                </td>
                                {q.options
                                  .filter((o) => o.group === "column")
                                  .map((col) => {
                                    const isChecked =
                                      answersState[q.id]?.valueGrid?.[
                                        row.id
                                      ] === col.id;
                                    return (
                                      <td
                                        key={col.id}
                                        className="py-3.5 px-2 text-center"
                                      >
                                        <input
                                          type="radio"
                                          name={`grid_${q.id}_row_${row.id}`}
                                          checked={isChecked}
                                          onChange={() =>
                                            handleGridSelect(
                                              q.id,
                                              row.id,
                                              col.id,
                                            )
                                          }
                                          className="w-4 h-4 text-[#002972] focus:ring-[#002972] border-slate-300"
                                        />
                                      </td>
                                    );
                                  })}
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* DATE INPUT */}
                  {q.type === "date" && (
                    <input
                      type="date"
                      className="bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-sm text-[#1a1b21] focus:border-[#002972] focus:ring-1 focus:ring-[#002972] focus:bg-white outline-none transition-colors"
                      value={answersState[q.id]?.valueText || ""}
                      onChange={(e) => handleTextChange(q.id, e.target.value)}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </form>

        {/* Action Buttons */}
        <div className="w-full h-px bg-slate-100 my-8"></div>
        <div className="flex justify-between gap-4">
          <button
            type="button"
            onClick={handleBack}
            className="border border-[#747683] text-[#1a1b21] hover:bg-slate-50 font-bold px-6 py-2.5 rounded-lg flex items-center justify-center gap-1 transition-colors scale-98 active:scale-95"
          >
            <span className="material-symbols-outlined text-sm rotate-180">
              arrow_forward
            </span>
            <span>Kembali</span>
          </button>

          {currentSectionIndex === sections.length - 1 ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="bg-[#a03f32] text-white hover:bg-[#741e15] font-bold px-8 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors scale-98 active:scale-95 shadow-sm"
            >
              {loading ? "Mengirim..." : "Kirim Jawaban"}
              <span className="material-symbols-outlined text-sm">
                check_circle
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="bg-[#002972] text-white hover:bg-[#0b3e9c] font-bold px-8 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors scale-98 active:scale-95 shadow-sm"
            >
              <span>Lanjutkan</span>
              <span className="material-symbols-outlined text-sm">
                arrow_forward
              </span>
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
