import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
	getAdminSurveysListFn,
	deleteAdminSurveyFn,
} from "../../server/adminSurveyFunctions";
import { toast } from "../../components/ui/useToast";
import { Select } from "../../components/ui/Select";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";

export const Route = createFileRoute("/admin/surveys/")({
	loader: async () => {
		return await getAdminSurveysListFn();
	},
	component: SurveysIndexComponent,
});

function SurveysIndexComponent() {
	const surveys = Route.useLoaderData();
	const router = useRouter();
	const { user } = Route.useRouteContext();

	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");

	const filteredSurveys = surveys.filter((s) => {
		const matchesSearch = s.title
			.toLowerCase()
			.includes(searchQuery.toLowerCase());
		const matchesStatus = statusFilter === "all" || s.status === statusFilter;
		return matchesSearch && matchesStatus;
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
											<span className="material-symbols-outlined text-4xl text-[#002972]/30">
												poll
											</span>
										</div>
									)}
									<div className="absolute top-3 right-3">
										{getStatusBadge(s.status)}
									</div>
								</div>

								{/* Body card */}
								<div className="p-5 space-y-2 flex-1">
									<Link
										to="/admin/surveys/$surveyId"
										params={{ surveyId: s.id.toString() }}
										className="font-semibold text-[#1a1b21] hover:text-[#002972] transition-colors line-clamp-2"
									>
										{s.title}
									</Link>
									<div className="text-xs text-[#747683]">/{s.slug}</div>
									<div className="flex items-center gap-4 mt-2">
										<span className="flex items-center gap-1.5 text-xs text-[#434652] font-medium">
											<span className="material-symbols-outlined text-[16px] text-[#747683]">
												group
											</span>
											{s.responseCount} respon
										</span>
										<span className="flex items-center gap-1.5 text-xs text-[#747683]">
											<span className="material-symbols-outlined text-[16px] text-[#747683]">
												schedule
											</span>
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
										className="inline-flex p-1.5 rounded-lg border border-slate-200 text-[#002972] hover:bg-[#dbe1ff] transition-all"
										title={user?.role === "visitor" ? "Lihat Detail" : "Detail / Edit"}
									>
										<span className="material-symbols-outlined text-sm block">
											{user?.role === "visitor" ? "visibility" : "edit"}
										</span>
									</Link>
									{user?.role !== "visitor" && (
										<button
											onClick={() => handleDeleteClick(s.id, s.title)}
											className="inline-flex p-1.5 rounded-lg border border-slate-200 text-[#ba1a1a] hover:bg-[#ffdad6]/40 transition-all"
											title="Hapus"
										>
											<span className="material-symbols-outlined text-sm block">
												delete
											</span>
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
					<h1 className="text-3xl font-bold text-[#1a1b21] text-left w-full">Daftar Survey</h1>
					<p className="text-sm text-[#434652] mt-1 text-left">
						Kelola kuesioner institusi, buat template kuesioner, dan pantau
						pengisian data tracer alumni.
					</p>
				</div>
				{user?.role !== "visitor" && (
					<Link
						to="/admin/surveys/new"
						className="bg-[#002972] text-white hover:bg-[#0b3e9c] rounded-lg px-5 py-2.5 flex items-center justify-center gap-2 text-sm font-semibold transition-transform active:scale-95 shadow-sm w-full md:w-auto shrink-0"
					>
						<span
							className="material-symbols-outlined text-sm"
							style={{ fontVariationSettings: "'FILL' 1" }}
						>
							add
						</span>
						<span>Tambah Survey Baru</span>
					</Link>
				)}
			</div>

			{/* Search & Filter Bar */}
			<div className="flex flex-col md:flex-row gap-4 items-end">
				<div className="relative flex-1 w-full">
					<span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#747683]">
						search
					</span>
					<input
						className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm placeholder-slate-400 focus:border-[#002972] focus:ring-1 focus:ring-[#002972] outline-none transition-colors"
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
