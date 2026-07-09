import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSessionFn } from "../../server/authFunctions";
import {
	getAdminDashboardStatsFn,
	getAdminRecentResponsesFn,
} from "../../server/adminSurveyFunctions";

export const Route = createFileRoute("/admin/")({
	beforeLoad: async () => {
		const user = await getSessionFn();
		if (user?.role === "visitor") {
			throw redirect({ to: "/admin/surveys" });
		}
	},
	loader: async () => {
		const [stats, recentResponses] = await Promise.all([
			getAdminDashboardStatsFn(),
			getAdminRecentResponsesFn(),
		]);
		return { stats, recentResponses };
	},
	component: DashboardComponent,
});

function DashboardComponent() {
	const { stats, recentResponses } = Route.useLoaderData();

	return (
		<div className="space-y-8">
			{/* Dashboard Header */}
			<div>
				<h2 className="text-3xl font-bold text-[#002972]">Ringkasan Data</h2>
				<p className="text-sm text-[#434652] mt-1">
					Pantau partisipasi survei alumni dan statistik pengisian kuesioner
					terkini.
				</p>
			</div>

			{/* Stat Cards Grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
				{/* Card 1 */}
				<div className="bg-white border border-[#c4c6d4] rounded-xl p-6 shadow-sm flex items-center justify-between">
					<div className="space-y-1">
						<span className="text-xs font-bold text-[#434652] uppercase tracking-wider">
							Total Kuesioner
						</span>
						<p className="text-3xl font-bold text-[#002972]">
							{stats.totalSurveys}
						</p>
					</div>
					<div className="p-3 bg-[#dbe1ff] text-[#0f409e] rounded-full">
						<span className="material-symbols-outlined text-2xl block">
							poll
						</span>
					</div>
				</div>

				{/* Card 2 */}
				<div className="bg-white border border-[#c4c6d4] rounded-xl p-6 shadow-sm flex items-center justify-between">
					<div className="space-y-1">
						<span className="text-xs font-bold text-[#434652] uppercase tracking-wider">
							Total Respon
						</span>
						<p className="text-3xl font-bold text-[#002972]">
							{stats.totalResponses}
						</p>
					</div>
					<div className="p-3 bg-[#ffdad4] text-[#a03f32] rounded-full">
						<span className="material-symbols-outlined text-2xl block">
							assignment_turned_in
						</span>
					</div>
				</div>

				{/* Card 3 */}
				<div className="bg-white border border-[#c4c6d4] rounded-xl p-6 shadow-sm flex items-center justify-between">
					<div className="space-y-1">
						<span className="text-xs font-bold text-[#434652] uppercase tracking-wider">
							Respon Bulan Ini
						</span>
						<p className="text-3xl font-bold text-[#002972]">
							{stats.monthResponses}
						</p>
					</div>
					<div className="p-3 bg-emerald-100 text-emerald-800 rounded-full">
						<span className="material-symbols-outlined text-2xl block">
							calendar_today
						</span>
					</div>
				</div>

				{/* Card 4 */}
				<div className="bg-white border border-[#c4c6d4] rounded-xl p-6 shadow-sm flex items-center justify-between">
					<div className="space-y-1">
						<span className="text-xs font-bold text-[#434652] uppercase tracking-wider">
							Rasio Pengisian
						</span>
						<p className="text-3xl font-bold text-[#002972]">
							{stats.completionRate}%
						</p>
					</div>
					<div className="p-3 bg-amber-100 text-amber-800 rounded-full">
						<span className="material-symbols-outlined text-2xl block">
							query_stats
						</span>
					</div>
				</div>
			</div>

			{/* Recent Responses Table Card */}
			<div className="bg-white border border-[#c4c6d4] rounded-xl shadow-sm overflow-hidden">
				<div className="border-b border-[#c4c6d4] py-4 px-6 bg-slate-50 flex items-center justify-between">
					<h3 className="font-bold text-base text-[#1a1b21]">
						Aktivitas Pengisian Terbaru
					</h3>
					<span className="text-xs font-semibold text-[#434652] bg-white px-3 py-1 rounded-full border border-slate-200">
						10 Respon Terakhir
					</span>
				</div>

				{recentResponses.length === 0 ? (
					<div className="p-12 text-center">
						<span className="material-symbols-outlined text-4xl text-[#747683] block">
							inbox
						</span>
						<p className="mt-2 text-[#434652] text-sm">
							Belum ada respon kuesioner yang disubmit.
						</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-left border-collapse text-sm">
							<thead>
								<tr className="border-b border-[#c4c6d4] bg-slate-50/50 text-[#434652] font-semibold text-xs uppercase">
									<th className="py-3.5 px-6">Responden</th>
									<th className="py-3.5 px-6">Kuesioner</th>
									<th className="py-3.5 px-6">Tanggal Pengisian</th>
									<th className="py-3.5 px-6">Status</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{recentResponses.map((r) => (
									<tr key={r.id} className="hover:bg-slate-50/50">
										<td className="py-4 px-6 font-semibold text-[#1a1b21]">
											{r.respondentName}
										</td>
										<td className="py-4 px-6 text-[#434652]">
											{r.surveyTitle}
										</td>
										<td className="py-4 px-6 text-[#747683]">
											{r.submittedAt
												? new Date(r.submittedAt).toLocaleString("id-ID")
												: "-"}
										</td>
										<td className="py-4 px-6">
											<span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-xs font-semibold">
												<span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
												Selesai
											</span>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}
