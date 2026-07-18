import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Select } from "../../components/ui/Select";
import { toast } from "../../components/ui/useToast";
import {
	deleteAdminSurveyFn,
	getAdminSurveysListFn,
} from "../../server/adminSurveyFunctions";
import { ChartBar, Calendar, Users, Clock, Eye, Pencil, Trash2, Plus, Search, X } from "lucide-react";

export const Route = createFileRoute("/admin/surveys/")({
	loader: async () => {
		return await getAdminSurveysListFn();
	},
	component: SurveysIndexComponent,
});

function LiveFillingBadge({ count }: { count: number }) {
	if (count <= 0) return null;
	return (
		<span className="inline-flex items-center gap-1.5 bg-[#B00000]/10 text-[#4A0000] text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-[#B00000]/10 shadow-sm">
			<span className="relative flex h-1.5 w-1.5">
				<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#B00000] opacity-75" />
				<span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#B00000]" />
			</span>
			{count} mengisi
		</span>
	);
}

function SurveysIndexComponent() {
	const surveys = Route.useLoaderData();
	const router = useRouter();
	const { user } = Route.useRouteContext();

	const [liveCounts, setLiveCounts] = useState<Record<number, number>>({});

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

	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");
	const [periodFilterMode, setPeriodFilterMode] = useState<"month" | "date">(
		"month",
	);
	const [periodFilterValue, setPeriodFilterValue] = useState("");

	const filteredSurveys = surveys.filter((s) => {
		const matchesSearch = s.title
			.toLowerCase()
			.includes(searchQuery.toLowerCase());
		const matchesStatus = statusFilter === "all" || s.status === statusFilter;

		const matchesPeriod = (() => {
			if (!periodFilterValue) return true; // no filter set
			if (!s.periodValue) return false;

			const startVal = s.periodValue;
			const endVal = (s as any).periodValueEnd || s.periodValue;

			if (periodFilterMode === "month") {
				const sStartMonth =
					s.periodType === "date" ? startVal.slice(0, 7) : startVal;
				const sEndMonth = s.periodType === "date" ? endVal.slice(0, 7) : endVal;
				return (
					periodFilterValue >= sStartMonth && periodFilterValue <= sEndMonth
				);
			}

			if (s.periodType === "date") {
				return periodFilterValue >= startVal && periodFilterValue <= endVal;
			} else {
				const targetMonth = periodFilterValue.slice(0, 7);
				return targetMonth >= startVal && targetMonth <= endVal;
			}
		})();

		return matchesSearch && matchesStatus && matchesPeriod;
	});

	const [confirmDialog, setConfirmDialog] = useState<{
		isOpen: boolean;
		id: number;
		title: string;
	}>({
		isOpen: false,
		id: 0,
		title: "",
	});

	const handleDeleteClick = (id: number, title: string) => {
		setConfirmDialog({ isOpen: true, id, title });
	};

	const handleConfirmDelete = async () => {
		const { id } = confirmDialog;
		setConfirmDialog({ isOpen: false, id: 0, title: "" });
		try {
			const res = await deleteAdminSurveyFn({ data: id });
			if (res.success) {
				toast.success(res.message || "Survei berhasil dihapus.");
				await router.invalidate();
			}
		} catch (err: any) {
			toast.error(err.message || "Gagal menghapus survei.");
		}
	};

	const getStatusBadge = (status: string) => {
		switch (status) {
			case "published":
				return (
					<span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200">
						<span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
						Dipublikasikan
					</span>
				);
			case "draft":
				return (
					<span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-850 text-xs font-semibold border border-amber-200">
						<span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
						Draft
					</span>
				);
			case "archived":
				return (
					<span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-xs font-semibold border border-rose-200">
						<span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
						Diarsipkan
					</span>
				);
			default:
				return null;
		}
	};

	const renderSurveyCards = (
		list: typeof surveys,
		headerTitle: string,
		icon: string,
	) => {
		return (
			<section className="space-y-4">
				{list.length === 0 ? (
					<div className="bg-white border border-[#c4c6d4] rounded-xl shadow-sm overflow-hidden p-8 text-center text-slate-400 text-sm">
						Tidak ada survei yang cocok dengan pencarian Anda.
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
						{list.map((s) => (
							<div
								key={s.id}
								className="bg-white border border-[#c4c6d4] rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col"
							>
								{/* Area banner */}
								<div className="relative h-36 w-full bg-slate-100 flex items-center justify-center shrink-0">
									{s.bannerUrl ? (
										<img
											src={s.bannerUrl}
											alt={s.title}
											className="h-full w-full object-cover"
										/>
									) : (
										<div className="h-full w-full bg-gradient-to-br from-[#eeedf6] to-slate-200 flex items-center justify-center">
											<ChartBar className="h-10 w-10 text-[#4A0000]/30" />
										</div>
									)}
									<div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
										{getStatusBadge(s.status)}
										<LiveFillingBadge count={liveCounts[s.id] || 0} />
									</div>
								</div>

								{/* Body card */}
								<div className="p-5 space-y-2 flex-1">
									<Link
										to="/admin/surveys/$surveyId"
										params={{ surveyId: s.id.toString() }}
										className="font-semibold text-[#1a1b21] hover:text-[#4A0000] transition-colors line-clamp-2"
									>
										{s.title}
									</Link>
									<div className="text-xs text-[#747683]">/{s.slug}</div>
									{s.periodValue && (
										<div className="flex items-center gap-1 text-[11px] text-[#434652] font-semibold bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded w-fit mt-1">
											<Calendar className="h-3.5 w-3.5 text-[#747683] block" />
											{(() => {
												const formatVal = (v: string) => {
													if (!v) return "";
													if (s.periodType === "month") {
														const [year, month] = v.split("-");
														const date = new Date(
															Number(year),
															Number(month) - 1,
															1,
														);
														return date.toLocaleDateString("id-ID", {
															month: "short",
															year: "numeric",
														});
													} else {
														const date = new Date(v);
														return date.toLocaleDateString("id-ID", {
															dateStyle: "short",
														});
													}
												};
												const endVal = (s as any).periodValueEnd;
												if (endVal) {
													return `${formatVal(s.periodValue)} - ${formatVal(endVal)}`;
												}
												return formatVal(s.periodValue);
											})()}
										</div>
									)}
									<div className="flex items-center gap-4 mt-2">
										<span className="flex items-center gap-1.5 text-xs text-[#434652] font-medium">
											<Users className="h-4 w-4 text-[#747683]" />
											{s.responseCount} respon
										</span>
										<span className="flex items-center gap-1.5 text-xs text-[#747683]">
											<Clock className="h-4 w-4 text-[#747683]" />
											{new Date(s.updatedAt).toLocaleDateString("id-ID", {
												dateStyle: "medium",
											})}
										</span>
									</div>
								</div>

								{/* Footer aksi */}
								<div className="flex justify-end gap-2 px-5 pb-4 shrink-0">
									<Link
										to="/admin/surveys/$surveyId"
										params={{ surveyId: s.id.toString() }}
										className="inline-flex p-1.5 rounded-lg border border-slate-200 text-[#4A0000] hover:bg-[#dbe1ff] transition-all"
										title={
											user?.role === "visitor"
												? "Lihat Detail"
												: "Detail / Edit"
										}
									>
										{user?.role === "visitor" ? (
											<Eye className="h-4 w-4 block" />
										) : (
											<Pencil className="h-4 w-4 block" />
										)}
									</Link>
									{user?.role !== "visitor" && (
										<button
											onClick={() => handleDeleteClick(s.id, s.title)}
											className="inline-flex p-1.5 rounded-lg border border-slate-200 text-[#ba1a1a] hover:bg-[#ffdad6]/40 transition-all"
											title="Hapus"
										>
											<Trash2 className="h-4 w-4 block" />
										</button>
									)}
								</div>
							</div>
						))}
					</div>
				)}
			</section>
		);
	};

	return (
		<div className="space-y-6">
			{/* Page Header */}
			<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
				<div className="w-full">
					<h1 className="text-3xl font-bold text-[#4A0000] text-left w-full">
						Kelola Survey
					</h1>
					<p className="text-sm text-[#434652] mt-1 text-left">
						Kelola kuesioner institusi, buat template kuesioner, dan pantau
						pengisian data tracer alumni.
					</p>
				</div>
				{user?.role !== "visitor" && (
					<Link
						to="/admin/surveys/new"
						className="bg-[#4A0000] text-white hover:bg-[#B00000] rounded-lg px-5 py-2.5 flex items-center justify-center gap-2 text-sm font-semibold transition-transform active:scale-95 shadow-sm w-full md:w-auto shrink-0"
					>
						<Plus className="h-4 w-4" />
						<span>Tambah Survey Baru</span>
					</Link>
				)}
			</div>

			{/* Search & Filter Bar */}
			<div className="flex flex-col md:flex-row gap-4 items-end">
				<div className="relative flex-1 w-full">
					<Search className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#747683]" />
					<input
						className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm placeholder-slate-400 focus:border-[#4A0000] focus:ring-1 focus:ring-[#4A0000] outline-none transition-colors"
						placeholder="Cari survei berdasarkan judul..."
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
				</div>
				<div className="w-full md:w-48 shrink-0">
					<Select
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value)}
						options={[
							{ value: "all", label: "Semua Status" },
							{ value: "published", label: "Dipublikasikan" },
							{ value: "draft", label: "Draft" },
							{ value: "archived", label: "Diarsipkan" },
						]}
					/>
				</div>

				{/* Periode filter */}
				<div className="flex flex-col gap-1.5 w-full md:w-auto items-start shrink-0">
					<div className="flex items-center gap-2 w-full">
						<div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 w-fit">
							<button
								type="button"
								onClick={() => {
									setPeriodFilterMode("month");
									setPeriodFilterValue("");
								}}
								className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${periodFilterMode === "month" ? "bg-white shadow-sm text-[#4A0000]" : "text-[#747683]"}`}
							>
								Bulan
							</button>
							<button
								type="button"
								onClick={() => {
									setPeriodFilterMode("date");
									setPeriodFilterValue("");
								}}
								className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${periodFilterMode === "date" ? "bg-white shadow-sm text-[#4A0000]" : "text-[#747683]"}`}
							>
								Tanggal
							</button>
						</div>
						<div className="relative flex items-center flex-1 md:w-44">
							<input
								type={periodFilterMode === "month" ? "month" : "date"}
								value={periodFilterValue}
								onChange={(e) => setPeriodFilterValue(e.target.value)}
								className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 pr-8 text-sm text-[#1a1b21] focus:border-[#4A0000] outline-none transition-colors"
							/>
							{periodFilterValue && (
								<button
									type="button"
									onClick={() => setPeriodFilterValue("")}
									className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer"
								>
									<X className="h-4 w-4 block" />
								</button>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Tables list */}
			<div className="mt-4">
				{renderSurveyCards(filteredSurveys, "Daftar Survei", "poll")}
			</div>

			<ConfirmDialog
				isOpen={confirmDialog.isOpen}
				title="Hapus Survei"
				message={`Apakah Anda yakin ingin menghapus/mengarsipkan survei "${confirmDialog.title}"?`}
				onConfirm={handleConfirmDelete}
				onCancel={() => setConfirmDialog({ isOpen: false, id: 0, title: "" })}
				confirmText="Ya, Hapus"
			/>
		</div>
	);
}
