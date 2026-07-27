import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
	AlertTriangle,
	ArrowDown,
	ArrowUp,
	Calendar,
	Check,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronUp,
	Circle,
	CircleCheck,
	CirclePlus,
	Clock,
	CloudCheck,
	Copy,
	Download,
	FileText,
	Lock,
	PanelsTopLeft,
	Pencil,
	Plus,
	Printer,
	RefreshCw,
	Save,
	Search,
	SquarePlus,
	Table,
	Trash2,
	Upload,
	Users,
	Wifi,
	X,
} from "lucide-react";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Dialog } from "../../components/ui/Dialog";
import { Skeleton } from "../../components/ui/Skeleton";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../../components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { toast } from "../../components/ui/useToast";
import { useSurveyLive } from "../../hooks/useSurveyLive";
import {
	chartElementToPngBase64,
	copyElementChartAsPng,
} from "../../lib/copyChartImage";
import {
	deleteAdminSurveyResponseFn,
	duplicateAdminSurveyFn,
	exportAdminSurveyResponsesCSVFn,
	exportAdminSurveyResponsesXLSXFn,
	generateSurveyReportFn,
	getAdminSurveyAnswersStatsFn,
	getAdminSurveyDetailFn,
	getAdminSurveyResponseDetailFn,
	getAdminSurveyResponsesListFn,
	getLatestSurveyReportFn,
	getSiakadAutofillSuggestionFn,
	getSurveyCategoriesFn,
	updateAdminSurveyQuestionsFn,
	updateAdminSurveyResponseFn,
	updateAdminSurveySettingsFn,
	updateSiakadAutofillConfigFn,
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
		const [detail, categories] = await Promise.all([
			getAdminSurveyDetailFn({ data: surveyId }),
			getSurveyCategoriesFn(),
		]);
		let stats = null;
		let responseDetail = null;
		let responsesIndex = null;

		if (
			deps.tab === "responses" &&
			(deps.subtab === "ringkasan" || deps.subtab === "pertanyaan")
		) {
			stats = await getAdminSurveyAnswersStatsFn({ data: { surveyId } });
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

		return {
			detail,
			stats,
			responseDetail,
			responsesIndex,
			surveyId,
			categories,
		};
	},
	component: SurveyDetailComponent,
});

function LiveFillingBadge({ count }: { count: number }) {
	if (count <= 0) return null;
	return (
		<span className="inline-flex items-center gap-1.5 bg-[#B00000]/10 text-[#4A0000] text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-[#B00000]/10">
			<span className="relative flex h-2 w-2">
				<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#B00000] opacity-75" />
				<span className="relative inline-flex rounded-full h-2 w-2 bg-[#B00000]" />
			</span>
			{count} sedang mengisi
		</span>
	);
}

function SurveyDetailComponent() {
	const {
		detail,
		stats,
		responseDetail,
		responsesIndex,
		surveyId,
		categories,
	} = Route.useLoaderData();
	const { tab, subtab, qid, page } = Route.useSearch();
	const router = useRouter();
	const { user } = Route.useRouteContext();

	const [isRefreshing, setIsRefreshing] = useState(false);
	const [pulseAnswers, setPulseAnswers] = useState(false);
	const [refreshTick, setRefreshTick] = useState(0);

	const liveCount = useSurveyLive(surveyId, "viewer", () => {
		setIsRefreshing(true);
		setPulseAnswers(true);
		setRefreshTick((prev) => prev + 1);
		router.invalidate().then(() => {
			setIsRefreshing(false);
			setTimeout(() => setPulseAnswers(false), 900);
		});
	});

	const bannerFileInputRef = useRef<HTMLInputElement>(null);

	// Local state for Questions Tab editor
	const [sections, setSections] = useState<any[]>([]);
	const [questions, setQuestions] = useState<any[]>([]);
	const [isSavingQuestions, setIsSavingQuestions] = useState(false);
	const [deleteSectionId, setDeleteSectionId] = useState<any>(null);
	const [previewFilterOptionId, setPreviewFilterOptionId] = useState<
		number | string | "all"
	>("all");

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
	const [settingsTargetRespondentCount, setSettingsTargetRespondentCount] =
		useState<number | null>(null);
	const [isSavingSettings, setIsSavingSettings] = useState(false);

	const selectedCategoryObj = categories.find(
		(c) => c.slug === settingsCategory,
	);
	const requirePeriod = selectedCategoryObj?.requirePeriod ?? false;

	// SIAKAD Auto-Fill state
	const [isSiakadDialogOpen, setIsSiakadDialogOpen] = useState(false);
	const [siakadEnabled, setSiakadEnabled] = useState(false);
	const [siakadNimQuestionId, setSiakadNimQuestionId] = useState<number | null>(
		null,
	);
	const [siakadMappings, setSiakadMappings] = useState<
		{ questionId: number; field: string }[]
	>([]);
	const [siakadCandidates, setSiakadCandidates] = useState<
		{ id: number; title: string }[]
	>([]);
	const [isSavingSiakad, setIsSavingSiakad] = useState(false);

	const handleOpenSiakadDialog = async () => {
		setIsSiakadDialogOpen(true);
		try {
			const res = await getSiakadAutofillSuggestionFn({
				data: detail.survey.id,
			});
			setSiakadCandidates(res.candidateQuestions);
			const existing = (detail.survey as any).siakadAutofillConfig;
			setSiakadEnabled(existing?.enabled ?? false);
			setSiakadNimQuestionId(
				existing?.nimQuestionId ?? res.suggestedNimQuestionId,
			);
			setSiakadMappings(existing?.mappings ?? res.suggestedMappings);
		} catch (err: any) {
			toast.error(err.message || "Gagal memuat saran mapping SIAKAD.");
		}
	};

	const handleSaveSiakadConfig = async () => {
		setIsSavingSiakad(true);
		try {
			await updateSiakadAutofillConfigFn({
				data: {
					surveyId: detail.survey.id,
					enabled: siakadEnabled,
					nimQuestionId: siakadNimQuestionId,
					mappings: siakadMappings,
				},
			});
			toast.success("Konfigurasi auto-isi SIAKAD tersimpan.");
			setIsSiakadDialogOpen(false);
			router.invalidate();
		} catch (err: any) {
			toast.error(err.message || "Gagal menyimpan konfigurasi.");
		} finally {
			setIsSavingSiakad(false);
		}
	};

	const [isEditingResponse, setIsEditingResponse] = useState(false);

	const [editAnswers, setEditAnswers] = useState<Record<number, any>>({});
	const [isSavingResponse, setIsSavingResponse] = useState(false);
	const [isCopied, setIsCopied] = useState(false);
	const [textSearch, setTextSearch] = useState("");
	const [csvFilterQuestionId, setCsvFilterQuestionId] = useState<string>("");
	const [csvFilterOptionIds, setCsvFilterOptionIds] = useState<string[]>([]);

	const [activeStats, setActiveStats] = useState(stats);
	const [isLoadingStats, setIsLoadingStats] = useState(false);
	const [isExporting, setIsExporting] = useState(false);

	useEffect(() => {
		setActiveStats(stats);
	}, [stats]);

	useEffect(() => {
		if (tab !== "responses" || user?.role === "visitor") return;
		let cancelled = false;
		setIsLoadingStats(true);
		getAdminSurveyAnswersStatsFn({
			data: {
				surveyId,
				filterQuestionId: csvFilterQuestionId
					? Number(csvFilterQuestionId)
					: undefined,
				filterOptionIds:
					csvFilterOptionIds.length > 0
						? csvFilterOptionIds.map(Number)
						: undefined,
			},
		})
			.then((res) => {
				if (!cancelled) setActiveStats(res);
			})
			.catch((err) => {
				if (!cancelled)
					toast.error(err.message || "Gagal memuat statistik terfilter.");
			})
			.finally(() => {
				if (!cancelled) setIsLoadingStats(false);
			});
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [surveyId, tab, csvFilterQuestionId, csvFilterOptionIds, refreshTick]);

	const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
	const exportMenuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!isExportMenuOpen) return;
		const handleClickOutside = (e: MouseEvent) => {
			if (
				exportMenuRef.current &&
				!exportMenuRef.current.contains(e.target as Node)
			) {
				setIsExportMenuOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [isExportMenuOpen]);

	const filterableQuestions = detail
		? (detail.questions || []).filter((q: any) =>
				["multiple_choice", "dropdown", "checkboxes"].includes(q.type),
			)
		: [];

	const selectItems = React.useMemo(() => {
		const list =
			detail?.survey?.category === "layanan-pengaduan"
				? []
				: [{ value: "", label: "Semua Pertanyaan (Tanpa Filter)" }];
		for (const q of filterableQuestions) {
			list.push({ value: String(q.id), label: q.title });
		}
		return list;
	}, [filterableQuestions, detail?.survey?.category]);

	const selectedFilterQuestion = filterableQuestions.find(
		(q: any) => String(q.id) === csvFilterQuestionId,
	);
	const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
	const [isDuplicating, setIsDuplicating] = useState(false);
	const [isDeleteResponseDialogOpen, setIsDeleteResponseDialogOpen] =
		useState(false);
	const [isDeletingResponse, setIsDeletingResponse] = useState(false);
	const [isGeneratingReport, setIsGeneratingReport] = useState(false);
	const [reportCooldown, setReportCooldown] = useState(0);
	const [latestReport, setLatestReport] = useState<{
		fileName: string;
		base64: string;
		generatedAt: string;
	} | null>(null);

	const fetchLatestReport = async () => {
		try {
			const report = await getLatestSurveyReportFn({
				data: {
					surveyId,
					filterQuestionId: csvFilterQuestionId
						? Number(csvFilterQuestionId)
						: undefined,
					filterOptionIds:
						csvFilterOptionIds.length > 0
							? csvFilterOptionIds.map(Number)
							: undefined,
				},
			});
			setLatestReport(report);
		} catch (err) {
			console.error("Gagal memuat laporan terakhir:", err);
		}
	};

	// Fetch latest report on mount/reload or filter changes
	useEffect(() => {
		fetchLatestReport();
	}, [surveyId, csvFilterQuestionId, csvFilterOptionIds]);

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
			setSettingsTargetRespondentCount(
				(detail.survey as any).targetRespondentCount ?? null,
			);

			if (detail.survey.category === "layanan-pengaduan") {
				const klarifikasi = detail.questions.find((q: any) =>
					q.title.toLowerCase().includes("klarifikasi"),
				);
				if (klarifikasi) {
					setCsvFilterQuestionId(String(klarifikasi.id));
				}
			}
		}
	}, [detail]);

	const enableConditional = detail?.survey
		? categories.find((c) => c.slug === detail.survey.category)
				?.enableConditional ?? false
		: false;

	// Derived values for branch preview filter in builder
	const mainFilterQuestion = questions.find(
		(q) =>
			q.type === "multiple_choice" &&
			questions.some((other) => other.conditionalParentQuestionId === q.id),
	);

	const isQuestionVisibleInPreview = (q: any) => {
		if (!enableConditional) return true;
		if (previewFilterOptionId === "all") return true;
		if (!q.conditionalParentQuestionId) return true;
		let current = q;
		while (current.conditionalParentQuestionId) {
			if (current.conditionalParentQuestionId === mainFilterQuestion?.id) {
				const allowedOptionIds = current.conditionalParentOptionIds || [];
				return allowedOptionIds.includes(previewFilterOptionId);
			}
			const parent = questions.find(
				(p) => p.id === current.conditionalParentQuestionId,
			);
			if (!parent) break;
			current = parent;
		}
		return true;
	};

	// Save Questions Layout Action
	const handleSaveQuestions = async () => {
		setIsSavingQuestions(true);
		try {
			// Renumber both arrays to guarantee clean sequences before sending
			const updatedSections = sections.map((s, idx) => ({
				...s,
				order: idx,
			}));
			const updatedQuestions = questions.map((q, idx) => ({
				...q,
				order: idx,
			}));

			// Set the local states with clean sequential orders
			setSections(updatedSections);
			setQuestions(updatedQuestions);

			// Map questions to matching sections and format for server transaction
			const questionsPayload = updatedQuestions.map((q) => {
				// Find matching section in current editor
				const section = updatedSections.find((s) => s.id === q.sectionId);
				const sectionOrder = section ? section.order : 0;

				return {
					id: q.id,
					sectionOrder,
					type: q.type,
					title: q.title,
					description: q.description || "",
					required: !!q.required,
					config: q.config ?? null,
					order: q.order,
					conditionalParentQuestionId: q.conditionalParentQuestionId || null,
					conditionalParentOptionIds: q.conditionalParentOptionIds || null,
					options: (q.options || []).map((o: any) => ({
						id: o.id,
						group: o.group,
						label: o.label,
						order: o.order,
					})),
				};
			});

			const sectionsPayload = updatedSections.map((s) => ({
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
		if (requirePeriod && (!settingsPeriodValue || !settingsPeriodValueEnd)) {
			toast.error("Periode survei mulai dan berakhir wajib diisi");
			return;
		}

		if (
			settingsPeriodValue &&
			settingsPeriodValueEnd &&
			settingsPeriodValueEnd < settingsPeriodValue
		) {
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
					targetRespondentCount: settingsTargetRespondentCount,
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

	const handleConfirmDeleteResponse = async () => {
		if (!responseDetail) return;
		if (isDeletingResponse) return;
		setIsDeletingResponse(true);
		try {
			await deleteAdminSurveyResponseFn({
				data: { surveyId, responseId: responseDetail.responseId },
			});
			toast.success("Respon berhasil dihapus.");
			setIsDeleteResponseDialogOpen(false);

			const newTotal = (responsesIndex?.totalCount || 0) - 1;
			const nextPage = page > newTotal ? Math.max(1, newTotal) : page;
			await router.navigate({
				search: (prev) => ({ ...prev, page: nextPage }),
			});
			await router.invalidate();
		} catch (err: any) {
			toast.error(err.message || "Gagal menghapus respon.");
		} finally {
			setIsDeletingResponse(false);
		}
	};

	const handlePrintResponse = () => {
		// Cari elemen print-only
		const printEl = document.querySelector(".print-only") as HTMLElement | null;
		if (!printEl) {
			window.print();
			return;
		}

		// Clone konten print dan taruh langsung di body
		const printClone = printEl.cloneNode(true) as HTMLElement;
		printClone.id = "__print_clone__";
		printClone.style.display = "block";

		// Simpan body asli dan ganti dengan konten print saja
		const originalBody = document.body.innerHTML;
		document.body.innerHTML = "";
		document.body.appendChild(printClone);

		window.print();

		// Restore body asli setelah print (afterprint / setelah dialog ditutup)
		const restore = () => {
			document.body.innerHTML = originalBody;
			// Re-attach React root setelah restore
			window.removeEventListener("afterprint", restore);
			// Reload halaman untuk mengembalikan React state
			window.location.reload();
		};
		window.addEventListener("afterprint", restore);
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

	const handleSectionFieldChange = (
		secId: any,
		key: "title" | "description",
		val: string,
	) => {
		setSections(
			sections.map((s) => (s.id === secId ? { ...s, [key]: val } : s)),
		);
	};

	const handleAddSection = () => {
		const newTempId = "new_sec_" + Math.random().toString(36).substring(2, 9);
		const maxOrder = sections.reduce(
			(max, s) => (s.order > max ? s.order : max),
			-1,
		);

		setSections([
			...sections,
			{
				id: newTempId,
				title: `Bagian Baru ${sections.length + 1}`,
				description: "",
				order: maxOrder + 1,
			},
		]);
	};

	const handleMoveSection = (index: number, direction: "up" | "down") => {
		const targetIndex = direction === "up" ? index - 1 : index + 1;
		if (targetIndex < 0 || targetIndex >= sections.length) return;

		const next = [...sections];
		const temp = next[index];
		next[index] = next[targetIndex];
		next[targetIndex] = temp;
		next.forEach((s, idx) => {
			s.order = idx;
		});

		setSections(next);
	};

	const handleDeleteSection = (secId: any) => {
		if (sections.length <= 1) return;

		const secToDelete = sections.find((s) => s.id === secId);
		if (!secToDelete) return;

		const remaining = sections.filter((s) => s.id !== secId);
		const deletedIdx = sections.findIndex((s) => s.id === secId);
		const fallbackSection = sections[deletedIdx - 1] ?? remaining[0];

		setQuestions(
			questions.map((q) =>
				q.sectionId === secId ? { ...q, sectionId: fallbackSection.id } : q,
			),
		);
		setSections(remaining.map((s, idx) => ({ ...s, order: idx })));
	};

	const handleSplitSectionAtQuestion = (qId: any) => {
		const question = questions.find((q) => q.id === qId);
		if (!question) return;

		const currentSection = sections.find((s) => s.id === question.sectionId);
		if (!currentSection) return;

		// Questions in the SAME section, in their current display order.
		const sectionQuestions = questions
			.filter((q) => q.sectionId === currentSection.id)
			.sort((a, b) => a.order - b.order);

		const splitIndex = sectionQuestions.findIndex((q) => q.id === qId);
		// Nothing to split off if this is already the first question in its section.
		if (splitIndex <= 0) return;

		const movingIds = new Set(
			sectionQuestions.slice(splitIndex).map((q) => q.id),
		);

		const newTempId = "new_sec_" + Math.random().toString(36).substring(2, 9);
		const currentIdx = sections.findIndex((s) => s.id === currentSection.id);

		// Insert the new section directly after the current one, then renumber
		// every section's `order` to keep the 0-based global sequence intact.
		const nextSections = [
			...sections.slice(0, currentIdx + 1),
			{
				id: newTempId,
				title: `${currentSection.title} (Lanjutan)`,
				description: "",
				order: 0, // placeholder, fixed below
			},
			...sections.slice(currentIdx + 1),
		].map((s, idx) => ({ ...s, order: idx }));

		setSections(nextSections);
		setQuestions(
			questions.map((q) =>
				movingIds.has(q.id) ? { ...q, sectionId: newTempId } : q,
			),
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
			const res = await exportAdminSurveyResponsesCSVFn({
				data: {
					surveyId,
					filterQuestionId: csvFilterQuestionId
						? Number(csvFilterQuestionId)
						: undefined,
					filterOptionIds:
						csvFilterOptionIds.length > 0
							? csvFilterOptionIds.map(Number)
							: undefined,
				},
			});
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

	const handleDownloadXLSX = async () => {
		try {
			const res = await exportAdminSurveyResponsesXLSXFn({
				data: {
					surveyId,
					filterQuestionId: csvFilterQuestionId
						? Number(csvFilterQuestionId)
						: undefined,
					filterOptionIds:
						csvFilterOptionIds.length > 0
							? csvFilterOptionIds.map(Number)
							: undefined,
				},
			});
			const byteChars = atob(res.base64);
			const byteNumbers = new Array(byteChars.length);
			for (let i = 0; i < byteChars.length; i++) {
				byteNumbers[i] = byteChars.charCodeAt(i);
			}
			const byteArray = new Uint8Array(byteNumbers);
			const blob = new Blob([byteArray], {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			});
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
		setIsExporting(true);
		toast.info("Sedang memproses grafik dan narasi AI laporan...");

		try {
			// Wait for layout to fully settle after switching to export full height
			await new Promise((resolve) => setTimeout(resolve, 150));

			// Find all chart cards rendered in the DOM
			const chartCardEls = document.querySelectorAll("[data-chart-card]");
			const charts: {
				questionId: number;
				label: string;
				imageBase64: string;
				pxWidth: number;
				pxHeight: number;
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
					const {
						base64: imageBase64,
						width: pxWidth,
						height: pxHeight,
					} = await chartElementToPngBase64(rootEl);
					charts.push({
						questionId: qId,
						label,
						imageBase64,
						pxWidth,
						pxHeight,
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
					filterQuestionId: csvFilterQuestionId
						? Number(csvFilterQuestionId)
						: undefined,
					filterOptionIds:
						csvFilterOptionIds.length > 0
							? csvFilterOptionIds.map(Number)
							: undefined,
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
			setIsExporting(false);
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
						<Link to="/admin/surveys" className="hover:text-[#4A0000]">
							Kelola Survey
						</Link>
						<ChevronRight className="h-3.5 w-3.5" />
						<span className="text-slate-400">Detail Survey</span>
					</nav>
					<h2 className="text-3xl font-bold text-[#1a1b21] flex items-center gap-3 w-full text-left">
						{detail.survey.title}
						{getStatusBadge(detail.survey.status)}
						<LiveFillingBadge count={liveCount} />
						{(detail.survey as any).periodValue && (
							<span className="inline-flex items-center gap-1 text-xs font-semibold text-[#434652] bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
								<Calendar className="h-4 w-4 text-[#747683] block" />
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
								{isGeneratingReport ? (
									<RefreshCw className="h-4 w-4 animate-spin" />
								) : (
									<FileText className="h-4 w-4" />
								)}
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
									<Download className="h-4 w-4" />
									<span>Unduh Laporan Terakhir</span>
								</button>
							)}
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
								? "border-[#4A0000] text-[#4A0000]"
								: "border-transparent text-[#434652] hover:text-[#4A0000]"
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
								? "border-[#4A0000] text-[#4A0000]"
								: "border-transparent text-[#434652] hover:text-[#4A0000]"
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
								? "border-[#4A0000] text-[#4A0000]"
								: "border-transparent text-[#434652] hover:text-[#4A0000]"
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
						<div className="h-2.5 w-full bg-[#B00000]"></div>
						<div className="p-6 space-y-3">
							<h2 className="text-xl font-bold text-[#1a1b21]">
								{detail.survey.title}
							</h2>
							<p className="text-sm text-[#434652]">
								{detail.survey.description || "Tidak ada deskripsi."}
							</p>
							<div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs text-[#747683]">
								<span className="flex items-center gap-1">
									<CloudCheck className="h-4 w-4" />
									Tersimpan di Database
								</span>
							</div>
						</div>
					</div>

					{/* Preview Filter Card */}
					{enableConditional && mainFilterQuestion && (
						<div className="bg-white rounded-lg border border-[#c4c6d4] shadow-sm p-4 flex flex-col md:flex-row md:items-start justify-between gap-4">
							<div className="space-y-1">
								<h3 className="text-sm font-bold text-[#1a1b21]">
									Preview Cabang Alur Pengisian
								</h3>
								<p className="text-xs text-slate-500">
									Sembunyikan/redupkan pertanyaan berdasarkan opsi filter utama
									"{mainFilterQuestion.title}".
								</p>
							</div>
							<div className="flex flex-wrap gap-2">
								<button
									type="button"
									onClick={() => setPreviewFilterOptionId("all")}
									className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
										previewFilterOptionId === "all"
											? "bg-[#4A0000] text-white border-[#4A0000]"
											: "bg-white text-[#1a1b21] border-slate-200 hover:bg-slate-50"
									}`}
								>
									Semua Pertanyaan
								</button>
								{(mainFilterQuestion.options || []).map((opt: any) => {
									const isSelected = previewFilterOptionId === opt.id;
									return (
										<button
											key={opt.id}
											type="button"
											onClick={() => setPreviewFilterOptionId(opt.id)}
											className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
												isSelected
													? "bg-[#4A0000] text-white border-[#4A0000]"
													: "bg-white text-[#1a1b21] border-slate-200 hover:bg-slate-50"
											}`}
										>
											Cabang: {opt.label}
										</button>
									);
								})}
							</div>
						</div>
					)}

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
								<div className="bg-[#eeedf6] px-6 py-3 border-b border-[#c4c6d4] space-y-2">
									<div className="flex items-center justify-between text-xs font-bold text-[#4A0000]">
										<span>
											Bagian {secIdx + 1} dari {sections.length}
										</span>
										<div className="flex items-center gap-2">
											{user?.role !== "visitor" && sections.length > 1 && (
												<div className="flex items-center gap-1 mr-2 bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-xxs">
													<button
														type="button"
														onClick={() => handleMoveSection(secIdx, "up")}
														disabled={secIdx === 0}
														className="p-0.5 text-[#434652] hover:text-[#4A0000] disabled:opacity-30 disabled:pointer-events-none"
														title="Pindahkan Bagian Ke Atas"
													>
														<ArrowUp className="h-4 w-4 block" />
													</button>
													<button
														type="button"
														onClick={() => handleMoveSection(secIdx, "down")}
														disabled={secIdx === sections.length - 1}
														className="p-0.5 text-[#434652] hover:text-[#4A0000] disabled:opacity-30 disabled:pointer-events-none"
														title="Pindahkan Bagian Ke Bawah"
													>
														<ArrowDown className="h-4 w-4 block" />
													</button>
												</div>
											)}
											{user?.role !== "visitor" && sections.length > 1 && (
												<button
													type="button"
													onClick={() => setDeleteSectionId(sec.id)}
													className="text-[#ba1a1a] hover:underline flex items-center gap-1 font-semibold"
													title="Hapus Bagian"
												>
													<Trash2 className="h-4 w-4" />
													Hapus Bagian
												</button>
											)}
										</div>
									</div>
									<input
										type="text"
										value={sec.title}
										onChange={(e) =>
											handleSectionFieldChange(sec.id, "title", e.target.value)
										}
										className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-sm font-bold text-[#1a1b21] focus:border-[#4A0000] outline-none"
										placeholder="Judul bagian..."
										disabled={user?.role === "visitor"}
									/>
									<input
										type="text"
										value={sec.description || ""}
										onChange={(e) =>
											handleSectionFieldChange(
												sec.id,
												"description",
												e.target.value,
											)
										}
										className="w-full bg-transparent border-none py-0.5 px-0 text-xs text-[#434652] focus:outline-none"
										placeholder="Deskripsi bagian (opsional)..."
										disabled={user?.role === "visitor"}
									/>
								</div>

								<div className="p-6 space-y-6">
									{secQuestions.length === 0 ? (
										<div className="p-8 text-center text-slate-400 text-sm">
											Belum ada pertanyaan di bagian ini. Klik tombol tambah di
											bawah untuk menambahkan.
										</div>
									) : (
										secQuestions.map((q, qIdx) => {
											const isVisibleInPreview = isQuestionVisibleInPreview(q);
											return (
												<div
													key={q.id}
													className={`p-4 rounded-lg border border-slate-100 bg-slate-50/50 space-y-4 relative group transition-all duration-300 ${
														!isVisibleInPreview
															? "opacity-25 grayscale-[30%] select-none hover:opacity-40"
															: ""
													}`}
												>
													{/* Arrow Reordering Controls */}
													{user?.role !== "visitor" && (
														<div className="absolute right-3 top-3 hidden group-hover:flex items-center gap-1 bg-white p-1 rounded-md border border-slate-200 shadow-sm">
															<button
																onClick={() =>
																	handleMoveQuestion(questions.indexOf(q), "up")
																}
																disabled={questions.indexOf(q) === 0}
																className="p-1 text-[#434652] hover:text-[#4A0000] disabled:opacity-30 disabled:pointer-events-none"
																title="Pindah Ke Atas"
															>
																<ArrowUp className="h-4 w-4 block" />
															</button>
															<button
																onClick={() =>
																	handleMoveQuestion(
																		questions.indexOf(q),
																		"down",
																	)
																}
																disabled={
																	questions.indexOf(q) === questions.length - 1
																}
																className="p-1 text-[#434652] hover:text-[#4A0000] disabled:opacity-30 disabled:pointer-events-none"
																title="Pindah Ke Bawah"
															>
																<ArrowDown className="h-4 w-4 block" />
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
																className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm text-[#1a1b21] focus:border-[#4A0000] outline-none"
																placeholder="Masukkan label pertanyaan..."
																disabled={user?.role === "visitor"}
															/>
															{enableConditional && q.conditionalParentQuestionId &&
																(() => {
																	const parent = questions.find(
																		(p) =>
																			String(p.id) ===
																			String(q.conditionalParentQuestionId),
																	);
																	if (!parent) return null;
																	const matchLabels = (
																		q.conditionalParentOptionIds || []
																	)
																		.map(
																			(optId) =>
																				parent.options?.find(
																					(o: any) => o.id === optId,
																				)?.label,
																		)
																		.filter(Boolean)
																		.join(", ");
																	return (
																		<div className="inline-flex items-center gap-1 bg-[#0B3E9C]/10 text-[#0B3E9C] text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-[#0B3E9C]/10 mt-1.5 w-fit">
																			Tampil jika: {parent.title} ={" "}
																			{matchLabels || "(kosong)"}
																		</div>
																	);
																})()}
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
																className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm text-[#1a1b21] focus:border-[#4A0000] outline-none cursor-pointer"
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
																<option value="dropdown">
																	Dropdown Pilihan
																</option>
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
															className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm text-slate-500 focus:border-[#4A0000] outline-none"
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
																		<Circle className="h-3.5 w-3.5 text-slate-300" />
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
																			className="flex-1 bg-white border border-slate-200 rounded-md py-1 px-2.5 text-xs text-[#1a1b21] focus:border-[#4A0000] outline-none"
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
																				<X className="h-4 w-4" />
																			</button>
																		)}
																	</div>
																))}
																{user?.role !== "visitor" && (
																	<button
																		type="button"
																		onClick={() => handleAddOption(q.id)}
																		className="text-xs font-bold text-[#B00000] hover:underline flex items-center gap-1 mt-1"
																	>
																		<Plus className="h-3.5 w-3.5" />
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
																					className="flex-1 bg-white border border-slate-200 rounded-md py-1 px-2.5 text-xs text-[#1a1b21] focus:border-[#4A0000] outline-none"
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
																						<X className="h-4 w-4" />
																					</button>
																				)}
																			</div>
																		))}
																	{user?.role !== "visitor" && (
																		<button
																			type="button"
																			onClick={() =>
																				handleAddOption(q.id, "row")
																			}
																			className="text-xxs font-bold text-[#B00000] hover:underline flex items-center gap-1"
																		>
																			<Plus className="h-3.5 w-3.5" />
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
																					className="flex-1 bg-white border border-slate-200 rounded-md py-1 px-2.5 text-xs text-[#1a1b21] focus:border-[#4A0000] outline-none"
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
																						<X className="h-4 w-4" />
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
																			className="text-xxs font-bold text-[#B00000] hover:underline flex items-center gap-1"
																		>
																			<Plus className="h-3.5 w-3.5" />
																			<span>Tambah Kolom</span>
																		</button>
																	)}
																</div>
															</div>
														</div>
													)}

													{/* Conditional Visibility Section */}
													{enableConditional && (
														<div className="space-y-2 pt-2 border-t border-slate-100">
														<span className="text-xs font-bold text-[#434652] uppercase block">
															Kondisi Tampilan (Conditional Visibility)
														</span>
														<div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4 border-l-2 border-slate-200">
															<div className="space-y-1">
																<label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
																	Tampilkan hanya jika (Pertanyaan Induk)
																</label>
																<select
																	value={
																		q.conditionalParentQuestionId
																			? String(q.conditionalParentQuestionId)
																			: ""
																	}
																	onChange={(e) => {
																		const val = e.target.value;
																		const parentId = val
																			? isNaN(Number(val))
																				? val
																				: Number(val)
																			: null;
																		handleQuestionFieldChange(
																			q.id,
																			"conditionalParentQuestionId",
																			parentId,
																		);
																		handleQuestionFieldChange(
																			q.id,
																			"conditionalParentOptionIds",
																			[],
																		);
																	}}
																	className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-xs text-[#1a1b21] focus:border-[#4A0000] outline-none cursor-pointer"
																	disabled={user?.role === "visitor"}
																>
																	<option value="">Selalu Tampilkan</option>
																	{questions
																		.filter(
																			(p) =>
																				p.type === "multiple_choice" &&
																				questions.indexOf(p) <
																					questions.indexOf(q),
																		)
																		.map((p) => (
																			<option key={p.id} value={String(p.id)}>
																				{p.title ||
																					`Pertanyaan #${questions.indexOf(p) + 1}`}
																			</option>
																		))}
																</select>
															</div>

															{q.conditionalParentQuestionId &&
																(() => {
																	const parentQ = questions.find(
																		(p) =>
																			String(p.id) ===
																			String(q.conditionalParentQuestionId),
																	);
																	if (!parentQ) return null;
																	const opts = parentQ.options || [];

																	return (
																		<div className="space-y-1">
																			<label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
																				Pilihan Jawaban Induk yang Memenuhi
																			</label>
																			<div className="flex flex-wrap gap-2 pt-1">
																				{opts.map((opt: any) => {
																					const selected = (
																						q.conditionalParentOptionIds || []
																					)
																						.map(String)
																						.includes(String(opt.id));
																					return (
																						<button
																							key={opt.id}
																							type="button"
																							onClick={() => {
																								if (user?.role === "visitor")
																									return;
																								let nextIds: (
																									| number
																									| string
																								)[] =
																									q.conditionalParentOptionIds ||
																									[];
																								if (selected) {
																									nextIds = nextIds.filter(
																										(id) =>
																											String(id) !==
																											String(opt.id),
																									);
																								} else {
																									nextIds = [
																										...nextIds,
																										opt.id,
																									];
																								}
																								handleQuestionFieldChange(
																									q.id,
																									"conditionalParentOptionIds",
																									nextIds,
																								);
																							}}
																							className={`px-2.5 py-1 text-xxs font-medium rounded-full border transition-all ${
																								selected
																									? "bg-[#B00000] text-white border-[#B00000]"
																									: "bg-white text-[#434652] border-slate-200 hover:bg-slate-50"
																							}`}
																							disabled={
																								user?.role === "visitor"
																							}
																						>
																							{opt.label}
																						</button>
																					);
																				})}
																				{opts.length === 0 && (
																					<span className="text-xxs text-amber-600 italic">
																						Pertanyaan induk belum memiliki
																						opsi. Tambahkan opsi di pertanyaan
																						induk terlebih dahulu.
																					</span>
																				)}
																			</div>
																		</div>
																	);
																})()}
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
																	<Trash2 className="h-4 w-4" />
																	Hapus
																</button>
																<div className="w-px h-5 bg-slate-200"></div>
																{(() => {
																	const sectionQuestions = questions
																		.filter(
																			(sq) => sq.sectionId === q.sectionId,
																		)
																		.sort((a, b) => a.order - b.order);
																	const isFirstInSection =
																		sectionQuestions[0]?.id === q.id;

																	return (
																		<button
																			type="button"
																			onClick={() =>
																				handleSplitSectionAtQuestion(q.id)
																			}
																			disabled={isFirstInSection}
																			className="hover:text-[#4A0000] flex items-center gap-1 text-xs font-semibold disabled:opacity-30 disabled:pointer-events-none"
																			title="Pindahkan pertanyaan ini & semua di bawahnya ke bagian baru"
																		>
																			<PanelsTopLeft className="h-4 w-4" />
																			Pisahkan ke Bagian Baru
																		</button>
																	);
																})()}
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
																className="rounded border-slate-300 text-[#4A0000] focus:ring-[#4A0000] h-4 w-4"
																disabled={user?.role === "visitor"}
															/>
														</label>

														{q.type === "short_text" && (
															<label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
																<span>Jawaban Unik (mis. NIM)</span>
																<input
																	type="checkbox"
																	checked={!!q.config?.uniqueAnswer}
																	onChange={(e) =>
																		handleQuestionFieldChange(q.id, "config", {
																			...(q.config || {}),
																			uniqueAnswer: e.target.checked,
																		})
																	}
																	className="rounded border-slate-300 text-[#4A0000] focus:ring-[#4A0000] h-4 w-4"
																	disabled={user?.role === "visitor"}
																/>
															</label>
														)}
													</div>
												</div>
											);
										})
									)}

									{/* Add button inside Section */}
									{user?.role !== "visitor" && (
										<div className="flex justify-center pt-2">
											<button
												type="button"
												onClick={() => handleAddQuestion(sec.id)}
												className="border border-[#747683] text-[#1a1b21] hover:bg-slate-50 text-xs font-bold py-2 px-6 rounded-lg flex items-center gap-1.5 transition-all shadow-sm"
											>
												<CirclePlus className="h-5 w-5" />
												<span>Tambah Pertanyaan di Bagian Ini</span>
											</button>
										</div>
									)}
								</div>
							</div>
						);
					})}

					{/* Tambah Bagian Baru */}
					{user?.role !== "visitor" && (
						<div className="flex justify-center">
							<button
								type="button"
								onClick={handleAddSection}
								className="border-2 border-dashed border-[#c4c6d4] text-[#434652] hover:border-[#4A0000] hover:text-[#4A0000] text-xs font-bold py-3 px-8 rounded-lg flex items-center gap-1.5 transition-all w-full justify-center"
							>
								<SquarePlus className="h-5 w-5" />
								<span>Tambah Bagian Baru</span>
							</button>
						</div>
					)}

					{/* Saving footer buttons */}
					{user?.role !== "visitor" && (
						<div className="flex justify-end pt-4 border-t border-slate-200">
							<button
								onClick={handleSaveQuestions}
								disabled={isSavingQuestions}
								className="bg-[#4A0000] text-white hover:bg-[#B00000] disabled:bg-slate-300 font-bold px-8 py-3 rounded-lg text-sm flex items-center gap-2 shadow-sm transition-all"
							>
								{isSavingQuestions
									? "Menyimpan Tata Letak..."
									: "Simpan Semua Pertanyaan"}
								<Save className="h-4 w-4" />
							</button>
						</div>
					)}
				</div>
			)}

			{/* ============================== RESPONSES TAB ============================== */}
			{tab === "responses" && (
				<div className="space-y-6">
					{/* Sub-tab Navigation */}
					<div className="pb-2">
						<Tabs value={subtab}>
							<TabsList
								variant="default"
								className="w-fit bg-slate-100 dark:bg-input/20 p-1 rounded-lg"
							>
								<TabsTrigger
									value="ringkasan"
									className="px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer"
									render={
										<Link
											to="/admin/surveys/$surveyId"
											params={{ surveyId: surveyId.toString() }}
											search={{ tab: "responses", subtab: "ringkasan" }}
										/>
									}
								>
									Ringkasan
								</TabsTrigger>
								<TabsTrigger
									value="pertanyaan"
									className="px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer"
									render={
										<Link
											to="/admin/surveys/$surveyId"
											params={{ surveyId: surveyId.toString() }}
											search={{ tab: "responses", subtab: "pertanyaan" }}
										/>
									}
								>
									Pertanyaan
								</TabsTrigger>
								<TabsTrigger
									value="individual"
									className="px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer"
									render={
										<Link
											to="/admin/surveys/$surveyId"
											params={{ surveyId: surveyId.toString() }}
											search={{ tab: "responses", subtab: "individual" }}
										/>
									}
								>
									Individual
								</TabsTrigger>
							</TabsList>
						</Tabs>
					</div>

					{/* CSV Filter bar — visible to non-visitors on the responses tab */}
					{user?.role !== "visitor" && (
						<div className="flex flex-wrap items-center gap-2 py-2">
							<span className="text-xs font-bold text-[#434652] whitespace-nowrap">
								Filter CSV:
							</span>
							<Select
								value={csvFilterQuestionId || ""}
								onValueChange={(val) => {
									setCsvFilterQuestionId(val || "");
									setCsvFilterOptionIds([]);
								}}
								items={selectItems}
							>
								<SelectTrigger
									size="sm"
									className="min-w-0 max-w-md bg-white border border-slate-200 text-xs text-[#1a1b21] cursor-pointer truncate"
									title={
										selectedFilterQuestion?.title ??
										"Semua Pertanyaan (Tanpa Filter)"
									}
								>
									<SelectValue placeholder="Semua Pertanyaan (Tanpa Filter)">
										{(value) => {
											if (!value) return "Semua Pertanyaan (Tanpa Filter)";
											const question = filterableQuestions.find(
												(q: any) => String(q.id) === String(value),
											);
											return question
												? question.title
												: "Semua Pertanyaan (Tanpa Filter)";
										}}
									</SelectValue>
								</SelectTrigger>
								<SelectContent
									alignItemWithTrigger={false}
									align="start"
									side="bottom"
									sideOffset={4}
									className="bg-white border border-slate-200 rounded-lg shadow-md max-h-60 overflow-y-auto z-50 text-xs text-[#1a1b21] p-1 min-w-[280px] max-w-md"
								>
									<SelectItem value="" title="Semua Pertanyaan (Tanpa Filter)">
										Semua Pertanyaan (Tanpa Filter)
									</SelectItem>
									{filterableQuestions.map((q: any) => (
										<SelectItem key={q.id} value={String(q.id)} title={q.title}>
											{q.title}
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							{selectedFilterQuestion && (
								<div className="flex flex-wrap items-center gap-1.5">
									{selectedFilterQuestion.options.map((o: any) => {
										const checked = csvFilterOptionIds.includes(String(o.id));
										return (
											<label
												key={o.id}
												className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs cursor-pointer select-none transition-colors ${
													checked
														? "bg-[#B00000] border-[#B00000] text-white font-semibold"
														: "bg-white border-slate-200 text-[#434652] hover:border-[#B00000] hover:text-[#B00000]"
												}`}
											>
												<input
													type={
														detail?.survey?.category === "layanan-pengaduan"
															? "radio"
															: "checkbox"
													}
													className="sr-only"
													checked={checked}
													onChange={() => {
														const sid = String(o.id);
														if (
															detail?.survey?.category === "layanan-pengaduan"
														) {
															setCsvFilterOptionIds([sid]);
														} else {
															setCsvFilterOptionIds((prev) =>
																prev.includes(sid)
																	? prev.filter((id) => id !== sid)
																	: [...prev, sid],
															);
														}
													}}
												/>
												{o.label}
											</label>
										);
									})}
								</div>
							)}

							{csvFilterQuestionId &&
								detail?.survey?.category !== "layanan-pengaduan" && (
									<button
										type="button"
										onClick={() => {
											setCsvFilterQuestionId("");
											setCsvFilterOptionIds([]);
										}}
										className="text-xs font-bold text-[#ba1a1a] hover:underline flex items-center gap-0.5 whitespace-nowrap cursor-pointer"
									>
										<X className="h-4 w-4" />
										<span>Reset</span>
									</button>
								)}

							{/* {activeStats?.subtitle && (
								<span className="text-xs text-[#434652] italic whitespace-nowrap">
									Cakupan: <strong>{activeStats.subtitle}</strong>
								</span>
							)} */}

							<div className="relative" ref={exportMenuRef}>
								<button
									type="button"
									onClick={() => setIsExportMenuOpen((v) => !v)}
									disabled={
										detail?.survey?.category === "layanan-pengaduan"
											? !csvFilterQuestionId || csvFilterOptionIds.length !== 1
											: !!csvFilterQuestionId && csvFilterOptionIds.length === 0
									}
									className="bg-[#B00000] text-white hover:bg-[#4A0000] disabled:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm active:scale-95 transition-transform cursor-pointer whitespace-nowrap"
								>
									<Download className="h-4 w-4" />
									<span>Ekspor</span>
									{isExportMenuOpen ? (
										<ChevronUp className="h-4 w-4" />
									) : (
										<ChevronDown className="h-4 w-4" />
									)}
								</button>

								{isExportMenuOpen && (
									<div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-10 overflow-hidden">
										<button
											type="button"
											onClick={() => {
												setIsExportMenuOpen(false);
												handleDownloadXLSX();
											}}
											className="w-full text-left px-3 py-2 text-xs font-semibold text-[#1a1b21] hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
										>
											<Table className="h-4 w-4" />
											<span>Ekspor sebagai Excel (.xlsx)</span>
										</button>
										<button
											type="button"
											onClick={() => {
												setIsExportMenuOpen(false);
												handleDownloadCSV();
											}}
											className="w-full text-left px-3 py-2 text-xs font-semibold text-[#1a1b21] hover:bg-slate-50 flex items-center gap-2 cursor-pointer border-t border-slate-100"
										>
											<FileText className="h-4 w-4" />
											<span>Ekspor sebagai CSV (.csv)</span>
										</button>
									</div>
								)}
							</div>
						</div>
					)}

					{/* Sub-tab Content: Ringkasan */}
					{subtab === "ringkasan" && activeStats && (
						<div
							className={`space-y-6 transition-opacity duration-200 relative ${isLoadingStats ? "opacity-50" : ""}`}
						>
							{isRefreshing && (
								<div className="absolute inset-0 bg-white/45 z-20 backdrop-blur-[1px] flex flex-col gap-6 p-4 rounded-xl">
									<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
										<Skeleton className="h-[96px] w-full rounded-xl lg:col-span-1" />
										{detail.survey.targetRespondentCount != null &&
											detail.survey.targetRespondentCount > 0 && (
												<Skeleton className="h-[96px] w-full rounded-xl lg:col-span-2" />
											)}
									</div>
									<Skeleton className="h-[320px] w-full rounded-xl" />
								</div>
							)}
							{/* Summary stats Bento */}
							<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
								<div className="bg-white rounded-xl p-6 border border-[#c4c6d4] shadow-sm flex items-center justify-between lg:col-span-1">
									<div>
										<span className="text-xs font-bold text-[#434652] uppercase tracking-wider block">
											Total Jawaban
										</span>
										<p
											className={`text-4xl font-bold text-[#4A0000] mt-1 ${pulseAnswers ? "live-updating" : ""}`}
										>
											{activeStats.responseCount ?? detail.responseCount}
										</p>
									</div>
									<div className="w-12 h-12 rounded-full bg-[#dbe1ff] flex items-center justify-center text-[#0f409e]">
										<Users className="h-8 w-8 block" />
									</div>
								</div>

								{detail.survey.targetRespondentCount != null &&
									detail.survey.targetRespondentCount > 0 &&
									(() => {
										const target = detail.survey.targetRespondentCount;
										const count =
											activeStats.responseCount ?? detail.responseCount;
										const pct = Math.min(
											100,
											Math.round((count / target) * 100),
										);
										const isGood = pct >= 80;
										const barColor =
											pct >= 85
												? "bg-emerald-600"
												: pct >= 80
													? "bg-amber-500"
													: "bg-[#B00000]";
										return (
											<div className="bg-white rounded-xl p-6 border border-[#c4c6d4] shadow-sm lg:col-span-2 flex flex-col justify-between">
												<div>
													<div className="flex items-center justify-between mb-2">
														<span className="text-xs font-bold text-[#434652] uppercase tracking-wider">
															Progress Pengisian Survei
														</span>
														<span className="text-sm font-bold text-[#1a1b21]">
															{count} / {target} ({pct}%)
														</span>
													</div>
													<div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
														<div
															className={`h-full rounded-full transition-all duration-700 ${barColor}`}
															style={{ width: `${pct}%` }}
														/>
													</div>
												</div>
												{isGood ? (
													<p className="text-xs font-semibold text-emerald-700 mt-3 flex items-center gap-1">
														<CircleCheck className="h-4 w-4" />
														Partisipasi sudah mencapai ambang baik (≥80%).
													</p>
												) : (
													<p className="text-xs font-semibold text-amber-700 mt-3 flex items-center gap-1">
														<AlertTriangle className="h-4 w-4" />
														Partisipasi masih di bawah ambang baik (80–85%).
														Perlu dorongan pengisian lebih lanjut.
													</p>
												)}
											</div>
										);
									})()}
							</div>

							{/* Visual Charts — dikelompokkan per Bagian, responsif 2 kolom di md+ */}
							{(() => {
								const sortedSections = [...(detail.sections || [])].sort(
									(a: any, b: any) => a.order - b.order,
								);
								const questionSectionMap = new Map(
									(detail.questions || []).map((q: any) => [q.id, q.sectionId]),
								);
								const visibleStats = activeStats.stats.filter(
									(s: any) => !s.redacted,
								);

								const groups = sortedSections
									.map((sec: any) => ({
										section: sec,
										stats: visibleStats.filter(
											(s: any) =>
												questionSectionMap.get(s.questionId) === sec.id,
										),
									}))
									.filter((g) => g.stats.length > 0);

								const ungroupedStats = visibleStats.filter(
									(s: any) => !questionSectionMap.has(s.questionId),
								);

								return (
									<div className="space-y-6">
										{ungroupedStats.map((stat: any) => (
											<ChartCard
												key={stat.questionId}
												stat={stat}
												responseCount={activeStats.responseCount}
												isExporting={isExporting}
											/>
										))}

										<div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
											{groups.map(({ section, stats }) => (
												<div
													key={section.id}
													className="bg-white rounded-xl border border-[#c4c6d4] shadow-sm overflow-hidden"
												>
													<div className="bg-[#eeedf6] px-5 py-3 border-b border-[#c4c6d4]">
														<h3 className="font-bold text-sm text-[#4A0000]">
															{section.title}
														</h3>
														{section.description && (
															<p className="text-xs text-[#747683] mt-0.5">
																{section.description}
															</p>
														)}
													</div>
													<div className="p-5 space-y-6">
														{stats.map((stat: any) => (
															<ChartCard
																key={stat.questionId}
																stat={stat}
																responseCount={activeStats.responseCount}
																isExporting={isExporting}
																noCard={true}
															/>
														))}
													</div>
												</div>
											))}
										</div>
									</div>
								);
							})()}
						</div>
					)}

					{/* Sub-tab Content: Pertanyaan */}
					{subtab === "pertanyaan" &&
						activeStats &&
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
							const selectedStat = activeStats.stats.find(
								(s: any) => s.questionId === activeQid,
							);

							return (
								<div
									className={`space-y-6 transition-opacity duration-200 ${isLoadingStats ? "opacity-50" : ""}`}
								>
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
											className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm text-[#1a1b21] focus:border-[#4A0000] outline-none cursor-pointer"
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
												responseCount={activeStats.responseCount}
												isExporting={isExporting}
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
														<Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#747683]" />
														<input
															type="text"
															placeholder="Cari jawaban teks..."
															value={textSearch}
															onChange={(e) => setTextSearch(e.target.value)}
															className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm placeholder-slate-400 focus:border-[#4A0000] outline-none transition-colors"
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
																<ul className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto custom-scrollbar">
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

											<button
												type="button"
												onClick={handlePrintResponse}
												className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[#434652] hover:text-[#4A0000] transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
												title="Cetak respon ini"
												disabled={isEditingResponse}
											>
												<Printer className="h-4 w-4 block" />
											</button>

											{user?.role === "admin" && (
												<button
													type="button"
													onClick={() => {
														const answersMap: Record<number, any> = {};
														for (const item of responseDetail.items) {
															answersMap[item.questionId] = {
																valueText: item.valueText,
																valueOptionIds: item.valueOptionIds || [],
																valueGrid: item.valueGrid || {},
															};
														}
														setEditAnswers(answersMap);
														setIsEditingResponse(true);
													}}
													className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
														isEditingResponse
															? "border-[#B00000] bg-[#dbe1ff] text-[#0f409e]"
															: "border-slate-200 bg-white hover:bg-slate-50 text-[#434652] hover:text-[#4A0000]"
													}`}
													title="Edit respon ini"
													disabled={isEditingResponse}
												>
													<Pencil className="h-4 w-4 block" />
												</button>
											)}

											{user?.role !== "visitor" && (
												<button
													type="button"
													onClick={() => setIsDeleteResponseDialogOpen(true)}
													className="p-1.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-[#ba1a1a] transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
													title="Hapus respon ini"
													disabled={isEditingResponse}
												>
													<Trash2 className="h-4 w-4 block" />
												</button>
											)}
										</div>

										{/* submitted time */}
										{responseDetail.submittedAt && (
											<span className="text-xs text-[#434652] font-semibold flex items-center gap-1">
												<Clock className="h-4 w-4" />
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
												disabled={page <= 1 || isEditingResponse}
												onClick={() => {
													router.navigate({
														search: (prev) => ({ ...prev, page: page - 1 }),
													});
												}}
												className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
											>
												<ChevronLeft className="h-4 w-4 block" />
											</button>

											<div className="flex items-center gap-1.5">
												<input
													type="number"
													min={1}
													max={responsesIndex.totalCount}
													value={page}
													disabled={isEditingResponse}
													onChange={(e) => {
														const val = Number(e.target.value);
														if (val >= 1 && val <= responsesIndex.totalCount) {
															router.navigate({
																search: (prev) => ({ ...prev, page: val }),
															});
														}
													}}
													className="w-12 text-center border border-slate-200 rounded py-1 text-xs font-mono disabled:opacity-50"
												/>
												<span className="text-xs text-slate-400">
													/ {responsesIndex.totalCount}
												</span>
											</div>

											<button
												type="button"
												disabled={
													page >= responsesIndex.totalCount || isEditingResponse
												}
												onClick={() => {
													router.navigate({
														search: (prev) => ({ ...prev, page: page + 1 }),
													});
												}}
												className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
											>
												<ChevronRight className="h-4 w-4 block" />
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
														</div>

														{/* Rendering input control */}
														{item.hidden ? (
															<div className="flex items-center gap-2.5 p-3.5 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-slate-500">
																<Lock className="h-5 w-5 text-slate-400 block" />
																<span className="text-xs font-semibold">
																	Informasi pribadi disembunyikan untuk peninjau
																</span>
															</div>
														) : (
															<div className="pt-1">
																{item.type === "short_text" && (
																	<input
																		type="text"
																		disabled={!isEditingResponse}
																		value={
																			isEditingResponse
																				? (editAnswers[item.questionId]
																						?.valueText ?? "")
																				: (item.valueText ?? "—")
																		}
																		onChange={(e) => {
																			setEditAnswers({
																				...editAnswers,
																				[item.questionId]: {
																					...editAnswers[item.questionId],
																					valueText: e.target.value,
																				},
																			});
																		}}
																		className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm text-[#1a1b21] disabled:opacity-70"
																	/>
																)}

																{item.type === "paragraph" && (
																	<textarea
																		disabled={!isEditingResponse}
																		rows={3}
																		value={
																			isEditingResponse
																				? (editAnswers[item.questionId]
																						?.valueText ?? "")
																				: (item.valueText ?? "—")
																		}
																		onChange={(e) => {
																			setEditAnswers({
																				...editAnswers,
																				[item.questionId]: {
																					...editAnswers[item.questionId],
																					valueText: e.target.value,
																				},
																			});
																		}}
																		className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm text-[#1a1b21] disabled:opacity-70"
																	/>
																)}

																{item.type === "date" && (
																	<input
																		type="date"
																		disabled={!isEditingResponse}
																		value={
																			isEditingResponse
																				? (editAnswers[item.questionId]
																						?.valueText ?? "")
																				: (item.valueText ?? "")
																		}
																		onChange={(e) => {
																			setEditAnswers({
																				...editAnswers,
																				[item.questionId]: {
																					...editAnswers[item.questionId],
																					valueText: e.target.value,
																				},
																			});
																		}}
																		className="bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm text-[#1a1b21] disabled:opacity-70 w-full sm:w-auto"
																	/>
																)}

																{(item.type === "multiple_choice" ||
																	item.type === "dropdown") && (
																	<div className="space-y-2">
																		{item.options.map((opt: any) => {
																			const isChecked = isEditingResponse
																				? editAnswers[
																						item.questionId
																					]?.valueOptionIds?.includes(opt.id)
																				: item.valueOptionIds?.includes(opt.id);
																			return (
																				<div
																					key={opt.id}
																					className="flex items-center gap-2"
																				>
																					<input
																						type="radio"
																						disabled={!isEditingResponse}
																						checked={isChecked}
																						onChange={() => {
																							setEditAnswers({
																								...editAnswers,
																								[item.questionId]: {
																									...editAnswers[
																										item.questionId
																									],
																									valueOptionIds: [opt.id],
																								},
																							});
																						}}
																						className="h-4 w-4 border-slate-300 text-[#4A0000] focus:ring-[#4A0000]"
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
																			const isChecked = isEditingResponse
																				? editAnswers[
																						item.questionId
																					]?.valueOptionIds?.includes(opt.id)
																				: item.valueOptionIds?.includes(opt.id);
																			return (
																				<div
																					key={opt.id}
																					className="flex items-center gap-2"
																				>
																					<input
																						type="checkbox"
																						disabled={!isEditingResponse}
																						checked={isChecked}
																						onChange={(e) => {
																							const currentOptIds =
																								editAnswers[item.questionId]
																									?.valueOptionIds || [];
																							let nextOptIds: number[];
																							if (e.target.checked) {
																								nextOptIds = [
																									...currentOptIds,
																									opt.id,
																								];
																							} else {
																								nextOptIds =
																									currentOptIds.filter(
																										(id: number) =>
																											id !== opt.id,
																									);
																							}
																							setEditAnswers({
																								...editAnswers,
																								[item.questionId]: {
																									...editAnswers[
																										item.questionId
																									],
																									valueOptionIds: nextOptIds,
																								},
																							});
																						}}
																						className="h-4 w-4 rounded border-slate-300 text-[#4A0000] focus:ring-[#4A0000]"
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
																			const isChecked = isEditingResponse
																				? editAnswers[
																						item.questionId
																					]?.valueOptionIds?.includes(opt.id)
																				: item.valueOptionIds?.includes(opt.id);
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
																						disabled={!isEditingResponse}
																						checked={isChecked}
																						onChange={() => {
																							setEditAnswers({
																								...editAnswers,
																								[item.questionId]: {
																									...editAnswers[
																										item.questionId
																									],
																									valueOptionIds: [opt.id],
																								},
																							});
																						}}
																						className="h-4 w-4 border-slate-300 text-[#4A0000]"
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
																			<div className="border border-slate-200 rounded-lg overflow-x-auto bg-slate-50/50 custom-scrollbar">
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
																										isEditingResponse
																											? editAnswers[
																													item.questionId
																												]?.valueGrid?.[
																													String(r.id)
																												] === c.id
																											: item.valueGrid?.[
																													String(r.id)
																												] === c.id;
																									return (
																										<td
																											key={c.id}
																											className="py-3 px-3 text-center"
																										>
																											<input
																												type="radio"
																												disabled={
																													!isEditingResponse
																												}
																												checked={isChecked}
																												onChange={() => {
																													const currentGrid =
																														editAnswers[
																															item.questionId
																														]?.valueGrid || {};
																													setEditAnswers({
																														...editAnswers,
																														[item.questionId]: {
																															...editAnswers[
																																item.questionId
																															],
																															valueGrid: {
																																...currentGrid,
																																[String(r.id)]:
																																	c.id,
																															},
																														},
																													});
																												}}
																												className="h-3.5 w-3.5 border-slate-300 text-[#4A0000]"
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

									{isEditingResponse && (
										<div className="flex justify-end gap-3 sticky bottom-4 z-10 bg-slate-50/90 p-4 border border-slate-200 rounded-xl shadow-md">
											<button
												type="button"
												onClick={() => setIsEditingResponse(false)}
												className="bg-white border border-slate-200 text-[#434652] font-bold px-5 py-2.5 rounded-lg text-sm cursor-pointer hover:bg-slate-50 transition-colors"
												disabled={isSavingResponse}
											>
												Batal
											</button>
											<button
												type="button"
												onClick={async () => {
													setIsSavingResponse(true);
													try {
														await updateAdminSurveyResponseFn({
															data: {
																surveyId,
																responseId: responseDetail.responseId,
																answers: Object.entries(editAnswers).map(
																	([qId, v]: any) => ({
																		questionId: Number(qId),
																		valueText: v.valueText ?? null,
																		valueOptionIds:
																			v.valueOptionIds &&
																			v.valueOptionIds.length > 0
																				? v.valueOptionIds
																				: null,
																		valueGrid:
																			v.valueGrid &&
																			Object.keys(v.valueGrid).length > 0
																				? v.valueGrid
																				: null,
																	}),
																),
															},
														});
														toast.success(
															"Perubahan respon berhasil disimpan.",
														);
														setIsEditingResponse(false);
														await router.invalidate();
													} catch (err: any) {
														toast.error(
															err.message ||
																"Gagal menyimpan perubahan respon.",
														);
													} finally {
														setIsSavingResponse(false);
													}
												}}
												className="bg-[#4A0000] text-white font-bold px-5 py-2.5 rounded-lg text-sm shadow-sm cursor-pointer hover:bg-[#B00000] transition-colors"
												disabled={isSavingResponse}
											>
												{isSavingResponse ? "Menyimpan..." : "Simpan Perubahan"}
											</button>
										</div>
									)}

									{/* Print-only region for window.print() */}
									<div className="print-only hidden p-8 max-w-4xl mx-auto space-y-6 bg-white text-[#1a1b21]">
										{/* Header/letterhead */}
										<div className="flex items-center justify-between border-b-2 border-[#4A0000] pb-4">
											<div className="flex items-center gap-4">
												<img
													src="/logo.webp"
													alt="Logo"
													className="h-16 w-auto object-contain"
												/>
												<div className="text-left">
													<h1 className="text-xl font-extrabold text-[#4A0000] uppercase tracking-wide">
														TRACER STUDY FKG UH
													</h1>
													<p className="text-xs text-[#747683] font-medium">
														Fakultas Kedokteran Gigi Universitas Hasanuddin
													</p>
												</div>
											</div>
											<div className="text-right">
												<h2 className="text-sm font-bold text-[#1a1b21] uppercase">
													Detail Respon Individual
												</h2>
												<p className="text-xxs text-[#747683] mt-0.5">
													Kuesioner Tracer Study
												</p>
											</div>
										</div>

										{/* Survey Title & Metadata */}
										<div className="bg-slate-50 border border-slate-200 rounded-lg p-4 grid grid-cols-2 gap-4 text-xs">
											<div className="space-y-1">
												<div className="text-[#747683] font-semibold uppercase tracking-wider text-[10px]">
													Nama Kuesioner
												</div>
												<div className="font-bold text-sm text-[#1a1b21]">
													{detail.survey.title}
												</div>
											</div>
											<div className="grid grid-cols-2 gap-2">
												<div className="space-y-0.5">
													<div className="text-[#747683] font-semibold uppercase tracking-wider text-[10px]">
														Nomor Respon
													</div>
													<div className="font-bold text-[#1a1b21]">
														Respon #{page} dari {responsesIndex.totalCount}
													</div>
												</div>
												<div className="space-y-0.5">
													<div className="text-[#747683] font-semibold uppercase tracking-wider text-[10px]">
														Waktu Pengiriman
													</div>
													<div className="font-medium text-[#1a1b21]">
														{responseDetail.submittedAt
															? new Date(
																	responseDetail.submittedAt,
																).toLocaleString("id-ID", {
																	dateStyle: "medium",
																	timeStyle: "short",
																})
															: "-"}
													</div>
												</div>
											</div>
										</div>

										{/* Print metadata */}
										<div className="flex justify-end items-center text-[10px] text-[#747683] border-b border-slate-100 pb-2">
											<span>
												Dicetak pada:{" "}
												{new Date().toLocaleString("id-ID", {
													dateStyle: "long",
													timeStyle: "medium",
												})}
											</span>
										</div>

										{/* Questions and Answers */}
										<div className="space-y-6 pt-2">
											{responseDetail.items.map((item: any, idx: number) => {
												return (
													<div
														key={item.questionId}
														className="page-break-inside-avoid space-y-1.5 border-b border-slate-100 pb-4 last:border-0"
													>
														<div className="flex justify-between items-start gap-4">
															<h3 className="font-bold text-xs text-[#1a1b21]">
																{idx + 1}. {item.title}
															</h3>
														</div>
														{item.description && (
															<p className="text-[10px] text-[#747683] italic">
																{item.description}
															</p>
														)}
														<div className="pl-4 pt-1">
															{item.hidden ? (
																<div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-dashed border-slate-200 rounded text-[#ba1a1a] text-xs font-semibold">
																	<Lock className="h-3.5 w-3.5 block" />
																	<span>
																		Informasi pribadi disembunyikan untuk
																		peninjau
																	</span>
																</div>
															) : item.type === "grid" ? (
																<div className="space-y-1 border-l border-slate-200 pl-3">
																	{(() => {
																		const rows = item.options.filter(
																			(o: any) => o.group === "row",
																		);
																		const cols = item.options.filter(
																			(o: any) => o.group === "column",
																		);
																		return rows.map((r: any) => {
																			const selectedColId =
																				item.valueGrid?.[String(r.id)];
																			const selectedCol = cols.find(
																				(c: any) => c.id === selectedColId,
																			);
																			return (
																				<div
																					key={r.id}
																					className="text-xs text-[#1a1b21] flex items-center"
																				>
																					<span className="font-semibold min-w-32">
																						{r.label}
																					</span>
																					<span className="text-[#747683] mx-2">
																						&rarr;
																					</span>
																					<span className="font-medium text-slate-800">
																						{selectedCol
																							? selectedCol.label
																							: "-"}
																					</span>
																				</div>
																			);
																		});
																	})()}
																</div>
															) : (
																<p className="text-xs text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">
																	{formatAnswerForPrint(item)}
																</p>
															)}
														</div>
													</div>
												);
											})}
										</div>

										{/* Footer */}
										<div className="border-t border-slate-200 pt-4 flex justify-between items-center text-[10px] text-[#747683] font-medium">
											<span>{detail.survey.title}</span>
											<span>Respon #{page}</span>
										</div>
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
								className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-sm text-[#1a1b21] focus:border-[#4A0000] focus:ring-1 focus:ring-[#4A0000] focus:bg-white outline-none transition-colors"
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
										className="w-full bg-slate-50 border border-slate-200 rounded-r-lg py-2.5 px-4 text-sm text-[#1a1b21] focus:border-[#4A0000] focus:ring-1 focus:ring-[#4A0000] focus:bg-white outline-none transition-colors"
										required
										disabled={isSavingSettings || user?.role === "visitor"}
									/>
								</div>
								<button
									type="button"
									onClick={handleCopyLink}
									className="flex-shrink-0 bg-white border border-slate-200 hover:bg-slate-50 text-[#434652] hover:text-[#B00000] rounded-lg p-2.5 transition-colors flex items-center justify-center shadow-sm"
									title="Salin Link Survey"
								>
									{isCopied ? (
										<Check className="h-5 w-5 text-emerald-600" />
									) : (
										<Copy className="h-5 w-5" />
									)}
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
									className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 pr-10 text-sm text-[#1a1b21] focus:border-[#4A0000] focus:ring-1 focus:ring-[#4A0000] focus:bg-white outline-none transition-colors appearance-none cursor-pointer"
									disabled={isSavingSettings || user?.role === "visitor"}
								>
									{categories.map((cat) => (
										<option key={cat.slug} value={cat.slug}>
											{cat.name}
										</option>
									))}
								</select>
								<ChevronDown className="h-5 w-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
							</div>
						</div>

						<div className="flex flex-col gap-1.5">
							<label className="text-sm font-bold text-[#1a1b21]">
								Periode Survei {requirePeriod ? "(Wajib Diisi)" : "(Opsional)"}
							</label>
							<div className="flex justify-between items-center w-full max-w-sm">
								<div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 w-fit">
									<button
										type="button"
										onClick={() => {
											setSettingsPeriodType("month");
											setSettingsPeriodValue("");
											setSettingsPeriodValueEnd("");
										}}
										className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${settingsPeriodType === "month" ? "bg-white shadow-sm text-[#4A0000]" : "text-[#747683]"}`}
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
										className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${settingsPeriodType === "date" ? "bg-white shadow-sm text-[#4A0000]" : "text-[#747683]"}`}
										disabled={isSavingSettings || user?.role === "visitor"}
									>
										Tanggal Spesifik
									</button>
								</div>
								{(settingsPeriodValue || settingsPeriodValueEnd) && (
									<button
										type="button"
										onClick={() => {
											setSettingsPeriodValue("");
											setSettingsPeriodValueEnd("");
										}}
										className="text-xs font-bold text-[#ba1a1a] hover:underline cursor-pointer flex items-center gap-1"
										disabled={isSavingSettings || user?.role === "visitor"}
									>
										Hapus Periode
									</button>
								)}
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
										className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-sm text-[#1a1b21] focus:border-[#4A0000] focus:ring-1 focus:ring-[#4A0000] focus:bg-white outline-none transition-colors"
										required={requirePeriod}
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
										className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-sm text-[#1a1b21] focus:border-[#4A0000] focus:ring-1 focus:ring-[#4A0000] focus:bg-white outline-none transition-colors"
										required={requirePeriod}
										disabled={isSavingSettings || user?.role === "visitor"}
									/>
								</div>
							</div>
						</div>

						{/* Target Responden */}
						<div className="flex flex-col gap-1.5">
							<label className="text-sm font-bold text-[#1a1b21]">
								Target Jumlah Responden (Opsional)
							</label>
							<input
								type="number"
								min={0}
								value={settingsTargetRespondentCount ?? ""}
								onChange={(e) =>
									setSettingsTargetRespondentCount(
										e.target.value === "" ? null : Number(e.target.value),
									)
								}
								className="w-full sm:w-56 bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-sm text-[#1a1b21] focus:border-[#4A0000] outline-none"
								placeholder="mis. 150"
								disabled={isSavingSettings || user?.role === "visitor"}
							/>
							<p className="text-xxs text-[#747683] italic">
								Dipakai untuk menghitung progress pengisian kuesioner. Kosongkan
								jika tidak ingin melacak target.
							</p>
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
									className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 pr-10 text-sm text-[#1a1b21] focus:border-[#4A0000] focus:ring-1 focus:ring-[#4A0000] focus:bg-white outline-none transition-colors appearance-none cursor-pointer"
									disabled={isSavingSettings || user?.role === "visitor"}
								>
									<option value="draft">Draft (Hanya Admin)</option>
									<option value="published">
										Dipublikasikan (Publik dapat mengisi)
									</option>
									<option value="archived">Diarsipkan (Koleksi ditutup)</option>
								</select>
								<ChevronDown className="h-5 w-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
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
									className="px-4 py-2 bg-[#dbe1ff] text-[#B00000] hover:bg-[#4A0000] hover:text-white font-semibold rounded-lg text-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
								>
									<Upload className="h-4 w-4" />
									Pilih Gambar Banner
								</button>
								{settingsBannerUrl && (
									<span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
										<CircleCheck className="h-4 w-4" />
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
											<Trash2 className="h-4 w-4 block" />
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
								className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-sm text-[#1a1b21] focus:border-[#4A0000] focus:ring-1 focus:ring-[#4A0000] focus:bg-white outline-none transition-colors"
								disabled={isSavingSettings || user?.role === "visitor"}
							/>
						</div>

						<div className="flex flex-col gap-1.5">
							<label className="text-sm font-bold text-[#1a1b21]">
								Integrasi Data
							</label>
							<p className="text-xxs text-[#747683] italic">
								Isi otomatis field seperti Nama dan Angkatan berdasarkan NIM
								yang diketik responden.
							</p>
							<button
								type="button"
								onClick={handleOpenSiakadDialog}
								disabled={user?.role === "visitor"}
								className="w-fit bg-white border border-slate-200 text-[#434652] hover:bg-slate-50 hover:text-[#B00000] font-semibold px-4 py-2 rounded-lg text-xs shadow-sm transition-colors"
							>
								Konfigurasi
							</button>
						</div>

						<div className="h-px bg-slate-100 my-4"></div>
						{user?.role !== "visitor" && (
							<div className="flex justify-between items-center">
								<button
									type="button"
									onClick={() => setIsDuplicateDialogOpen(true)}
									disabled={isSavingSettings || isDuplicating}
									className="bg-white border border-slate-200 text-[#434652] hover:bg-slate-50 hover:text-[#B00000] font-semibold px-6 py-2.5 rounded-lg text-sm shadow-sm transition-colors flex items-center gap-2"
								>
									<Copy className="h-4 w-4" />
									Duplikat Survei
								</button>
								<button
									type="submit"
									disabled={isSavingSettings || isDuplicating}
									className="bg-[#4A0000] text-white hover:bg-[#B00000] font-semibold px-6 py-2.5 rounded-lg text-sm shadow-sm transition-colors"
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

			<ConfirmDialog
				isOpen={isDeleteResponseDialogOpen}
				title="Hapus Respon"
				message={`Apakah Anda yakin ingin menghapus Respon #${page}? Tindakan ini tidak dapat dibatalkan.`}
				confirmText={isDeletingResponse ? "Menghapus..." : "Ya, Hapus"}
				cancelText="Batal"
				onConfirm={handleConfirmDeleteResponse}
				onCancel={() => setIsDeleteResponseDialogOpen(false)}
				variant="danger"
			/>

			<Dialog
				isOpen={isSiakadDialogOpen}
				onClose={() => setIsSiakadDialogOpen(false)}
				title="Auto-Isi dari Data"
			>
				<div className="space-y-4">
					<label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
						<input
							type="checkbox"
							checked={siakadEnabled}
							onChange={(e) => setSiakadEnabled(e.target.checked)}
							className="rounded text-[#4A0000] focus:ring-[#4A0000]"
						/>
						Aktifkan auto-isi dari Database Mahasiswa untuk survei ini
					</label>

					<div>
						<label className="text-xs font-bold block mb-1 text-[#1a1b21]">
							Pertanyaan mana yang merupakan NIM?
						</label>
						<select
							value={siakadNimQuestionId ?? ""}
							onChange={(e) =>
								setSiakadNimQuestionId(
									e.target.value ? Number(e.target.value) : null,
								)
							}
							className="w-full border border-slate-200 rounded-lg py-2 px-3 text-sm text-[#1a1b21] bg-white focus:outline-none focus:border-[#4A0000]"
						>
							<option value="">-- Pilih pertanyaan --</option>
							{siakadCandidates.map((q) => (
								<option key={q.id} value={q.id}>
									{q.title}
								</option>
							))}
						</select>
					</div>

					<div>
						<label className="text-xs font-bold block mb-2 text-[#1a1b21]">
							Pertanyaan yang otomatis diisi dari data mahasiswa
						</label>
						<div className="space-y-2 max-h-60 overflow-y-auto pr-1">
							{siakadCandidates
								.filter((q) => q.id !== siakadNimQuestionId)
								.map((q) => {
									const current =
										siakadMappings.find((m) => m.questionId === q.id)?.field ??
										"";
									return (
										<div
											key={q.id}
											className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100"
										>
											<span className="text-xs flex-1 truncate font-medium text-[#1a1b21]">
												{q.title}
											</span>
											<select
												value={current}
												onChange={(e) => {
													const field = e.target.value;
													setSiakadMappings((prev) => {
														const rest = prev.filter(
															(m) => m.questionId !== q.id,
														);
														return field
															? [...rest, { questionId: q.id, field }]
															: rest;
													});
												}}
												className="border border-slate-200 rounded-lg py-1.5 px-2 text-xs bg-white text-[#1a1b21] focus:outline-none focus:border-[#4A0000]"
											>
												<option value="">Tidak digunakan</option>
												<option value="nama">Nama</option>
												<option value="angkatan">Angkatan / Tahun Masuk</option>
												<option value="kelas">Kelas</option>
												<option value="jenis_kelamin">Jenis Kelamin</option>
											</select>
										</div>
									);
								})}
						</div>
					</div>

					<div className="flex justify-end pt-2">
						<button
							type="button"
							onClick={handleSaveSiakadConfig}
							disabled={isSavingSiakad}
							className="bg-[#4A0000] text-white hover:bg-[#B00000] font-semibold px-5 py-2 rounded-lg text-xs shadow-sm transition-colors"
						>
							{isSavingSiakad ? "Menyimpan..." : "Simpan Konfigurasi"}
						</button>
					</div>
				</div>
			</Dialog>

			<ConfirmDialog
				isOpen={deleteSectionId !== null}
				title="Hapus Bagian"
				message="Bagian ini akan dihapus. Pertanyaan di dalamnya akan dipindahkan ke bagian sebelumnya. Lanjutkan?"
				confirmText="Ya, Hapus"
				cancelText="Batal"
				onConfirm={() => {
					if (deleteSectionId !== null) {
						handleDeleteSection(deleteSectionId);
						setDeleteSectionId(null);
					}
				}}
				onCancel={() => setDeleteSectionId(null)}
				variant="danger"
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

const formatAnswerForPrint = (item: any) => {
	if (item.hidden) {
		return "Informasi pribadi disembunyikan untuk peninjau";
	}
	switch (item.type) {
		case "short_text":
		case "paragraph":
		case "date":
			return item.valueText && item.valueText.trim() !== ""
				? item.valueText
				: "-";
		case "multiple_choice":
		case "dropdown": {
			const selectedOption = item.options.find((opt: any) =>
				item.valueOptionIds?.includes(opt.id),
			);
			return selectedOption ? selectedOption.label : "-";
		}
		case "checkboxes": {
			const selectedLabels = item.options
				.filter((opt: any) => item.valueOptionIds?.includes(opt.id))
				.map((opt: any) => opt.label);
			return selectedLabels.length > 0 ? selectedLabels.join(", ") : "-";
		}
		case "linear_scale": {
			const selectedOption = item.options.find((opt: any) =>
				item.valueOptionIds?.includes(opt.id),
			);
			return selectedOption ? selectedOption.label : "-";
		}
		default:
			return "-";
	}
};

const safeKey = (str: string | null | undefined) => {
	if (typeof str !== "string") return "";
	return str.replace(/[^a-zA-Z0-9]/g, "_");
};

const pickChartKind = (stat: any) => {
	const type = stat.type;
	const count = stat.optionCount || 0;

	if (
		stat.title?.toLowerCase().includes("tahun masuk") ||
		stat.title?.toLowerCase().includes("angkatan")
	) {
		return "bar-vertical";
	}
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
	isExporting = false,
	noCard = false,
}: {
	stat: any;
	responseCount: number;
	isExporting?: boolean;
	noCard?: boolean;
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
			toast.success("Grafik disalin ke clipboard.");
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
	const primaryColor = "#4A0000";
	const primaryPalette = [
		"#4A0000", // Brand primary deep maroon
		"#701B1B", // Muted crimson
		"#9E3838", // Soft terracotta/brick red
		"#C25E5E", // Muted coral rose
		"#DB8484", // Soft dusty rose
		"#E8A7A7", // Pastel rose peach
		"#8A8D9F", // Desaturated slate lavender
		"#C4C6D4", // Light slate gray
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
			className={
				noCard
					? "overflow-hidden flex flex-col"
					: "bg-white rounded-xl border border-[#c4c6d4] shadow-sm overflow-hidden"
			}
		>
			<div
				className={
					noCard
						? "py-3 px-1 border-b border-slate-100 flex justify-between items-center bg-transparent"
						: "py-4 px-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center"
				}
			>
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
						className="p-1.5 rounded-lg border border-slate-200 text-[#434652] hover:bg-slate-50 hover:text-[#B00000] transition-colors cursor-pointer"
					>
						{copyState === "copied" ? (
							<Check className="h-4 w-4 block" />
						) : copyState === "downloaded" ? (
							<Download className="h-4 w-4 block" />
						) : (
							<Copy className="h-4 w-4 block" />
						)}
					</button>
				)}
			</div>

			<div className={noCard ? "py-4 px-1" : "p-6"}>
				{stat.redacted ? (
					<div className="flex flex-col items-center justify-center p-8 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-slate-500">
						<Lock className="h-9 w-9 mb-2 text-slate-400" />
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
									<ul className="space-y-2 text-sm max-h-60 overflow-y-auto text-left custom-scrollbar">
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
								const total = pieData.reduce(
									(acc: number, item: any) => acc + (item.count || 0),
									0,
								);

								return (
									<div className="flex flex-col items-center gap-4">
										<ChartContainer
											config={chartConfig}
											className="aspect-square max-h-[280px] w-full"
										>
											<PieChart>
												<ChartTooltip
													content={
														<ChartTooltipContent
															nameKey="label"
															hideLabel
															formatter={(value, name, item) => {
																const percent =
																	total > 0
																		? ((Number(value) / total) * 100).toFixed(
																				1,
																			) + "%"
																		: "0%";
																const indicatorColor =
																	item.payload?.fill || item.color;
																return (
																	<>
																		<div
																			className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
																			style={{
																				backgroundColor: indicatorColor,
																				borderColor: indicatorColor,
																			}}
																		/>
																		<div className="flex flex-1 justify-between items-center leading-none">
																			<span className="text-muted-foreground">
																				{name}
																			</span>
																			<span className="font-mono font-medium text-foreground tabular-nums ml-4">
																				{value} dari {total} ({percent})
																			</span>
																		</div>
																	</>
																);
															}}
														/>
													}
												/>
												<Pie
													isAnimationActive={false}
													data={pieData}
													dataKey="count"
													nameKey="label"
													labelLine={false}
													label={({ payload, ...props }: any) => {
														const percent =
															total > 0
																? ((payload.count / total) * 100).toFixed(1) +
																	"%"
																: "0%";
														return (
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
																{percent}
															</text>
														);
													}}
												/>
											</PieChart>
										</ChartContainer>

										{/* Legend rendered outside SVG so it is never clipped by the fixed-height viewport */}
										<div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 w-full px-2">
											{pieData.map((item: any, idx: number) => (
												<div
													key={idx}
													className="flex items-center gap-1.5 min-w-0"
													data-legend-item=""
													data-legend-label={item.label}
													data-legend-color={item.fill}
												>
													<span
														className="shrink-0 inline-block w-2.5 h-2.5 rounded-sm"
														style={{ backgroundColor: item.fill }}
													/>
													<span className="text-xs text-[#434652]">
														{item.label}
													</span>
												</div>
											))}
										</div>
									</div>
								);
							})()}

						{chartKind === "bar-vertical" &&
							(() => {
								const total =
									stat.data?.reduce(
										(acc: number, item: any) => acc + (item.count || 0),
										0,
									) || 0;
								const isTahunMasuk = stat.title
									?.toLowerCase()
									.includes("tahun masuk");

								return (
									<ChartContainer
										config={chartConfig}
										className="min-h-[300px] w-full"
									>
										<BarChart
											data={stat.data}
											margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
										>
											<CartesianGrid vertical={false} strokeDasharray="3 3" />
											<XAxis
												dataKey="label"
												tickLine={false}
												axisLine={false}
											/>
											<YAxis tickLine={false} axisLine={false} />
											<ChartTooltip
												content={
													<ChartTooltipContent
														formatter={
															isTahunMasuk
																? (value, name, item) => {
																		const percent =
																			total > 0
																				? (
																						(Number(value) / total) *
																						100
																					).toFixed(1) + "%"
																				: "0%";
																		const indicatorColor =
																			item.payload?.fill ||
																			item.color ||
																			primaryColor;
																		return (
																			<>
																				<div
																					className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
																					style={{
																						backgroundColor: indicatorColor,
																						borderColor: indicatorColor,
																					}}
																				/>
																				<div className="flex flex-1 justify-between items-center leading-none">
																					<span className="text-muted-foreground">
																						{name}
																					</span>
																					<span className="font-mono font-medium text-foreground tabular-nums ml-4">
																						{value} ({percent})
																					</span>
																				</div>
																			</>
																		);
																	}
																: undefined
														}
													/>
												}
											/>
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
													formatter={
														isTahunMasuk
															? (value: any) => {
																	return total > 0
																		? ((Number(value) / total) * 100).toFixed(
																				1,
																			) + "%"
																		: "0%";
																}
															: undefined
													}
												/>
											</Bar>
										</BarChart>
									</ChartContainer>
								);
							})()}

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
								const rowHeight = 52; // px per category — enough for 2-3 lines wrapped label
								const computedHeight = Math.max(
									300,
									stat.data.length * rowHeight,
								);
								const cappedHeight = isExporting
									? computedHeight
									: Math.min(computedHeight, 1200);
								const needsScroll =
									computedHeight > cappedHeight && !isExporting;
								const yAxisWidth = 140;

								const renderYAxisTick = ({ x, y, payload }: any) => {
									const text: string = payload.value || "";
									const words = text.split(" ");
									const lines: string[] = [];
									let currentLine = "";
									for (const word of words) {
										if ((currentLine + " " + word).trim().length > 20) {
											if (currentLine) lines.push(currentLine);
											currentLine = word;
										} else {
											currentLine = (currentLine + " " + word).trim();
										}
									}
									if (currentLine) lines.push(currentLine);

									return (
										<text
											x={x - 8}
											y={y}
											textAnchor="end"
											fill="#434652"
											fontSize={10}
											fontFamily="Outfit, sans-serif"
										>
											{lines.map((line, idx) => (
												<tspan
													key={idx}
													x={x - 8}
													dy={idx === 0 ? -((lines.length - 1) * 6) + 3 : 12}
												>
													{line}
												</tspan>
											))}
										</text>
									);
								};

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
												tick={renderYAxisTick}
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
									<div className="max-h-[600px] overflow-y-auto custom-scrollbar">
										{chart}
									</div>
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
