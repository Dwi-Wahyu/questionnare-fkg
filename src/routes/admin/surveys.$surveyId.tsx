import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { toast } from "../../components/ui/useToast";
import {
	chartElementToPngBase64,
	copyElementChartAsPng,
} from "../../lib/copyChartImage";
import {
	duplicateAdminSurveyFn,
	exportAdminSurveyResponsesCSVFn,
	generateSurveyReportFn,
	getAdminSurveyAnswersStatsFn,
	getAdminSurveyDetailFn,
	getAdminSurveyResponseDetailFn,
	getAdminSurveyResponsesListFn,
	getLatestSurveyReportFn,
	updateAdminSurveyQuestionsFn,
	updateAdminSurveySettingsFn,
} from "../../server/adminSurveyFunctions";

export const Route = createFileRoute("/admin/surveys/$surveyId")({
	validateSearch: (search: Record<string, unknown>) => ({
		tab: (search.tab as string) || "questions",
		subtab: (search.subtab as string) || "ringkasan",
		qid: search.qid ? Number(search.qid) : undefined,
		page: search.page ? Number(search.page) : 1,
	}),
	loaderDeps: ({ search: { tab, subtab, qid, page } }) => ({
		tab,
		subtab,
		qid,
		page,
	}),
	loader: async ({ params, deps }) => {
		const surveyId = parseInt(params.surveyId, 10);
		const detail = await getAdminSurveyDetailFn({ data: surveyId });
		let stats = null;
		let responseDetail = null;
		let responsesIndex = null;

		if (
			deps.tab === "responses" &&
			(deps.subtab === "ringkasan" || deps.subtab === "pertanyaan")
		) {
			stats = await getAdminSurveyAnswersStatsFn({ data: surveyId });
		}
		if (deps.tab === "responses" && deps.subtab === "individual") {
			responsesIndex = await getAdminSurveyResponsesListFn({
				data: { surveyId, page: deps.page, limit: 1 },
			});
			const targetId = responsesIndex.responses[0]?.id;
			if (targetId) {
				responseDetail = await getAdminSurveyResponseDetailFn({
					data: { surveyId, responseId: targetId },
				});
			}
		}

		return { detail, stats, responseDetail, responsesIndex, surveyId };
	},
	component: SurveyDetailComponent,
});

function SurveyDetailComponent() {
	const { detail, stats, responseDetail, responsesIndex, surveyId } =
		Route.useLoaderData();
	const { tab, subtab, qid, page } = Route.useSearch();
	const router = useRouter();
	const { user } = Route.useRouteContext();

	const bannerFileInputRef = useRef<HTMLInputElement>(null);

	// Local state for Questions Tab editor
	const [sections, setSections] = useState<any[]>([]);
	const [questions, setQuestions] = useState<any[]>([]);
	const [isSavingQuestions, setIsSavingQuestions] = useState(false);

	// Local state for Settings Tab
	const [settingsTitle, setSettingsTitle] = useState("");
	const [settingsSlug, setSettingsSlug] = useState("");
	const [settingsCategory, setSettingsCategory] = useState("");
	const [settingsPeriodType, setSettingsPeriodType] = useState<
		"month" | "date"
	>("month");
	const [settingsPeriodValue, setSettingsPeriodValue] = useState("");
	const [settingsPeriodValueEnd, setSettingsPeriodValueEnd] = useState("");
	const [settingsStatus, setSettingsStatus] = useState<
		"draft" | "published" | "archived"
	>("draft");
	const [settingsDesc, setSettingsDesc] = useState("");
	const [settingsBannerUrl, setSettingsBannerUrl] = useState("");
	const [isSavingSettings, setIsSavingSettings] = useState(false);
	const [isCopied, setIsCopied] = useState(false);
	const [textSearch, setTextSearch] = useState("");
	const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
	const [isDuplicating, setIsDuplicating] = useState(false);
	const [isGeneratingReport, setIsGeneratingReport] = useState(false);
	const [reportCooldown, setReportCooldown] = useState(0);
	const [latestReport, setLatestReport] = useState<{
		fileName: string;
		base64: string;
		generatedAt: string;
	} | null>(null);

	const fetchLatestReport = async () => {
		try {
			const report = await getLatestSurveyReportFn({ data: surveyId });
			setLatestReport(report);
		} catch (err) {
			console.error("Gagal memuat laporan terakhir:", err);
		}
	};

	// Fetch latest report on mount/reload
	useEffect(() => {
		fetchLatestReport();
	}, [surveyId]);

	// Decrement report generation cooldown timer
	useEffect(() => {
		if (reportCooldown <= 0) return;
		const timer = setInterval(() => {
			setReportCooldown((prev) => prev - 1);
		}, 1000);
		return () => clearInterval(timer);
	}, [reportCooldown]);

	// Load loaders data into states
	useEffect(() => {
		if (detail) {
			setSections(detail.sections || []);
			setQuestions(detail.questions || []);

			setSettingsTitle(detail.survey.title || "");
			setSettingsSlug(detail.survey.slug || "");
			setSettingsCategory(detail.survey.category || "");
			setSettingsPeriodType((detail.survey as any).periodType || "month");
			setSettingsPeriodValue((detail.survey as any).periodValue || "");
			setSettingsPeriodValueEnd((detail.survey as any).periodValueEnd || "");
			setSettingsStatus(detail.survey.status || "draft");
			setSettingsDesc(detail.survey.description || "");
			setSettingsBannerUrl(detail.survey.bannerUrl || "");
		}
	}, [detail]);

	// Save Questions Layout Action
	const handleSaveQuestions = async () => {
		setIsSavingQuestions(true);
		try {
			// Map questions to matching sections and format for server transaction
			const questionsPayload = questions.map((q) => {
				// Find matching section in current editor
				const section = sections.find((s) => s.id === q.sectionId);
				const sectionOrder = section ? section.order : 0;

				return {
					id: typeof q.id === "number" ? q.id : undefined,
					sectionOrder,
					type: q.type,
					title: q.title,
					description: q.description || "",
					required: !!q.required,
					order: q.order,
					options: (q.options || []).map((o: any) => ({
						id: typeof o.id === "number" ? o.id : undefined,
						group: o.group,
						label: o.label,
						order: o.order,
					})),
				};
			});

			const sectionsPayload = sections.map((s) => ({
				id: typeof s.id === "number" ? s.id : undefined,
				title: s.title,
				description: s.description || "",
				order: s.order,
			}));

			const res = await updateAdminSurveyQuestionsFn({
				data: {
					surveyId,
					sections: sectionsPayload,
					questions: questionsPayload,
				},
			});

			if (res.success) {
				toast.success("Tata letak pertanyaan kuesioner berhasil disimpan!");
				await router.invalidate();
			}
		} catch (err: any) {
			toast.error(err.message || "Gagal menyimpan tata letak pertanyaan.");
		} finally {
			setIsSavingQuestions(false);
		}
	};

	// Save Settings Action
	const handleCopyLink = () => {
		const url = `${window.location.origin}/survey/${settingsSlug}`;
		navigator.clipboard
			.writeText(url)
			.then(() => {
				setIsCopied(true);
				setTimeout(() => setIsCopied(false), 2000);
				toast.success("Link survey berhasil disalin!");
			})
			.catch(() => {
				toast.error("Gagal menyalin link.");
			});
	};

	const handleSaveSettings = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!settingsPeriodValue || !settingsPeriodValueEnd) {
			toast.error("Periode survei mulai dan berakhir wajib diisi");
			return;
		}

		if (settingsPeriodValueEnd < settingsPeriodValue) {
			toast.error("Periode berakhir tidak boleh mendahului periode mulai");
			return;
		}

		setIsSavingSettings(true);
		try {
			const res = await updateAdminSurveySettingsFn({
				data: {
					id: surveyId,
					title: settingsTitle,
					slug: settingsSlug,
					category: settingsCategory,
					periodType: settingsPeriodType,
					periodValue: settingsPeriodValue,
					periodValueEnd: settingsPeriodValueEnd,
					status: settingsStatus,
					description: settingsDesc,
					bannerUrl: settingsBannerUrl,
				},
			});

			if (res.success) {
				toast.success("Pengaturan kuesioner berhasil diperbarui!");
				await router.invalidate();
			}
		} catch (err: any) {
			toast.error(err.message || "Gagal menyimpan pengaturan.");
		} finally {
			setIsSavingSettings(false);
		}
	};

	const handleDuplicate = async () => {
		if (isDuplicating) return;
		setIsDuplicating(true);
		try {
			const res = await duplicateAdminSurveyFn({ data: surveyId });
			if (res.success) {
				toast.success("Survey berhasil diduplikat!");
				setIsDuplicateDialogOpen(false);
				router.navigate({
					to: "/admin/surveys/$surveyId",
					params: { surveyId: res.newSurveyId.toString() },
					search: { tab: "settings" },
				});
			}
		} catch (err: any) {
			toast.error(err.message || "Gagal menduplikat survei.");
			setIsDuplicating(false);
		}
	};

	// Editor helper actions
	const handleAddQuestion = (sectionId: number) => {
		const newTempId = "new_" + Math.random().toString(36).substring(2, 9);
		const maxOrder = questions.reduce(
			(max, q) => (q.order > max ? q.order : max),
			0,
		);

		const newQuestion = {
			id: newTempId,
			sectionId,
			type: "short_text",
			title: "Pertanyaan Baru",
			description: "",
			required: false,
			order: maxOrder + 1,
			options: [],
		};

		setQuestions([...questions, newQuestion]);
	};

	const handleDeleteQuestion = (qId: any) => {
		setQuestions(questions.filter((q) => q.id !== qId));
	};

	const handleQuestionFieldChange = (qId: any, key: string, val: any) => {
		setQuestions(
			questions.map((q) => {
				if (q.id === qId) {
					return { ...q, [key]: val };
				}
				return q;
			}),
		);
	};

	const handleAddOption = (
		qId: any,
		group: "choice" | "row" | "column" = "choice",
	) => {
		setQuestions(
			questions.map((q) => {
				if (q.id === qId) {
					const opts = q.options || [];
					const maxOrder = opts.reduce(
						(max: number, o: any) => (o.order > max ? o.order : max),
						0,
					);
					const newOpt = {
						id: "new_opt_" + Math.random().toString(36).substring(2, 9),
						group,
						label: `Opsi ${opts.length + 1}`,
						order: maxOrder + 1,
					};
					return { ...q, options: [...opts, newOpt] };
				}
				return q;
			}),
		);
	};

	const handleUpdateOptionLabel = (qId: any, optId: any, label: string) => {
		setQuestions(
			questions.map((q) => {
				if (q.id === qId) {
					return {
						...q,
						options: q.options.map((o: any) =>
							o.id === optId ? { ...o, label } : o,
						),
					};
				}
				return q;
			}),
		);
	};

	const handleDeleteOption = (qId: any, optId: any) => {
		setQuestions(
			questions.map((q) => {
				if (q.id === qId) {
					return {
						...q,
						options: q.options.filter((o: any) => o.id !== optId),
					};
				}
				return q;
			}),
		);
	};

	const handleMoveQuestion = (index: number, direction: "up" | "down") => {
		const targetIndex = direction === "up" ? index - 1 : index + 1;
		if (targetIndex < 0 || targetIndex >= questions.length) return;

		const nextQuestions = [...questions];
		// Swap items
		const temp = nextQuestions[index];
		nextQuestions[index] = nextQuestions[targetIndex];
		nextQuestions[targetIndex] = temp;

		// Reassign orders
		nextQuestions.forEach((q, idx) => {
			q.order = idx;
		});

		setQuestions(nextQuestions);
	};

	// Server-side CSV Download
	const handleDownloadCSV = async () => {
		try {
			const res = await exportAdminSurveyResponsesCSVFn({ data: surveyId });
			const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = res.filename;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);
		} catch (err: any) {
			toast.error(err.message || "Gagal mengekspor data.");
		}
	};

	// Automatic Report Generation (Word + AI analysis + embedded charts)
	const handleGenerateReport = async () => {
		if (reportCooldown > 0) {
			toast.error(
				`Tunggu ${Math.ceil(reportCooldown / 60)} menit lagi sebelum generate laporan berikutnya untuk survei ini.`,
			);
			return;
		}

		setIsGeneratingReport(true);
		toast.info("Sedang memproses grafik dan narasi AI laporan...");

		try {
			// Find all chart cards rendered in the DOM
			const chartCardEls = document.querySelectorAll("[data-chart-card]");
			const charts: {
				questionId: number;
				label: string;
				imageBase64: string;
			}[] = [];

			for (const card of chartCardEls) {
				const cardSvgs = Array.from(card.querySelectorAll("svg"));
				let mainSvg = cardSvgs[0];
				let maxArea = 0;
				for (const s of cardSvgs) {
					const { width, height } = s.getBoundingClientRect();
					const area = width * height;
					if (area > maxArea) {
						maxArea = area;
						mainSvg = s;
					}
				}
				const svgEl = mainSvg;
				if (!svgEl) continue;
				try {
					const qId = Number(card.getAttribute("data-question-id"));
					const label = card.getAttribute("data-chart-label") || "";
					const rootEl =
						(svgEl.closest("[data-chart-root]") as HTMLElement) ?? svgEl;
					const imageBase64 = await chartElementToPngBase64(rootEl);
					charts.push({
						questionId: qId,
						label,
						imageBase64,
					});
				} catch (err) {
					console.error("Gagal menangkap gambar chart:", err);
				}
			}

			// Send to Server Function
			const res = await generateSurveyReportFn({
				data: {
					surveyId,
					charts,
				},
			});

			// Download file
			const byteCharacters = atob(res.base64);
			const byteNumbers = new Array(byteCharacters.length);
			for (let i = 0; i < byteCharacters.length; i++) {
				byteNumbers[i] = byteCharacters.charCodeAt(i);
			}
			const byteArray = new Uint8Array(byteNumbers);
			const blob = new Blob([byteArray], {
				type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			});
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = res.filename;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);

			// Activate cooldown if applied (non-development mode)
			if (res.cooldownApplied) {
				setReportCooldown(600);
			}

			toast.success("Laporan berhasil digenerate dan diunduh.");
			fetchLatestReport();
		} catch (err: any) {
			toast.error(err.message || "Gagal membuat laporan.");
		} finally {
			setIsGeneratingReport(false);
		}
	};

	// Download the latest cached report from the database directly (instantly)
	const handleDownloadLatestReport = () => {
		if (!latestReport) return;
		try {
			const byteCharacters = atob(latestReport.base64);
			const byteNumbers = new Array(byteCharacters.length);
			for (let i = 0; i < byteCharacters.length; i++) {
				byteNumbers[i] = byteCharacters.charCodeAt(i);
			}
			const byteArray = new Uint8Array(byteNumbers);
			const blob = new Blob([byteArray], {
				type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			});
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = latestReport.fileName;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);
			toast.success("Laporan sebelumnya berhasil diunduh.");
		} catch (err: any) {
			toast.error("Gagal mengunduh laporan sebelumnya.");
		}
	};

	const getStatusBadge = (status: string) => {
		switch (status) {
			case "published":
				return (
					<span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
						Dipublikasikan
					</span>
				);
			case "draft":
				return (
					<span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
						Draft
					</span>
				);
			case "archived":
				return (
					<span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
						Diarsipkan
					</span>
				);
			default:
				return null;
		}
	};

	const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			const reader = new FileReader();
			reader.onloadend = () => {
				setSettingsBannerUrl(reader.result as string);
			};
			reader.readAsDataURL(file);
		}
	};

	return (
		<div className="space-y-6">
			{/* Breadcrumbs & Title */}
			<div className="flex flex-col md:flex-row w-full justify-between items-start gap-4">
				<div className="min-w-0 flex-1">
					<nav className="text-xs font-semibold text-[#434652] flex items-center gap-1.5 mb-2">
						<Link to="/admin/surveys" className="hover:text-[#002972]">
							Kelola Survey
						</Link>
						<span className="material-symbols-outlined text-xs">
							chevron_right
						</span>
						<span className="text-slate-400">Detail Survey</span>
					</nav>
					<h2 className="text-3xl font-bold text-[#1a1b21] flex items-center gap-3 w-full text-left">
						{detail.survey.title}
						{getStatusBadge(detail.survey.status)}
						{(detail.survey as any).periodValue && (
							<span className="inline-flex items-center gap-1 text-xs font-semibold text-[#434652] bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
								<span className="material-symbols-outlined text-sm text-[#747683] block">
									calendar_month
								</span>
								{(() => {
									const val = (detail.survey as any).periodValue;
									const valEnd = (detail.survey as any).periodValueEnd;
									const type = (detail.survey as any).periodType;

									const formatVal = (v: string) => {
										if (!v) return "";
										if (type === "month") {
											const [year, month] = v.split("-");
											const date = new Date(Number(year), Number(month) - 1, 1);
											return date.toLocaleDateString("id-ID", {
												month: "long",
												year: "numeric",
											});
										} else {
											const date = new Date(v);
											return date.toLocaleDateString("id-ID", {
												dateStyle: "medium",
											});
										}
									};

									if (valEnd) {
										return `${formatVal(val)} - ${formatVal(valEnd)}`;
									}
									return formatVal(val);
								})()}
							</span>
						)}
					</h2>
				</div>

				{tab === "responses" && user?.role !== "visitor" && (
					<div className="flex gap-2">
						{subtab === "ringkasan" && user?.role === "admin" && (
							<button
								onClick={handleGenerateReport}
								disabled={isGeneratingReport || reportCooldown > 0}
								className={`bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-semibold px-4 py-2.5 rounded-lg flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform cursor-pointer ${isGeneratingReport || reportCooldown > 0 ? "opacity-75 cursor-not-allowed" : ""}`}
							>
								<span
									className={`material-symbols-outlined text-sm ${isGeneratingReport ? "animate-spin" : ""}`}
								>
									{isGeneratingReport ? "sync" : "description"}
								</span>
								<span>
									{isGeneratingReport
										? "Mengekspor..."
										: reportCooldown > 0
											? `Tunggu ${Math.floor(reportCooldown / 60)}:${String(reportCooldown % 60).padStart(2, "0")}`
											: "Generate Laporan (Word)"}
								</span>
							</button>
						)}
						{subtab === "ringkasan" &&
							user?.role === "admin" &&
							latestReport && (
								<button
									type="button"
									onClick={handleDownloadLatestReport}
									title={`Unduh laporan terakhir yang digenerate pada ${new Date(latestReport.generatedAt).toLocaleString("id-ID")}`}
									className="bg-sky-600 text-white hover:bg-sky-700 text-sm font-semibold px-4 py-2.5 rounded-lg flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform cursor-pointer"
								>
									<span className="material-symbols-outlined text-sm">
										file_download
									</span>
									<span>Unduh Laporan Terakhir</span>
								</button>
							)}
						<button
							onClick={handleDownloadCSV}
							className="bg-[#0b3e9c] text-white hover:bg-[#002972] text-sm font-semibold px-4 py-2.5 rounded-lg flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform cursor-pointer"
						>
							<span className="material-symbols-outlined text-sm">
								download
							</span>
							<span>Download CSV</span>
						</button>
					</div>
				)}
			</div>

			{/* Tab Navigation */}
			<div className="border-b border-[#c4c6d4]">
				<nav className="flex gap-6 -mb-px">
					<Link
						to="/admin/surveys/$surveyId"
						params={{ surveyId: surveyId.toString() }}
						search={{ tab: "questions" }}
						className={`py-3 px-1 border-b-2 text-sm font-bold transition-colors ${
							tab === "questions"
								? "border-[#002972] text-[#002972]"
								: "border-transparent text-[#434652] hover:text-[#002972]"
						}`}
					>
						Pertanyaan
					</Link>
					<Link
						to="/admin/surveys/$surveyId"
						params={{ surveyId: surveyId.toString() }}
						search={{ tab: "responses", subtab: "ringkasan" }}
						className={`py-3 px-1 border-b-2 text-sm font-bold transition-colors ${
							tab === "responses"
								? "border-[#002972] text-[#002972]"
								: "border-transparent text-[#434652] hover:text-[#002972]"
						}`}
					>
						Jawaban ({detail.responseCount})
					</Link>
					<Link
						to="/admin/surveys/$surveyId"
						params={{ surveyId: surveyId.toString() }}
						search={{ tab: "settings" }}
						className={`py-3 px-1 border-b-2 text-sm font-bold transition-colors ${
							tab === "settings"
								? "border-[#002972] text-[#002972]"
								: "border-transparent text-[#434652] hover:text-[#002972]"
						}`}
					>
						Setelan
					</Link>
				</nav>
			</div>

			{/* ============================== QUESTIONS TAB ============================== */}
			{tab === "questions" && (
				<div className="max-w-4xl space-y-6">
					{/* Header Details Card */}
					<div className="bg-white rounded-lg shadow-sm border border-[#c4c6d4] overflow-hidden">
						<div className="h-2.5 w-full bg-[#0b3e9c]"></div>
						<div className="p-6 space-y-3">
							<h2 className="text-xl font-bold text-[#1a1b21]">
								{detail.survey.title}
							</h2>
							<p className="text-sm text-[#434652]">
								{detail.survey.description || "Tidak ada deskripsi."}
							</p>
							<div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs text-[#747683]">
								<span className="flex items-center gap-1">
									<span className="material-symbols-outlined text-sm">
										cloud_done
									</span>
									Tersimpan di Database
								</span>
							</div>
						</div>
					</div>

					{/* Sections loop */}
					{sections.map((sec, secIdx) => {
						const secQuestions = questions.filter(
							(q) => q.sectionId === sec.id,
						);

						return (
							<div
								key={sec.id}
								className="bg-white rounded-lg border border-[#c4c6d4] shadow-sm overflow-hidden"
							>
								<div className="bg-[#eeedf6] px-6 py-2 border-b border-[#c4c6d4] flex items-center justify-between text-xs font-bold text-[#002972]">
									<span>
										Bagian {secIdx + 1} dari {sections.length}
									</span>
									<span>{sec.title}</span>
								</div>

								<div className="p-6 space-y-6">
									{secQuestions.length === 0 ? (
										<div className="p-8 text-center text-slate-400 text-sm">
											Belum ada pertanyaan di bagian ini. Klik tombol tambah di
											bawah untuk menambahkan.
										</div>
									) : (
										secQuestions.map((q, qIdx) => (
											<div
												key={q.id}
												className="p-4 rounded-lg border border-slate-100 bg-slate-50/50 space-y-4 relative group"
											>
												{/* Arrow Reordering Controls */}
												{user?.role !== "visitor" && (
													<div className="absolute right-3 top-3 hidden group-hover:flex items-center gap-1 bg-white p-1 rounded-md border border-slate-200 shadow-sm">
														<button
															onClick={() =>
																handleMoveQuestion(questions.indexOf(q), "up")
															}
															disabled={questions.indexOf(q) === 0}
															className="p-1 text-[#434652] hover:text-[#002972] disabled:opacity-30 disabled:pointer-events-none"
															title="Pindah Ke Atas"
														>
															<span className="material-symbols-outlined text-sm block">
																arrow_upward
															</span>
														</button>
														<button
															onClick={() =>
																handleMoveQuestion(questions.indexOf(q), "down")
															}
															disabled={
																questions.indexOf(q) === questions.length - 1
															}
															className="p-1 text-[#434652] hover:text-[#002972] disabled:opacity-30 disabled:pointer-events-none"
															title="Pindah Ke Bawah"
														>
															<span className="material-symbols-outlined text-sm block">
																arrow_downward
															</span>
														</button>
													</div>
												)}

												{/* Title and Type Select */}
												<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
													<div className="md:col-span-2 space-y-1">
														<label className="text-xs font-bold text-[#434652] uppercase">
															Judul Pertanyaan
														</label>
														<input
															type="text"
															value={q.title}
															onChange={(e) =>
																handleQuestionFieldChange(
																	q.id,
																	"title",
																	e.target.value,
																)
															}
															className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm text-[#1a1b21] focus:border-[#002972] outline-none"
															placeholder="Masukkan label pertanyaan..."
															disabled={user?.role === "visitor"}
														/>
													</div>
													<div className="space-y-1">
														<label className="text-xs font-bold text-[#434652] uppercase">
															Tipe Bidang
														</label>
														<select
															value={q.type}
															onChange={(e) =>
																handleQuestionFieldChange(
																	q.id,
																	"type",
																	e.target.value,
																)
															}
															className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm text-[#1a1b21] focus:border-[#002972] outline-none cursor-pointer"
															disabled={user?.role === "visitor"}
														>
															<option value="short_text">
																Jawaban Singkat
															</option>
															<option value="paragraph">Paragraf</option>
															<option value="multiple_choice">
																Pilihan Ganda (Radios)
															</option>
															<option value="checkboxes">
																Kotak Centang (Checkboxes)
															</option>
															<option value="dropdown">Dropdown Pilihan</option>
															<option value="linear_scale">
																Skala Linier (1-5)
															</option>
															<option value="grid">
																Kisi Pilihan Ganda (Matrix)
															</option>
															<option value="date">Tanggal</option>
														</select>
													</div>
												</div>

												{/* Description */}
												<div className="space-y-1">
													<label className="text-xs font-bold text-[#434652] uppercase">
														Deskripsi / Petunjuk Tambahan (Opsional)
													</label>
													<input
														type="text"
														value={q.description || ""}
														onChange={(e) =>
															handleQuestionFieldChange(
																q.id,
																"description",
																e.target.value,
															)
														}
														className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm text-slate-500 focus:border-[#002972] outline-none"
														placeholder="Petunjuk pengisian untuk responden..."
														disabled={user?.role === "visitor"}
													/>
												</div>

												{/* Render Option Manager (Only for choice/grid fields) */}
												{(q.type === "multiple_choice" ||
													q.type === "dropdown" ||
													q.type === "checkboxes") && (
													<div className="space-y-2.5 pt-2 border-t border-slate-100">
														<span className="text-xs font-bold text-[#434652] uppercase block">
															Daftar Opsi Pilihan
														</span>
														<div className="space-y-2 pl-4 border-l-2 border-slate-200">
															{(q.options || []).map((opt: any) => (
																<div
																	key={opt.id}
																	className="flex items-center gap-2"
																>
																	<span className="material-symbols-outlined text-xs text-slate-300">
																		radio_button_unchecked
																	</span>
																	<input
																		type="text"
																		value={opt.label}
																		onChange={(e) =>
																			handleUpdateOptionLabel(
																				q.id,
																				opt.id,
																				e.target.value,
																			)
																		}
																		className="flex-1 bg-white border border-slate-200 rounded-md py-1 px-2.5 text-xs text-[#1a1b21] focus:border-[#002972] outline-none"
																		disabled={user?.role === "visitor"}
																	/>
																	{user?.role !== "visitor" && (
																		<button
																			type="button"
																			onClick={() =>
																				handleDeleteOption(q.id, opt.id)
																			}
																			className="p-1 hover:text-[#ba1a1a]"
																			title="Hapus Opsi"
																		>
																			<span className="material-symbols-outlined text-sm">
																				close
																			</span>
																		</button>
																	)}
																</div>
															))}
															{user?.role !== "visitor" && (
																<button
																	type="button"
																	onClick={() => handleAddOption(q.id)}
																	className="text-xs font-bold text-[#0b3e9c] hover:underline flex items-center gap-1 mt-1"
																>
																	<span className="material-symbols-outlined text-xs">
																		add
																	</span>
																	<span>Tambah Opsi Pilihan</span>
																</button>
															)}
														</div>
													</div>
												)}

												{/* Render Matrix Grid Option Manager */}
												{q.type === "grid" && (
													<div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t border-slate-100">
														{/* Rows manager */}
														<div className="space-y-2">
															<span className="text-xs font-bold text-[#434652] uppercase block">
																Pernyataan Baris (Rows)
															</span>
															<div className="space-y-1.5 pl-2 border-l border-slate-200">
																{(q.options || [])
																	.filter((o: any) => o.group === "row")
																	.map((opt: any) => (
																		<div
																			key={opt.id}
																			className="flex items-center gap-2"
																		>
																			<input
																				type="text"
																				value={opt.label}
																				onChange={(e) =>
																					handleUpdateOptionLabel(
																						q.id,
																						opt.id,
																						e.target.value,
																					)
																				}
																				className="flex-1 bg-white border border-slate-200 rounded-md py-1 px-2.5 text-xs text-[#1a1b21] focus:border-[#002972] outline-none"
																				disabled={user?.role === "visitor"}
																			/>
																			{user?.role !== "visitor" && (
																				<button
																					type="button"
																					onClick={() =>
																						handleDeleteOption(q.id, opt.id)
																					}
																					className="p-1 hover:text-[#ba1a1a]"
																				>
																					<span className="material-symbols-outlined text-sm">
																						close
																					</span>
																				</button>
																			)}
																		</div>
																	))}
																{user?.role !== "visitor" && (
																	<button
																		type="button"
																		onClick={() => handleAddOption(q.id, "row")}
																		className="text-xxs font-bold text-[#0b3e9c] hover:underline flex items-center gap-1"
																	>
																		<span className="material-symbols-outlined text-xs">
																			add
																		</span>
																		<span>Tambah Baris</span>
																	</button>
																)}
															</div>
														</div>

														{/* Columns manager */}
														<div className="space-y-2">
															<span className="text-xs font-bold text-[#434652] uppercase block">
																Kolom Skala (Columns)
															</span>
															<div className="space-y-1.5 pl-2 border-l border-slate-200">
																{(q.options || [])
																	.filter((o: any) => o.group === "column")
																	.map((opt: any) => (
																		<div
																			key={opt.id}
																			className="flex items-center gap-2"
																		>
																			<input
																				type="text"
																				value={opt.label}
																				onChange={(e) =>
																					handleUpdateOptionLabel(
																						q.id,
																						opt.id,
																						e.target.value,
																					)
																				}
																				className="flex-1 bg-white border border-slate-200 rounded-md py-1 px-2.5 text-xs text-[#1a1b21] focus:border-[#002972] outline-none"
																				disabled={user?.role === "visitor"}
																			/>
																			{user?.role !== "visitor" && (
																				<button
																					type="button"
																					onClick={() =>
																						handleDeleteOption(q.id, opt.id)
																					}
																					className="p-1 hover:text-[#ba1a1a]"
																				>
																					<span className="material-symbols-outlined text-sm">
																						close
																					</span>
																				</button>
																			)}
																		</div>
																	))}
																{user?.role !== "visitor" && (
																	<button
																		type="button"
																		onClick={() =>
																			handleAddOption(q.id, "column")
																		}
																		className="text-xxs font-bold text-[#0b3e9c] hover:underline flex items-center gap-1"
																	>
																		<span className="material-symbols-outlined text-xs">
																			add
																		</span>
																		<span>Tambah Kolom</span>
																	</button>
																)}
															</div>
														</div>
													</div>
												)}

												{/* Bottom Controls */}
												<div className="pt-2 border-t border-slate-200/60 flex justify-end items-center gap-4 text-[#747683]">
													{user?.role !== "visitor" && (
														<>
															<button
																type="button"
																onClick={() => handleDeleteQuestion(q.id)}
																className="hover:text-[#ba1a1a] flex items-center gap-1 text-xs font-semibold"
																title="Hapus Pertanyaan"
															>
																<span className="material-symbols-outlined text-sm">
																	delete
																</span>
																Hapus
															</button>
															<div className="w-px h-5 bg-slate-200"></div>
														</>
													)}
													<label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
														<span>Wajib Diisi</span>
														<input
															type="checkbox"
															checked={!!q.required}
															onChange={(e) =>
																handleQuestionFieldChange(
																	q.id,
																	"required",
																	e.target.checked,
																)
															}
															className="rounded border-slate-300 text-[#002972] focus:ring-[#002972] h-4 w-4"
															disabled={user?.role === "visitor"}
														/>
													</label>
												</div>
											</div>
										))
									)}

									{/* Add button inside Section */}
									{user?.role !== "visitor" && (
										<div className="flex justify-center pt-2">
											<button
												type="button"
												onClick={() => handleAddQuestion(sec.id)}
												className="border border-[#747683] text-[#1a1b21] hover:bg-slate-50 text-xs font-bold py-2 px-6 rounded-lg flex items-center gap-1.5 transition-all shadow-sm"
											>
												<span className="material-symbols-outlined text-base">
													add_circle
												</span>
												<span>Tambah Pertanyaan di Bagian Ini</span>
											</button>
										</div>
									)}
								</div>
							</div>
						);
					})}

					{/* Saving footer buttons */}
					{user?.role !== "visitor" && (
						<div className="flex justify-end pt-4 border-t border-slate-200">
							<button
								onClick={handleSaveQuestions}
								disabled={isSavingQuestions}
								className="bg-[#002972] text-white hover:bg-[#0b3e9c] disabled:bg-slate-300 font-bold px-8 py-3 rounded-lg text-sm flex items-center gap-2 shadow-sm transition-all"
							>
								{isSavingQuestions
									? "Menyimpan Tata Letak..."
									: "Simpan Semua Pertanyaan"}
								<span className="material-symbols-outlined text-sm">save</span>
							</button>
						</div>
					)}
				</div>
			)}

			{/* ============================== RESPONSES TAB ============================== */}
			{tab === "responses" && (
				<div className="space-y-6">
					{/* Sub-tab Navigation */}
					<div className="flex gap-4 border-b border-[#c4c6d4] pb-2">
						<Link
							to="/admin/surveys/$surveyId"
							params={{ surveyId: surveyId.toString() }}
							search={{ tab: "responses", subtab: "ringkasan" }}
							className={`pb-1 px-1 border-b-2 text-xs font-bold transition-colors ${
								subtab === "ringkasan"
									? "border-[#002972] text-[#002972]"
									: "border-transparent text-[#434652] hover:text-[#002972]"
							}`}
						>
							Ringkasan
						</Link>
						<Link
							to="/admin/surveys/$surveyId"
							params={{ surveyId: surveyId.toString() }}
							search={{ tab: "responses", subtab: "pertanyaan" }}
							className={`pb-1 px-1 border-b-2 text-xs font-bold transition-colors ${
								subtab === "pertanyaan"
									? "border-[#002972] text-[#002972]"
									: "border-transparent text-[#434652] hover:text-[#002972]"
							}`}
						>
							Pertanyaan
						</Link>
						<Link
							to="/admin/surveys/$surveyId"
							params={{ surveyId: surveyId.toString() }}
							search={{ tab: "responses", subtab: "individual" }}
							className={`pb-1 px-1 border-b-2 text-xs font-bold transition-colors ${
								subtab === "individual"
									? "border-[#002972] text-[#002972]"
									: "border-transparent text-[#434652] hover:text-[#002972]"
							}`}
						>
							Individual
						</Link>
					</div>

					{/* Sub-tab Content: Ringkasan */}
					{subtab === "ringkasan" && stats && (
						<div className="space-y-6">
							{/* Summary stats Bento */}
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
								<div className="bg-white rounded-xl p-6 border border-[#c4c6d4] shadow-sm flex items-center justify-between">
									<div>
										<span className="text-xs font-bold text-[#434652] uppercase tracking-wider block">
											Total Jawaban
										</span>
										<p className="text-4xl font-bold text-[#002972] mt-1">
											{detail.responseCount}
										</p>
									</div>
									<div className="w-12 h-12 rounded-full bg-[#dbe1ff] flex items-center justify-center text-[#0f409e]">
										<span className="material-symbols-outlined text-2xl block">
											groups
										</span>
									</div>
								</div>

								<div className="bg-white rounded-xl p-6 border border-[#c4c6d4] shadow-sm flex items-center justify-between">
									<div>
										<span className="text-xs font-bold text-[#434652] uppercase tracking-wider block">
											Status Pengumpulan
										</span>
										<div className="flex items-center gap-1.5 mt-2">
											<span className="relative flex h-2.5 w-2.5">
												<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-450 opacity-75"></span>
												<span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
											</span>
											<span className="text-lg font-bold text-[#1a1b21]">
												Aktif
											</span>
										</div>
									</div>
									<div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
										<span className="material-symbols-outlined text-2xl block">
											wifi_tethering
										</span>
									</div>
								</div>
							</div>

							{/* Visual Charts list */}
							<div className="space-y-6">
								{stats
									.filter((stat: any) => !stat.redacted)
									.map((stat: any) => (
										<ChartCard
											key={stat.questionId}
											stat={stat}
											responseCount={detail.responseCount}
										/>
									))}
							</div>
						</div>
					)}

					{/* Sub-tab Content: Pertanyaan */}
					{subtab === "pertanyaan" &&
						stats &&
						(() => {
							const surveySections = detail.sections || [];
							const sortedSections = [...surveySections].sort(
								(a, b) => a.order - b.order,
							);
							const firstSectionId =
								sortedSections.length > 0 ? sortedSections[0].id : null;

							const displayQuestions = detail.questions.filter((q: any) => {
								if (
									user?.role === "visitor" &&
									firstSectionId !== null &&
									q.sectionId === firstSectionId
								) {
									return false;
								}
								return true;
							});

							const activeQid =
								qid ||
								(displayQuestions.length > 0
									? displayQuestions[0].id
									: undefined);
							const selectedQuestion = detail.questions.find(
								(q: any) => q.id === activeQid,
							);
							const selectedStat = stats.find(
								(s: any) => s.questionId === activeQid,
							);

							return (
								<div className="space-y-6">
									{/* Question Selector */}
									<div className="flex flex-col gap-1.5 w-full sm:w-80">
										<label className="text-xs font-bold text-[#434652] text-left">
											Pilih Pertanyaan
										</label>
										<select
											value={activeQid || ""}
											onChange={(e) => {
												router.navigate({
													search: (prev) => ({
														...prev,
														qid: Number(e.target.value),
													}),
												});
											}}
											className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm text-[#1a1b21] focus:border-[#002972] outline-none cursor-pointer"
										>
											{displayQuestions.map((q: any) => (
												<option key={q.id} value={q.id}>
													{q.title}
												</option>
											))}
										</select>
									</div>

									{selectedQuestion && selectedStat ? (
										<div className="space-y-6">
											{/* <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-left">
												<h3 className="font-bold text-lg text-[#1a1b21]">
													{selectedQuestion.title}
												</h3>
												{selectedQuestion.description && (
													<p className="text-xs text-[#747683] mt-1">
														{selectedQuestion.description}
													</p>
												)}
											</div> */}

											{/* Same chart card as Ringkasan, but standalone */}
											<ChartCard
												stat={selectedStat}
												responseCount={detail.responseCount}
											/>

											{/* Breakdown table for Choice types */}
											{!selectedStat.redacted &&
												(selectedQuestion.type === "multiple_choice" ||
													selectedQuestion.type === "dropdown" ||
													selectedQuestion.type === "linear_scale" ||
													selectedQuestion.type === "checkboxes") && (
													<div className="bg-white border border-[#c4c6d4] rounded-xl shadow-sm overflow-hidden text-left">
														<table className="w-full text-sm border-collapse">
															<thead>
																<tr className="bg-slate-50 border-b border-slate-200 text-[#434652] font-semibold text-xs uppercase tracking-wider">
																	<th className="py-3 px-6 text-left">Opsi</th>
																	<th className="py-3 px-6 text-right w-32">
																		Jumlah
																	</th>
																	<th className="py-3 px-6 text-right w-32">
																		Persentase
																	</th>
																</tr>
															</thead>
															<tbody className="divide-y divide-slate-100">
																{selectedStat.data.map(
																	(row: any, idx: number) => (
																		<tr
																			key={idx}
																			className="hover:bg-slate-50/50"
																		>
																			<td className="py-3.5 px-6 font-medium text-[#1a1b21]">
																				{row.label}
																			</td>
																			<td className="py-3.5 px-6 text-right text-[#434652] font-mono">
																				{row.count}
																			</td>
																			<td className="py-3.5 px-6 text-right text-[#434652] font-mono">
																				{row.percentage}%
																			</td>
																		</tr>
																	),
																)}
															</tbody>
														</table>
													</div>
												)}

											{/* Searchable Text answers list */}
											{(selectedQuestion.type === "short_text" ||
												selectedQuestion.type === "paragraph" ||
												selectedQuestion.type === "date") && (
												<div className="space-y-4">
													<div className="relative">
														<span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#747683] text-sm">
															search
														</span>
														<input
															type="text"
															placeholder="Cari jawaban teks..."
															value={textSearch}
															onChange={(e) => setTextSearch(e.target.value)}
															className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm placeholder-slate-400 focus:border-[#002972] outline-none transition-colors"
														/>
													</div>
													<div className="bg-white border border-[#c4c6d4] rounded-xl shadow-sm p-6 text-left">
														{(() => {
															const filteredTexts = (
																selectedStat.data || []
															).filter((txt: string) =>
																txt
																	.toLowerCase()
																	.includes(textSearch.toLowerCase()),
															);
															if (filteredTexts.length === 0) {
																return (
																	<p className="text-slate-400 text-sm italic text-center py-4">
																		Tidak ada jawaban yang cocok.
																	</p>
																);
															}
															return (
																<ul className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
																	{filteredTexts.map(
																		(txt: string, idx: number) => (
																			<li
																				key={idx}
																				className="py-3 text-sm text-[#1a1b21] first:pt-0 last:pb-0"
																			>
																				{txt}
																			</li>
																		),
																	)}
																</ul>
															);
														})()}
													</div>
												</div>
											)}
										</div>
									) : (
										<div className="bg-white border border-[#c4c6d4] rounded-xl shadow-sm p-8 text-center text-slate-400 text-sm">
											Pilih pertanyaan untuk melihat data jawaban.
										</div>
									)}
								</div>
							);
						})()}

					{/* Sub-tab Content: Individual */}
					{subtab === "individual" &&
						(() => {
							if (
								!responsesIndex ||
								responsesIndex.totalCount === 0 ||
								!responseDetail
							) {
								return (
									<div className="bg-white border border-[#c4c6d4] rounded-xl shadow-sm p-12 text-center text-slate-400 text-sm">
										Belum ada data jawaban yang dikirimkan.
									</div>
								);
							}

							return (
								<div className="space-y-6 text-left">
									{/* Individual Pager Header */}
									<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 border border-slate-200/80 rounded-xl p-4 shadow-sm">
										<div className="flex items-center gap-3">
											<span className="text-sm font-bold text-[#1a1b21]">
												Respon #{page} dari {responsesIndex.totalCount}
											</span>
										</div>

										{/* submitted time */}
										{responseDetail.submittedAt && (
											<span className="text-xs text-[#434652] font-semibold flex items-center gap-1">
												<span className="material-symbols-outlined text-sm">
													schedule
												</span>
												Dikirim:{" "}
												{new Date(responseDetail.submittedAt).toLocaleString(
													"id-ID",
													{
														dateStyle: "medium",
														timeStyle: "short",
													},
												)}
											</span>
										)}

										{/* Controls */}
										<div className="flex items-center gap-2">
											<button
												type="button"
												disabled={page <= 1}
												onClick={() => {
													router.navigate({
														search: (prev) => ({ ...prev, page: page - 1 }),
													});
												}}
												className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
											>
												<span className="material-symbols-outlined text-sm block">
													chevron_left
												</span>
											</button>

											<div className="flex items-center gap-1.5">
												<input
													type="number"
													min={1}
													max={responsesIndex.totalCount}
													value={page}
													onChange={(e) => {
														const val = Number(e.target.value);
														if (val >= 1 && val <= responsesIndex.totalCount) {
															router.navigate({
																search: (prev) => ({ ...prev, page: val }),
															});
														}
													}}
													className="w-12 text-center border border-slate-200 rounded py-1 text-xs font-mono"
												/>
												<span className="text-xs text-slate-400">
													/ {responsesIndex.totalCount}
												</span>
											</div>

											<button
												type="button"
												disabled={page >= responsesIndex.totalCount}
												onClick={() => {
													router.navigate({
														search: (prev) => ({ ...prev, page: page + 1 }),
													});
												}}
												className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
											>
												<span className="material-symbols-outlined text-sm block">
													chevron_right
												</span>
											</button>
										</div>
									</div>

									{/* Response Answers List */}
									<div className="space-y-6">
										{responseDetail.items
											.filter((item: any) => !item.hidden)
											.map((item: any) => {
												return (
													<div
														key={item.questionId}
														className="bg-white border border-[#c4c6d4] rounded-xl p-6 shadow-sm space-y-3"
													>
														<div className="flex justify-between items-start gap-4">
															<div>
																<h4 className="font-bold text-sm text-[#1a1b21] text-left">
																	{item.title}
																</h4>
																{item.description && (
																	<p className="text-xs text-[#747683] mt-0.5 text-left">
																		{item.description}
																	</p>
																)}
															</div>
															{item.required && (
																<span className="text-xxs font-bold text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded uppercase">
																	Wajib
																</span>
															)}
														</div>

														{/* Rendering input control */}
														{item.hidden ? (
															<div className="flex items-center gap-2.5 p-3.5 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-slate-500">
																<span className="material-symbols-outlined text-base text-slate-400 block">
																	lock
																</span>
																<span className="text-xs font-semibold">
																	Informasi pribadi disembunyikan untuk peninjau
																</span>
															</div>
														) : (
															<div className="pt-1">
																{item.type === "short_text" && (
																	<input
																		type="text"
																		disabled
																		value={item.valueText ?? "—"}
																		className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm text-[#1a1b21] opacity-70"
																	/>
																)}

																{item.type === "paragraph" && (
																	<textarea
																		disabled
																		rows={3}
																		value={item.valueText ?? "—"}
																		className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm text-[#1a1b21] opacity-70"
																	/>
																)}

																{item.type === "date" && (
																	<input
																		type="date"
																		disabled
																		value={item.valueText ?? ""}
																		className="bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm text-[#1a1b21] opacity-70 w-full sm:w-auto"
																	/>
																)}

																{(item.type === "multiple_choice" ||
																	item.type === "dropdown") && (
																	<div className="space-y-2">
																		{item.options.map((opt: any) => {
																			const isChecked =
																				item.valueOptionIds?.includes(opt.id);
																			return (
																				<div
																					key={opt.id}
																					className="flex items-center gap-2"
																				>
																					<input
																						type="radio"
																						disabled
																						checked={isChecked}
																						className="h-4 w-4 border-slate-300 text-[#002972] focus:ring-[#002972]"
																					/>
																					<label className="text-sm text-slate-600 font-medium">
																						{opt.label}
																					</label>
																				</div>
																			);
																		})}
																	</div>
																)}

																{item.type === "checkboxes" && (
																	<div className="space-y-2">
																		{item.options.map((opt: any) => {
																			const isChecked =
																				item.valueOptionIds?.includes(opt.id);
																			return (
																				<div
																					key={opt.id}
																					className="flex items-center gap-2"
																				>
																					<input
																						type="checkbox"
																						disabled
																						checked={isChecked}
																						className="h-4 w-4 rounded border-slate-300 text-[#002972] focus:ring-[#002972]"
																					/>
																					<label className="text-sm text-slate-600 font-medium">
																						{opt.label}
																					</label>
																				</div>
																			);
																		})}
																	</div>
																)}

																{item.type === "linear_scale" && (
																	<div className="flex items-center gap-3">
																		{item.options.map((opt: any) => {
																			const isChecked =
																				item.valueOptionIds?.includes(opt.id);
																			return (
																				<div
																					key={opt.id}
																					className="flex flex-col items-center gap-1 p-2 bg-slate-50 border border-slate-200/60 rounded-lg min-w-10"
																				>
																					<span className="text-xs font-semibold text-slate-500">
																						{opt.label}
																					</span>
																					<input
																						type="radio"
																						disabled
																						checked={isChecked}
																						className="h-4 w-4 border-slate-300 text-[#002972]"
																					/>
																				</div>
																			);
																		})}
																	</div>
																)}

																{item.type === "grid" &&
																	(() => {
																		const rows = item.options.filter(
																			(o: any) => o.group === "row",
																		);
																		const cols = item.options.filter(
																			(o: any) => o.group === "column",
																		);
																		return (
																			<div className="border border-slate-200 rounded-lg overflow-x-auto bg-slate-50/50">
																				<table className="w-full text-xs text-left border-collapse">
																					<thead>
																						<tr className="bg-slate-100/80 border-b border-slate-200">
																							<th className="py-2.5 px-4 font-bold text-slate-700">
																								Pernyataan
																							</th>
																							{cols.map((c: any) => (
																								<th
																									key={c.id}
																									className="py-2.5 px-3 font-bold text-slate-700 text-center"
																								>
																									{c.label}
																								</th>
																							))}
																						</tr>
																					</thead>
																					<tbody className="divide-y divide-slate-200">
																						{rows.map((r: any) => (
																							<tr
																								key={r.id}
																								className="hover:bg-slate-100/30"
																							>
																								<td className="py-3 px-4 font-semibold text-slate-800">
																									{r.label}
																								</td>
																								{cols.map((c: any) => {
																									const isChecked =
																										item.valueGrid?.[
																											String(r.id)
																										] === c.id;
																									return (
																										<td
																											key={c.id}
																											className="py-3 px-3 text-center"
																										>
																											<input
																												type="radio"
																												disabled
																												checked={isChecked}
																												className="h-3.5 w-3.5 border-slate-300 text-[#002972]"
																											/>
																										</td>
																									);
																								})}
																							</tr>
																						))}
																					</tbody>
																				</table>
																			</div>
																		);
																	})()}
															</div>
														)}
													</div>
												);
											})}
									</div>
								</div>
							);
						})()}
				</div>
			)}

			{/* ============================== SETTINGS TAB ============================== */}
			{tab === "settings" && (
				<div className="max-w-4xl bg-white border border-[#c4c6d4] rounded-xl p-6 shadow-sm">
					<form onSubmit={handleSaveSettings} className="space-y-6">
						<div className="flex flex-col gap-1.5">
							<label
								htmlFor="settingsTitle"
								className="text-sm font-bold text-[#1a1b21]"
							>
								Judul Kuesioner
							</label>
							<input
								type="text"
								id="settingsTitle"
								value={settingsTitle}
								onChange={(e) => setSettingsTitle(e.target.value)}
								className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-sm text-[#1a1b21] focus:border-[#002972] focus:ring-1 focus:ring-[#002972] focus:bg-white outline-none transition-colors"
								required
								disabled={isSavingSettings || user?.role === "visitor"}
							/>
						</div>

						<div className="flex flex-col gap-1.5">
							<label
								htmlFor="settingsSlug"
								className="text-sm font-bold text-[#1a1b21]"
							>
								Slug URL
							</label>
							<div className="relative flex items-center gap-2">
								<div className="flex flex-1 items-center">
									<span className="bg-slate-100 border border-r-0 border-slate-200 rounded-l-lg py-2.5 px-3.5 text-xs text-[#747683] font-semibold">
										/survey/
									</span>
									<input
										type="text"
										id="settingsSlug"
										value={settingsSlug}
										onChange={(e) => setSettingsSlug(e.target.value)}
										className="w-full bg-slate-50 border border-slate-200 rounded-r-lg py-2.5 px-4 text-sm text-[#1a1b21] focus:border-[#002972] focus:ring-1 focus:ring-[#002972] focus:bg-white outline-none transition-colors"
										required
										disabled={isSavingSettings || user?.role === "visitor"}
									/>
								</div>
								<button
									type="button"
									onClick={handleCopyLink}
									className="flex-shrink-0 bg-white border border-slate-200 hover:bg-slate-50 text-[#434652] hover:text-[#0b3e9c] rounded-lg p-2.5 transition-colors flex items-center justify-center shadow-sm"
									title="Salin Link Survey"
								>
									<span
										className={`material-symbols-outlined text-base ${isCopied ? "text-emerald-600" : ""}`}
									>
										{isCopied ? "check" : "content_copy"}
									</span>
								</button>
							</div>
						</div>

						<div className="flex flex-col gap-1.5">
							<label
								htmlFor="settingsCategory"
								className="text-sm font-bold text-[#1a1b21]"
							>
								Kategori Survei
							</label>
							<div className="relative">
								<select
									id="settingsCategory"
									value={settingsCategory}
									onChange={(e) => setSettingsCategory(e.target.value)}
									className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 pr-10 text-sm text-[#1a1b21] focus:border-[#002972] focus:ring-1 focus:ring-[#002972] focus:bg-white outline-none transition-colors appearance-none cursor-pointer"
									disabled={isSavingSettings || user?.role === "visitor"}
								>
									<option value="tracer">Tracer Study Alumni</option>
									<option value="kepuasan">
										Survei Kepuasan &amp; Layanan
									</option>
								</select>
								<span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
									arrow_drop_down
								</span>
							</div>
						</div>

						<div className="flex flex-col gap-1.5">
							<label className="text-sm font-bold text-[#1a1b21]">
								Periode Survei (Wajib Diisi)
							</label>
							<div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 w-fit">
								<button
									type="button"
									onClick={() => {
										setSettingsPeriodType("month");
										setSettingsPeriodValue("");
										setSettingsPeriodValueEnd("");
									}}
									className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${settingsPeriodType === "month" ? "bg-white shadow-sm text-[#002972]" : "text-[#747683]"}`}
									disabled={isSavingSettings || user?.role === "visitor"}
								>
									Bulan
								</button>
								<button
									type="button"
									onClick={() => {
										setSettingsPeriodType("date");
										setSettingsPeriodValue("");
										setSettingsPeriodValueEnd("");
									}}
									className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${settingsPeriodType === "date" ? "bg-white shadow-sm text-[#002972]" : "text-[#747683]"}`}
									disabled={isSavingSettings || user?.role === "visitor"}
								>
									Tanggal Spesifik
								</button>
							</div>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div className="flex flex-col gap-1">
									<span className="text-xs font-medium text-slate-500 text-left">
										Mulai
									</span>
									<input
										type={settingsPeriodType === "month" ? "month" : "date"}
										value={settingsPeriodValue}
										onChange={(e) => setSettingsPeriodValue(e.target.value)}
										className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-sm text-[#1a1b21] focus:border-[#002972] focus:ring-1 focus:ring-[#002972] focus:bg-white outline-none transition-colors"
										required
										disabled={isSavingSettings || user?.role === "visitor"}
									/>
								</div>
								<div className="flex flex-col gap-1">
									<span className="text-xs font-medium text-slate-500 text-left">
										Berakhir
									</span>
									<input
										type={settingsPeriodType === "month" ? "month" : "date"}
										value={settingsPeriodValueEnd}
										onChange={(e) => setSettingsPeriodValueEnd(e.target.value)}
										className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-sm text-[#1a1b21] focus:border-[#002972] focus:ring-1 focus:ring-[#002972] focus:bg-white outline-none transition-colors"
										required
										disabled={isSavingSettings || user?.role === "visitor"}
									/>
								</div>
							</div>
						</div>

						<div className="flex flex-col gap-1.5">
							<label
								htmlFor="settingsStatus"
								className="text-sm font-bold text-[#1a1b21]"
							>
								Status Publikasi
							</label>
							<div className="relative">
								<select
									id="settingsStatus"
									value={settingsStatus}
									onChange={(e) => setSettingsStatus(e.target.value as any)}
									className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 pr-10 text-sm text-[#1a1b21] focus:border-[#002972] focus:ring-1 focus:ring-[#002972] focus:bg-white outline-none transition-colors appearance-none cursor-pointer"
									disabled={isSavingSettings || user?.role === "visitor"}
								>
									<option value="draft">Draft (Hanya Admin)</option>
									<option value="published">
										Dipublikasikan (Publik dapat mengisi)
									</option>
									<option value="archived">Diarsipkan (Koleksi ditutup)</option>
								</select>
								<span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
									arrow_drop_down
								</span>
							</div>
						</div>

						<div className="flex flex-col gap-1.5">
							<label className="text-sm font-bold text-[#1a1b21]">
								Banner Survei (Unggah Gambar)
							</label>
							<input
								type="file"
								ref={bannerFileInputRef}
								id="settingsBannerUrl"
								accept="image/*"
								onChange={handleBannerUpload}
								className="hidden"
							/>
							<div className="flex items-center gap-3">
								<button
									type="button"
									onClick={() => bannerFileInputRef.current?.click()}
									disabled={isSavingSettings || user?.role === "visitor"}
									className="px-4 py-2 bg-[#dbe1ff] text-[#0b3e9c] hover:bg-[#002972] hover:text-white font-semibold rounded-lg text-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
								>
									<span className="material-symbols-outlined text-sm">
										upload
									</span>
									Pilih Gambar Banner
								</button>
								{settingsBannerUrl && (
									<span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
										<span className="material-symbols-outlined text-sm">
											check_circle
										</span>
										Gambar terpilih
									</span>
								)}
							</div>
							{settingsBannerUrl && (
								<div className="relative mt-2 h-40 w-full rounded-lg border border-slate-200 overflow-hidden group">
									<img
										src={settingsBannerUrl}
										alt="Banner Preview"
										className="h-full w-full object-cover"
									/>
									{user?.role !== "visitor" && (
										<button
											type="button"
											onClick={() => {
												setSettingsBannerUrl("");
												if (bannerFileInputRef.current)
													bannerFileInputRef.current.value = "";
											}}
											className="absolute top-3 right-3 bg-white text-[#ba1a1a] p-1.5 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
										>
											<span className="material-symbols-outlined text-sm block">
												delete
											</span>
										</button>
									)}
								</div>
							)}
						</div>

						<div className="flex flex-col gap-1.5">
							<label
								htmlFor="settingsDesc"
								className="text-sm font-bold text-[#1a1b21]"
							>
								Deskripsi / Kata Pengantar
							</label>
							<textarea
								id="settingsDesc"
								rows={4}
								value={settingsDesc}
								onChange={(e) => setSettingsDesc(e.target.value)}
								className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-sm text-[#1a1b21] focus:border-[#002972] focus:ring-1 focus:ring-[#002972] focus:bg-white outline-none transition-colors"
								disabled={isSavingSettings || user?.role === "visitor"}
							/>
						</div>

						<div className="h-px bg-slate-100 my-4"></div>
						{user?.role !== "visitor" && (
							<div className="flex justify-between items-center">
								<button
									type="button"
									onClick={() => setIsDuplicateDialogOpen(true)}
									disabled={isSavingSettings || isDuplicating}
									className="bg-white border border-slate-200 text-[#434652] hover:bg-slate-50 hover:text-[#0b3e9c] font-semibold px-6 py-2.5 rounded-lg text-sm shadow-sm transition-colors flex items-center gap-2"
								>
									<span className="material-symbols-outlined text-sm">
										content_copy
									</span>
									Duplikat Survei
								</button>
								<button
									type="submit"
									disabled={isSavingSettings || isDuplicating}
									className="bg-[#002972] text-white hover:bg-[#0b3e9c] font-semibold px-6 py-2.5 rounded-lg text-sm shadow-sm transition-colors"
								>
									{isSavingSettings
										? "Menyimpan Perubahan..."
										: "Simpan Perubahan"}
								</button>
							</div>
						)}
					</form>
				</div>
			)}

			<ConfirmDialog
				isOpen={isDuplicateDialogOpen}
				title="Duplikat Survei"
				message="Apakah Anda yakin ingin menduplikat survei ini beserta seluruh pertanyaannya?"
				confirmText={isDuplicating ? "Menduplikat..." : "Ya, Duplikat"}
				cancelText="Batal"
				onConfirm={handleDuplicate}
				onCancel={() => setIsDuplicateDialogOpen(false)}
				variant="primary"
			/>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────
// CHART HELPERS & COMPONENT
// ─────────────────────────────────────────────────────────────
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	LabelList,
	Legend,
	Line,
	LineChart,
	Pie,
	PieChart,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "../../components/ui/chart";

const safeKey = (str: string | null | undefined) => {
	if (typeof str !== "string") return "";
	return str.replace(/[^a-zA-Z0-9]/g, "_");
};

const pickChartKind = (stat: any) => {
	const type = stat.type;
	const count = stat.optionCount || 0;

	if (type === "short_text" || type === "paragraph" || type === "date") {
		return "text";
	}
	if (type === "grid") {
		return "grid";
	}
	if (count <= 4) {
		return "pie";
	}
	if (count <= 8) {
		return "line";
	}
	return "bar-horizontal";
};

function ChartCard({
	stat,
	responseCount,
}: {
	stat: any;
	responseCount: number;
}) {
	const chartRef = useRef<HTMLDivElement>(null);
	const [copyState, setCopyState] = useState<"idle" | "copied" | "downloaded">(
		"idle",
	);

	const handleCopyChart = async () => {
		if (!chartRef.current) return;
		try {
			await copyElementChartAsPng(chartRef.current);
			setCopyState("copied");
			toast.success(
				"Grafik disalin ke clipboard. Tempel (Ctrl+V) di dokumen lain.",
			);
		} catch (err: any) {
			if (err?.message === "FALLBACK_DOWNLOAD") {
				setCopyState("downloaded");
				toast.info(
					"Browser Anda tidak mendukung salin gambar langsung — grafik diunduh sebagai PNG.",
				);
			} else {
				toast.error(err?.message || "Gagal menyalin grafik.");
			}
		} finally {
			setTimeout(() => setCopyState("idle"), 2000);
		}
	};

	const chartKind = pickChartKind(stat);
	const primaryColor = "#002972";
	const primaryPalette = [
		"#002972", // Primary Dark Blue
		"#0b3e9c", // Medium Blue
		"#3b82f6", // Royal Blue
		"#95b0ff", // Light Blue
		"#e2e2ea", // Slate Gray
	];

	const chartConfig = React.useMemo(() => {
		const config: any = {};
		if (stat.type === "grid" && stat.data?.columns) {
			stat.data.columns.forEach((col: string, idx: number) => {
				const color =
					primaryPalette[idx % primaryPalette.length] || primaryColor;
				config[safeKey(col)] = {
					label: col,
					color,
				};
			});
		} else if (Array.isArray(stat.data)) {
			stat.data.forEach((item: any, idx: number) => {
				if (
					item &&
					typeof item === "object" &&
					typeof item.label === "string"
				) {
					config[safeKey(item.label)] = {
						label: item.label,
						color: primaryColor,
					};
				}
			});
		}
		return config;
	}, [stat]);

	return (
		<div
			data-chart-card=""
			data-question-id={stat.questionId}
			data-chart-label={stat.title}
			className="bg-white rounded-xl border border-[#c4c6d4] shadow-sm overflow-hidden"
		>
			<div className="py-4 px-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
				<div>
					<h3 className="font-bold text-base text-[#1a1b21] text-left">
						{stat.title}
					</h3>
					<span className="text-xs text-[#747683] block mt-0.5 text-left">
						{responseCount} respon
					</span>
				</div>
				{chartKind !== "text" && !stat.redacted && (
					<button
						type="button"
						onClick={handleCopyChart}
						title="Salin grafik sebagai gambar"
						className="p-1.5 rounded-lg border border-slate-200 text-[#434652] hover:bg-slate-50 hover:text-[#0b3e9c] transition-colors cursor-pointer"
					>
						<span className="material-symbols-outlined text-sm block">
							{copyState === "copied"
								? "check"
								: copyState === "downloaded"
									? "download"
									: "content_copy"}
						</span>
					</button>
				)}
			</div>

			<div className="p-6">
				{stat.redacted ? (
					<div className="flex flex-col items-center justify-center p-8 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-slate-500">
						<span className="material-symbols-outlined text-3xl mb-2 text-slate-400">
							lock
						</span>
						<p className="text-sm font-semibold">
							Informasi pribadi disembunyikan untuk peninjau
						</p>
					</div>
				) : (
					<div ref={chartRef} data-chart-root="">
						{chartKind === "text" && (
							<div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
								{!stat.data || stat.data.length === 0 ? (
									<p className="text-slate-400 text-xs italic text-left">
										Belum ada respon teks masuk.
									</p>
								) : (
									<ul className="space-y-2 text-sm max-h-60 overflow-y-auto text-left">
										{stat.data.map((txt: string, idx: number) => (
											<li
												key={idx}
												className="p-2 bg-white border border-slate-200/60 rounded text-[#1a1b21]"
											>
												{txt}
											</li>
										))}
									</ul>
								)}
							</div>
						)}

						{chartKind === "pie" &&
							(() => {
								const pieData = stat.data.map((item: any, idx: number) => ({
									...item,
									fill: primaryPalette[idx % primaryPalette.length],
								}));

								return (
									<div className="flex flex-col items-center">
										<ChartContainer
											config={chartConfig}
											className="aspect-square max-h-[280px] w-full"
										>
											<PieChart>
												<ChartTooltip
													content={
														<ChartTooltipContent nameKey="label" hideLabel />
													}
												/>
												<Pie
													isAnimationActive={false}
													data={pieData}
													dataKey="count"
													nameKey="label"
													labelLine={false}
													label={({ payload, ...props }: any) => (
														<text
															cx={props.cx}
															cy={props.cy}
															x={props.x}
															y={props.y}
															textAnchor={props.textAnchor}
															dominantBaseline={props.dominantBaseline}
															fill="#1a1b21"
															fontSize={11}
															fontWeight="bold"
														>
															{payload.count}
														</text>
													)}
												/>
												<ChartLegend
													content={<ChartLegendContent nameKey="label" />}
													className="flex-wrap gap-2 *:basis-1/2 *:justify-start"
												/>
											</PieChart>
										</ChartContainer>
									</div>
								);
							})()}

						{chartKind === "bar-vertical" && (
							<ChartContainer
								config={chartConfig}
								className="min-h-[300px] w-full"
							>
								<BarChart
									data={stat.data}
									margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
								>
									<CartesianGrid vertical={false} strokeDasharray="3 3" />
									<XAxis dataKey="label" tickLine={false} axisLine={false} />
									<YAxis tickLine={false} axisLine={false} />
									<ChartTooltip content={<ChartTooltipContent />} />
									<Bar
										isAnimationActive={false}
										dataKey="count"
										fill={primaryColor}
										radius={[4, 4, 0, 0]}
									>
										<LabelList
											dataKey="count"
											position="top"
											style={{
												fill: "#1a1b21",
												fontSize: 11,
												fontWeight: "bold",
											}}
										/>
									</Bar>
								</BarChart>
							</ChartContainer>
						)}

						{chartKind === "line" && (
							<ChartContainer
								config={chartConfig}
								className="min-h-[300px] w-full"
							>
								<LineChart
									data={stat.data}
									margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
								>
									<CartesianGrid strokeDasharray="3 3" />
									<XAxis dataKey="label" tickLine={false} axisLine={false} />
									<YAxis tickLine={false} axisLine={false} />
									<ChartTooltip content={<ChartTooltipContent />} />
									<Line
										isAnimationActive={false}
										type="monotone"
										dataKey="count"
										stroke={primaryColor}
										strokeWidth={2}
										activeDot={{ r: 8 }}
									>
										<LabelList
											dataKey="count"
											position="top"
											style={{
												fill: "#1a1b21",
												fontSize: 11,
												fontWeight: "bold",
											}}
										/>
									</Line>
								</LineChart>
							</ChartContainer>
						)}

						{chartKind === "bar-horizontal" &&
							(() => {
								const rowHeight = 32; // px per category — enough for an 11px label without collision
								const computedHeight = Math.max(
									400,
									stat.data.length * rowHeight,
								);
								const cappedHeight = Math.min(computedHeight, 1200); // hard ceiling so the card can't run away
								const needsScroll = computedHeight > cappedHeight;
								const yAxisWidth = 140; // widened from 90 — long prodi/institution names need more room

								const chart = (
									<ChartContainer
										config={chartConfig}
										className="aspect-auto w-full"
										style={{ height: cappedHeight }}
									>
										<BarChart
											data={stat.data}
											layout="vertical"
											margin={{ top: 20, right: 30, bottom: 20, left: 20 }}
										>
											<CartesianGrid horizontal={false} strokeDasharray="3 3" />
											<XAxis type="number" tickLine={false} axisLine={false} />
											<YAxis
												dataKey="label"
												type="category"
												tickLine={false}
												axisLine={false}
												width={yAxisWidth}
												fontSize={10}
												interval={0}
												tickFormatter={(val: string) =>
													val.length > 22 ? `${val.slice(0, 22)}…` : val
												}
											/>
											<ChartTooltip content={<ChartTooltipContent />} />
											<Bar
												isAnimationActive={false}
												dataKey="count"
												fill={primaryColor}
												radius={[0, 4, 4, 0]}
											>
												<LabelList
													dataKey="count"
													position="right"
													style={{
														fill: "#1a1b21",
														fontSize: 11,
														fontWeight: "bold",
													}}
												/>
											</Bar>
										</BarChart>
									</ChartContainer>
								);

								return needsScroll ? (
									<div className="max-h-[600px] overflow-y-auto">{chart}</div>
								) : (
									chart
								);
							})()}

						{chartKind === "grid" && stat.data && (
							<ChartContainer
								config={chartConfig}
								className="min-h-[400px] w-full"
							>
								<BarChart
									data={stat.data.rows.map((rowLabel: string) => {
										const item: any = { row: rowLabel };
										stat.data.columns.forEach((colLabel: string) => {
											item[colLabel] =
												stat.data.counts[rowLabel]?.[colLabel] || 0;
										});
										return item;
									})}
									margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
								>
									<CartesianGrid vertical={false} strokeDasharray="3 3" />
									<XAxis
										dataKey="row"
										tickLine={false}
										axisLine={false}
										tickFormatter={(val) =>
											val.length > 20 ? `${val.slice(0, 20)}...` : val
										}
									/>
									<YAxis tickLine={false} axisLine={false} />
									<ChartTooltip content={<ChartTooltipContent />} />
									<ChartLegend content={<ChartLegendContent />} />
									{stat.data.columns.map((colLabel: string, colIdx: number) => {
										const cKey = safeKey(colLabel);
										return (
											<Bar
												isAnimationActive={false}
												key={colIdx}
												dataKey={colLabel}
												fill={chartConfig[cKey]?.color || primaryColor}
												radius={[4, 4, 0, 0]}
											/>
										);
									})}
								</BarChart>
							</ChartContainer>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
