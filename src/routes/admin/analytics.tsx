import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { getAdminDashboardStatsFn } from "../../server/adminSurveyFunctions";
import { getSessionFn } from "../../server/authFunctions";

export const Route = createFileRoute("/admin/analytics")({
	loader: async () => {
		// Re-use dashboard stats or calculate aggregates
		try {
			const stats = await getAdminDashboardStatsFn();
			return { stats };
		} catch (err) {
			return { stats: null };
		}
	},
	component: AnalyticsOverviewComponent,
});

// Static mockup survey data with category tags
const ALL_SURVEYS = [
	{
		name: "Tracer Study Alumni FKG",
		participation: "92%",
		score: "4.6",
		status: "Selesai",
		statusColor: "emerald",
		category: "tracer",
	},
	{
		name: "Kuesioner Pengelola FKG",
		participation: "88%",
		score: "4.4",
		status: "Aktif",
		statusColor: "amber",
		category: "kepuasan",
	},
	{
		name: "Form Kepuasan Mahasiswa",
		participation: "75%",
		score: "4.2",
		status: "Aktif",
		statusColor: "amber",
		category: "kepuasan",
	},
	{
		name: "Form Kepuasan Dosen FKG",
		participation: "81%",
		score: "3.9",
		status: "Selesai",
		statusColor: "emerald",
		category: "kepuasan",
	},
] as const;

function AnalyticsOverviewComponent() {
	const { stats } = Route.useLoaderData();
	const [academicPeriod, setAcademicPeriod] = useState("ganjil_23_24");
	const [surveyCategory, setSurveyCategory] = useState("all");
	const [appliedCategory, setAppliedCategory] = useState("all");

	const handleFilterSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setAppliedCategory(surveyCategory);
	};

	// Filter surveys table by applied category
	const filteredSurveys = ALL_SURVEYS.filter(
		(s) => appliedCategory === "all" || s.category === appliedCategory,
	);

	// Show/hide chart series based on applied category
	const showTracer = appliedCategory === "all" || appliedCategory === "tracer";
	const showKepuasan =
		appliedCategory === "all" || appliedCategory === "kepuasan";

	const totalResponses = stats?.totalResponses || 452;
	const activeSurveys = stats?.recentActivities || [];

	return (
		<div className="space-y-6">
			{/* Page Header */}
			<div>
				<h2 className="text-3xl font-bold text-[#002972]">
					Ringkasan Analisis
				</h2>
				<p className="text-sm text-[#434652] mt-1">
					Pantau performa indeks kepuasan, tren pengisian, dan status
					keterserapan alumni.
				</p>
			</div>

			{/* Global Filters */}
			<form
				onSubmit={handleFilterSubmit}
				className="bg-white rounded-xl p-4 shadow-sm border border-[#c4c6d4] flex flex-col md:flex-row gap-4 items-end justify-between"
			>
				<div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
					<div className="flex flex-col gap-1 w-full md:w-56">
						<label className="text-xs font-bold text-[#434652] uppercase">
							Periode Akademik
						</label>
						<select
							value={academicPeriod}
							onChange={(e) => setAcademicPeriod(e.target.value)}
							className="border border-[#c4c6d4] rounded-lg px-3 py-2 text-xs font-semibold text-[#1a1b21] bg-white outline-none cursor-pointer focus:border-[#002972]"
						>
							<option value="ganjil_23_24">Semester Ganjil 2023/2024</option>
							<option value="genap_22_23">Semester Genap 2022/2023</option>
							<option value="ganjil_22_23">Semester Ganjil 2022/2023</option>
						</select>
					</div>

					<div className="flex flex-col gap-1 w-full md:w-56">
						<label className="text-xs font-bold text-[#434652] uppercase">
							Kategori Survei
						</label>
						<select
							value={surveyCategory}
							onChange={(e) => setSurveyCategory(e.target.value)}
							className="border border-[#c4c6d4] rounded-lg px-3 py-2 text-xs font-semibold text-[#1a1b21] bg-white outline-none cursor-pointer focus:border-[#002972]"
						>
							<option value="all">Semua Kategori</option>
							<option value="tracer">Tracer Study Alumni</option>
							<option value="kepuasan">Survei Kepuasan</option>
						</select>
					</div>
				</div>

				<button
					type="submit"
					className="bg-[#0b3e9c] text-white hover:bg-[#002972] text-xs font-bold py-2.5 px-6 rounded-lg flex items-center gap-1.5 shadow-sm transition-transform active:scale-95 w-full md:w-auto justify-center"
				>
					<span className="material-symbols-outlined text-sm">filter_alt</span>
					<span>Terapkan Filter</span>
				</button>
			</form>

			{/* Dashboard Grid */}
			<div className="grid grid-cols-1 md:grid-cols-12 gap-6">
				{/* Satisfaction Index Card */}
				<div className="bg-white rounded-xl p-6 border border-[#c4c6d4] col-span-1 md:col-span-4 flex flex-col justify-center items-center relative overflow-hidden shadow-sm">
					<div className="absolute top-0 left-0 w-full h-1 bg-[#a03f32]"></div>
					<h3 className="font-bold text-base text-[#1a1b21] w-full text-left">
						Indeks Kepuasan Global
					</h3>
					<p className="text-xs text-[#434652] w-full text-left mb-6">
						Rata-rata gabungan (Skala 5.0)
					</p>

					{/* Radial Progress SVG */}
					<div className="relative w-40 h-40 flex items-center justify-center">
						<svg
							className="w-full h-full transform -rotate-90"
							viewBox="0 0 100 100"
						>
							<circle
								cx="50"
								cy="50"
								fill="none"
								r="42"
								stroke="#eeedf6"
								strokeWidth="8"
							></circle>
							<circle
								cx="50"
								cy="50"
								fill="none"
								r="42"
								stroke="#0B3E9C"
								strokeWidth="8"
								strokeDasharray="263.8"
								strokeDashoffset="37" // 4.3 out of 5.0
								className="transition-all duration-1000 ease-out"
							></circle>
						</svg>
						<div className="absolute flex flex-col items-center">
							<span className="text-4xl font-bold text-[#002972]">4.3</span>
							<span className="text-xs font-semibold text-[#434652]">
								/ 5.0
							</span>
						</div>
					</div>

					<div className="w-full mt-6 flex justify-between text-xs font-bold">
						<span className="text-[#434652]">Target: 4.0</span>
						<span className="text-[#a03f32] font-bold">+0.3 dari thn lalu</span>
					</div>
				</div>

				{/* Response Volume Chart (Mockup Columns) */}
				<div className="bg-white rounded-xl p-6 border border-[#c4c6d4] col-span-1 md:col-span-8 flex flex-col shadow-sm">
					<div className="flex justify-between items-center mb-6">
						<div>
							<h3 className="font-bold text-base text-[#1a1b21]">
								Volume Responden
							</h3>
							<p className="text-xs text-[#434652]">
								Tren partisipasi 6 bulan terakhir
							</p>
						</div>
						<div className="flex gap-4 text-xs font-bold text-[#434652]">
							{showTracer && (
								<div className="flex items-center gap-1.5">
									<div className="w-2.5 h-2.5 rounded-full bg-[#0B3E9C]"></div>
									<span>Tracer Study</span>
								</div>
							)}
							{showKepuasan && (
								<div className="flex items-center gap-1.5">
									<div className="w-2.5 h-2.5 rounded-full bg-[#e2e2ea]"></div>
									<span>Kepuasan</span>
								</div>
							)}
						</div>
					</div>

					{/* Simple CSS bar chart */}
					<div className="grow flex items-end gap-4 h-48 relative border-b border-l border-slate-200 ml-8 pl-2 pb-2 mt-4">
						{/* Y Axis markings */}
						<div className="absolute left-[-36px] top-0 bottom-2 flex flex-col justify-between text-[10px] font-bold text-slate-400 py-1 w-8 text-right pr-2">
							<span>1.0k</span>
							<span>500</span>
							<span>0</span>
						</div>

						{/* July */}
						<div className="flex-1 flex justify-center gap-1.5 h-full items-end group">
							{showKepuasan && (
								<div
									className="w-4 bg-slate-200 h-[40%] rounded-t"
									title="Kepuasan: 400"
								></div>
							)}
							{showTracer && (
								<div
									className="w-4 bg-[#0B3E9C] h-[20%] rounded-t"
									title="Tracer: 200"
								></div>
							)}
						</div>

						{/* Aug */}
						<div className="flex-1 flex justify-center gap-1.5 h-full items-end group">
							{showKepuasan && (
								<div
									className="w-4 bg-slate-200 h-[50%] rounded-t"
									title="Kepuasan: 500"
								></div>
							)}
							{showTracer && (
								<div
									className="w-4 bg-[#0B3E9C] h-[30%] rounded-t"
									title="Tracer: 300"
								></div>
							)}
						</div>

						{/* Sept */}
						<div className="flex-1 flex justify-center gap-1.5 h-full items-end group">
							{showKepuasan && (
								<div
									className="w-4 bg-slate-200 h-[30%] rounded-t"
									title="Kepuasan: 300"
								></div>
							)}
							{showTracer && (
								<div
									className="w-4 bg-[#0B3E9C] h-[60%] rounded-t"
									title="Tracer: 600"
								></div>
							)}
						</div>

						{/* Oct */}
						<div className="flex-1 flex justify-center gap-1.5 h-full items-end group">
							{showKepuasan && (
								<div
									className="w-4 bg-slate-200 h-[70%] rounded-t"
									title="Kepuasan: 700"
								></div>
							)}
							{showTracer && (
								<div
									className="w-4 bg-[#0B3E9C] h-[40%] rounded-t"
									title="Tracer: 400"
								></div>
							)}
						</div>

						{/* Nov */}
						<div className="flex-1 flex justify-center gap-1.5 h-full items-end group">
							{showKepuasan && (
								<div
									className="w-4 bg-slate-200 h-[85%] rounded-t"
									title="Kepuasan: 850"
								></div>
							)}
							{showTracer && (
								<div
									className="w-4 bg-[#0B3E9C] h-[90%] rounded-t"
									title="Tracer: 900"
								></div>
							)}
						</div>

						{/* Dec */}
						<div className="flex-1 flex justify-center gap-1.5 h-full items-end group">
							{showKepuasan && (
								<div
									className="w-4 bg-slate-200 h-[60%] rounded-t"
									title="Kepuasan: 600"
								></div>
							)}
							{showTracer && (
								<div
									className="w-4 bg-[#0B3E9C] h-[75%] rounded-t"
									title="Tracer: 750"
								></div>
							)}
						</div>
					</div>

					<div className="flex justify-between pl-10 pt-2 text-[10px] font-bold text-slate-400">
						<span className="flex-1 text-center">Jul</span>
						<span className="flex-1 text-center">Ags</span>
						<span className="flex-1 text-center">Sep</span>
						<span className="flex-1 text-center">Okt</span>
						<span className="flex-1 text-center">Nov</span>
						<span className="flex-1 text-center">Des</span>
					</div>
				</div>
			</div>

			{/* Lower section Grid */}
			<div className="grid grid-cols-1 md:grid-cols-12 gap-6">
				{/* Top performing surveys list */}
				<div className="bg-white rounded-xl p-6 border border-[#c4c6d4] col-span-1 md:col-span-7 shadow-sm">
					<div className="flex justify-between items-center mb-4">
						<h3 className="font-bold text-base text-[#1a1b21]">
							Survei Performa Tertinggi
						</h3>
						<Link
							to="/admin/surveys"
							className="text-[#002972] text-xs font-bold hover:underline"
						>
							Lihat Semua
						</Link>
					</div>

					<div className="overflow-x-auto">
						<table className="w-full text-left border-collapse text-xs">
							<thead>
								<tr className="border-b border-[#c4c6d4] text-[#434652] font-bold">
									<th className="py-2.5 font-semibold">Nama Survei</th>
									<th className="py-2.5 font-semibold">Partisipasi</th>
									<th className="py-2.5 font-semibold">Skor (5.0)</th>
									<th className="py-2.5 font-semibold text-right">Status</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100 font-semibold">
								{filteredSurveys.length === 0 ? (
									<tr>
										<td
											colSpan={4}
											className="py-6 text-center text-xs text-slate-400"
										>
											Tidak ada survei untuk kategori ini.
										</td>
									</tr>
								) : (
									filteredSurveys.map((s) => (
										<tr key={s.name} className="hover:bg-slate-50/50">
											<td className="py-3 text-[#1a1b21] font-bold">
												{s.name}
											</td>
											<td className="py-3 text-slate-500">{s.participation}</td>
											<td
												className={`py-3 font-semibold ${
													parseFloat(s.score) >= 4.3
														? "text-emerald-700"
														: "text-slate-500"
												}`}
											>
												{s.score}
											</td>
											<td className="py-3 text-right">
												<span
													className={`px-2 py-0.5 rounded-full font-bold ${
														s.statusColor === "emerald"
															? "bg-emerald-100 text-emerald-800"
															: "bg-amber-100 text-amber-800"
													}`}
												>
													{s.status}
												</span>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</div>

				{/* Alumni Career Tracking (Tracer Study Focus) */}
				<div className="bg-[#dbe1ff] rounded-xl p-6 border border-[#b3c5ff] col-span-1 md:col-span-5 flex flex-col justify-between shadow-sm">
					<div>
						<h3 className="font-bold text-base text-[#001849] mb-1">
							Fokus Tracer Study
						</h3>
						<p className="text-xs text-[#0f409e] font-semibold mb-4">
							Analisis Karir Alumni (Kohort 2024)
						</p>

						<div className="bg-white rounded-lg p-4 mb-4 flex items-center justify-between shadow-sm">
							<div>
								<span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
									Kepuasan Pengguna Lulusan
								</span>
								<div className="flex items-end gap-1.5 mt-1">
									<span className="text-3xl font-bold text-[#1a1b21]">4.5</span>
									<span className="text-xs font-bold text-[#a03f32] mb-1">
										Sangat Baik
									</span>
								</div>
							</div>
							<span
								className="material-symbols-outlined text-3xl text-[#0B3E9C]"
								style={{ fontVariationSettings: "'FILL' 1" }}
							>
								work
							</span>
						</div>

						<div className="bg-white rounded-lg p-4 flex flex-col shadow-sm">
							<span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3">
								Waktu Tunggu Kerja (Bulan)
							</span>
							<div className="space-y-2.5">
								<div className="flex items-center gap-3">
									<span className="text-xs font-bold w-12 text-slate-500">
										&lt; 3 Bln
									</span>
									<div className="grow bg-slate-100 h-2 rounded-full overflow-hidden">
										<div className="bg-[#0b3e9c] h-full w-[65%] rounded-full"></div>
									</div>
									<span className="text-xs font-bold w-8 text-right">65%</span>
								</div>
								<div className="flex items-center gap-3">
									<span className="text-xs font-bold w-12 text-slate-500">
										3 - 6 Bln
									</span>
									<div className="grow bg-slate-100 h-2 rounded-full overflow-hidden">
										<div className="bg-[#3259b7] h-full w-[25%] rounded-full"></div>
									</div>
									<span className="text-xs font-bold w-8 text-right">25%</span>
								</div>
								<div className="flex items-center gap-3">
									<span className="text-xs font-bold w-12 text-slate-500">
										&gt; 6 Bln
									</span>
									<div className="grow bg-slate-100 h-2 rounded-full overflow-hidden">
										<div className="bg-slate-300 h-full w-[10%] rounded-full"></div>
									</div>
									<span className="text-xs font-bold w-8 text-right">10%</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
