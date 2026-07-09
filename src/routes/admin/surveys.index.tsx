import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
	getAdminSurveysListFn,
	deleteAdminSurveyFn,
} from "../../server/adminSurveyFunctions";
import { toast } from "../../components/ui/useToast";

export const Route = createFileRoute("/admin/surveys/")({
	loader: async () => {
		return await getAdminSurveysListFn();
	},
	component: SurveysIndexComponent,
});

function SurveysIndexComponent() {
	const surveys = Route.useLoaderData();
	const router = useRouter();

	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");

	const filteredSurveys = surveys.filter((s) => {
		const matchesSearch = s.title
			.toLowerCase()
			.includes(searchQuery.toLowerCase());
		const matchesStatus = statusFilter === "all" || s.status === statusFilter;
		return matchesSearch && matchesStatus;
	});

	// Split by categories
	const tracerSurveys = filteredSurveys.filter((s) => s.category === "tracer");
	const kepuasanSurveys = filteredSurveys.filter(
		(s) => s.category !== "tracer",
	);

	const handleDeleteSurvey = async (id: number, title: string) => {
		if (
			confirm(
				`Apakah Anda yakin ingin menghapus/mengarsipkan survei "${title}"?`,
			)
		) {
			try {
				const res = await deleteAdminSurveyFn({ data: id });
				if (res.success) {
					toast.success(res.message || "Survei berhasil dihapus.");
					await router.invalidate();
				}
			} catch (err: any) {
				toast.error(err.message || "Gagal menghapus survei.");
			}
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

	const renderSurveyTable = (
		list: typeof surveys,
		headerTitle: string,
		icon: string,
	) => {
		return (
			<section className="space-y-4">
				<h3 className="text-lg font-bold text-[#002972] border-b border-[#c4c6d4] pb-2 flex items-center gap-2">
					<span className="material-symbols-outlined">{icon}</span>
					{headerTitle}
				</h3>

				<div className="bg-white border border-[#c4c6d4] rounded-xl shadow-sm overflow-hidden">
					{list.length === 0 ? (
						<div className="p-8 text-center text-slate-400 text-sm">
							Tidak ada survei dalam kategori ini yang cocok dengan filter.
						</div>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-left border-collapse text-sm">
								<thead>
									<tr className="bg-slate-50 border-b border-[#c4c6d4] text-[#434652] font-semibold text-xs uppercase">
										<th className="py-3 px-6">Judul Survei</th>
										<th className="py-3 px-6 w-36">Status</th>
										<th className="py-3 px-6 w-36">Jumlah Respon</th>
										<th className="py-3 px-6 w-44">Pembaruan Terakhir</th>
										<th className="py-3 px-6 w-28 text-right">Aksi</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									{list.map((s) => (
										<tr
											key={s.id}
											className="hover:bg-slate-50/50 group transition-colors"
										>
											<td className="py-4 px-6">
												<Link
													to="/admin/surveys/$surveyId"
													params={{ surveyId: s.id.toString() }}
													className="font-semibold text-[#1a1b21] hover:text-[#002972] transition-colors block"
												>
													{s.title}
												</Link>
												<span className="text-xs text-[#747683] block mt-0.5">
													/{s.slug}
												</span>
											</td>
											<td className="py-4 px-6">{getStatusBadge(s.status)}</td>
											<td className="py-4 px-6 text-[#434652] font-medium">
												<span className="flex items-center gap-1.5">
													<span className="material-symbols-outlined text-sm text-[#747683]">
														group
													</span>
													{s.responseCount} respon
												</span>
											</td>
											<td className="py-4 px-6 text-[#747683]">
												{new Date(s.updatedAt).toLocaleString("id-ID", {
													dateStyle: "medium",
													timeStyle: "short",
												})}
											</td>
											<td className="py-4 px-6 text-right space-x-1">
												<Link
													to="/admin/surveys/$surveyId"
													params={{ surveyId: s.id.toString() }}
													className="inline-flex p-1.5 rounded-lg border border-slate-200 text-[#002972] hover:bg-[#dbe1ff] transition-all"
													title="Detail / Edit"
												>
													<span className="material-symbols-outlined text-sm block">
														edit
													</span>
												</Link>
												<button
													onClick={() => handleDeleteSurvey(s.id, s.title)}
													className="inline-flex p-1.5 rounded-lg border border-slate-200 text-[#ba1a1a] hover:bg-[#ffdad6]/40 transition-all"
													title="Hapus"
												>
													<span className="material-symbols-outlined text-sm block">
														delete
													</span>
												</button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>
			</section>
		);
	};

	return (
		<div className="space-y-8">
			{/* Page Header */}
			<div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
				<div>
					<h1 className="text-3xl font-bold text-[#1a1b21]">Daftar Survey</h1>
					<p className="text-sm text-[#434652] mt-1">
						Kelola kuesioner institusi, buat template kuesioner, dan pantau
						pengisian data tracer alumni.
					</p>
				</div>
				<Link
					to="/admin/surveys/new"
					className="bg-[#002972] text-white hover:bg-[#0b3e9c] rounded-lg px-5 py-2.5 flex items-center gap-2 text-sm font-semibold transition-transform active:scale-95 shadow-sm"
				>
					<span
						className="material-symbols-outlined text-sm"
						style={{ fontVariationSettings: "'FILL' 1" }}
					>
						add
					</span>
					<span>Tambah Survey Baru</span>
				</Link>
			</div>

			{/* Search & Filter Bar */}
			<div className="bg-white border border-[#c4c6d4] rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center shadow-sm">
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
				<div className="h-6 w-px bg-slate-200 hidden md:block"></div>
				<div className="flex items-center gap-2 w-full md:w-auto">
					<span className="text-xs font-bold text-[#434652] uppercase tracking-wider whitespace-nowrap">
						Status:
					</span>
					<select
						className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-[#1a1b21] focus:border-[#002972] focus:ring-1 focus:ring-[#002972] outline-none cursor-pointer w-full md:w-auto"
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value)}
					>
						<option value="all">Semua Status</option>
						<option value="published">Dipublikasikan</option>
						<option value="draft">Draft</option>
						<option value="archived">Diarsipkan</option>
					</select>
				</div>
			</div>

			{/* Tables list */}
			<div className="space-y-10">
				{renderSurveyTable(tracerSurveys, "Tracer Study Alumni", "school")}
				{renderSurveyTable(
					kepuasanSurveys,
					"Survei Kepuasan & Layanan",
					"assignment",
				)}
			</div>
		</div>
	);
}
