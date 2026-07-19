import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
	Calendar,
	ChartBar,
	ClipboardCheck,
	Inbox,
	TrendingUp,
	X,
} from "lucide-react";
import { useState } from "react";
import {
	getAdminDashboardStatsFn,
	getAdminSurveysListFn,
} from "../../server/adminSurveyFunctions";
import { getSessionFn } from "../../server/authFunctions";

export const Route = createFileRoute("/admin/")({
	beforeLoad: async () => {
		const user = await getSessionFn();
		if (user?.role === "visitor") {
			throw redirect({ to: "/admin/surveys" });
		}
	},
	loader: async () => {
		const [stats, surveysList] = await Promise.all([
			getAdminDashboardStatsFn(),
			getAdminSurveysListFn(),
		]);
		return { stats, surveysList };
	},
	component: DashboardComponent,
});

function DashboardComponent() {
	const { stats, surveysList } = Route.useLoaderData();
	const [periodFilterMode, setPeriodFilterMode] = useState<"month" | "date">(
		"month",
	);
	const [periodFilterValue, setPeriodFilterValue] = useState("");

	const filteredSurveys = surveysList.filter((s) => {
		if (!periodFilterValue) return true;
		if (!s.periodValue) return false;

		const startVal = s.periodValue;
		const endVal = (s as any).periodValueEnd || s.periodValue;

		if (periodFilterMode === "month") {
			const sStartMonth =
				s.periodType === "date" ? startVal.slice(0, 7) : startVal;
			const sEndMonth = s.periodType === "date" ? endVal.slice(0, 7) : endVal;
			return periodFilterValue >= sStartMonth && periodFilterValue <= sEndMonth;
		}

		if (s.periodType === "date") {
			return periodFilterValue >= startVal && periodFilterValue <= endVal;
		} else {
			const targetMonth = periodFilterValue.slice(0, 7);
			return targetMonth >= startVal && targetMonth <= endVal;
		}
	});

	return (
		<div className="space-y-8">
			{/* Dashboard Header */}
			<div>
				<h2 className="text-3xl font-bold text-[#4A0000] text-left">
					Ringkasan Data
				</h2>
				<p className="text-sm text-[#434652] mt-1 text-left">
					Pantau partisipasi survei alumni dan statistik pengisian kuesioner
					terkini.
				</p>
			</div>

			{/* Stat Cards Grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
				{/* Card 1 */}
				<div className="bg-white border border-outline-variant rounded-xl p-6 shadow-sm flex items-center justify-between">
					<div className="space-y-1 text-left">
						<span className="text-xs font-bold text-[#434652] uppercase tracking-wider">
							Total Kuesioner
						</span>
						<p className="text-3xl font-bold text-[#4A0000]">
							{stats.totalSurveys}
						</p>
					</div>
					<div className="p-3  bg-[#dbe1ff] text-[#0f409e] rounded-full">
						<ChartBar className="h-8 w-8 block" />
					</div>
				</div>

				{/* Card 2 */}
				<div className="bg-white border border-outline-variant rounded-xl p-6 shadow-sm flex items-center justify-between">
					<div className="space-y-1 text-left">
						<span className="text-xs font-bold text-[#434652] uppercase tracking-wider">
							Total Respon
						</span>
						<p className="text-3xl font-bold text-[#4A0000]">
							{stats.totalResponses}
						</p>
					</div>
					<div className="p-3  bg-[#ffdad4] text-[#0B3E9C] rounded-full">
						<ClipboardCheck className="h-8 w-8 block" />
					</div>
				</div>

				{/* Card 3 */}
				<div className="bg-white border border-outline-variant rounded-xl p-6 shadow-sm flex items-center justify-between">
					<div className="space-y-1 text-left">
						<span className="text-xs font-bold text-[#434652] uppercase tracking-wider">
							Respon Bulan Ini
						</span>
						<p className="text-3xl font-bold text-[#4A0000]">
							{stats.monthResponses}
						</p>
					</div>
					<div className="p-3  bg-emerald-100 text-emerald-800 rounded-full">
						<Calendar className="h-8 w-8 block" />
					</div>
				</div>

				{/* Card 4 */}
				<div className="bg-white border border-outline-variant rounded-xl p-6 shadow-sm flex items-center justify-between">
					<div className="space-y-1 text-left">
						<span className="text-xs font-bold text-[#434652] uppercase tracking-wider">
							Rasio Pengisian
						</span>
						<p className="text-3xl font-bold text-[#4A0000]">
							{stats.completionRate}%
						</p>
					</div>
					<div className="p-3  bg-amber-100 text-amber-800 rounded-full">
						<TrendingUp className="h-8 w-8 block" />
					</div>
				</div>
			</div>

			{/* Surveys Table Card */}
			<div className="bg-white border border-outline-variant rounded-xl shadow-sm overflow-hidden">
				<div className="border-b w-full border-outline-variant py-4 px-6 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<h3 className="font-bold text-base text-[#1a1b21]">
							Daftar Survey
						</h3>
					</div>

					{/* Period Filter */}
					<div className="flex items-center gap-2">
						<div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 w-fit">
							<button
								type="button"
								onClick={() => {
									setPeriodFilterMode("month");
									setPeriodFilterValue("");
								}}
								className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${periodFilterMode === "month" ? "bg-slate-100 shadow-xs text-[#4A0000]" : "text-[#747683]"}`}
							>
								Bulan
							</button>
							<button
								type="button"
								onClick={() => {
									setPeriodFilterMode("date");
									setPeriodFilterValue("");
								}}
								className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${periodFilterMode === "date" ? "bg-slate-100 shadow-xs text-[#4A0000]" : "text-[#747683]"}`}
							>
								Tanggal
							</button>
						</div>
						<div className="relative flex items-center w-44">
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

				{filteredSurveys.length === 0 ? (
					<div className="p-12 text-center">
						<Inbox className="h-10 w-10 text-[#747683] block mx-auto" />
						<p className="mt-2 text-[#434652] text-sm">
							Tidak ada survey yang cocok dengan filter periode.
						</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-left border-collapse text-sm">
							<thead>
								<tr className="border-b border-outline-variant bg-slate-50/50 text-[#434652] font-semibold text-xs uppercase">
									<th className="py-3.5 px-6">Nama Survey</th>
									<th className="py-3.5 px-6">Periode</th>
									<th className="py-3.5 px-6">Jumlah Responden</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{filteredSurveys.map((survey) => (
									<tr key={survey.id} className="hover:bg-slate-50/50">
										<td className="py-4 px-6 font-semibold text-[#1a1b21]">
											<Link
												to={`/admin/surveys/${survey.id}`}
												className="hover:text-[#B00000]"
											>
												{survey.title}
											</Link>
										</td>
										<td className="py-4 px-6 text-[#747683]">
											{survey.periodValue ? (
												<span className="inline-flex items-center gap-1.5 font-medium">
													<Calendar className="h-3.5 w-3.5 text-[#747683]" />
													{(() => {
														const formatVal = (v: string) => {
															if (!v) return "";
															if (survey.periodType === "month") {
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
														if (survey.periodValueEnd) {
															return `${formatVal(survey.periodValue)} - ${formatVal(survey.periodValueEnd)}`;
														}
														return formatVal(survey.periodValue);
													})()}
												</span>
											) : (
												"-"
											)}
										</td>
										<td className="py-4 px-6 text-[#434652]">
											<span className="inline-flex items-center gap-1.5 font-bold">
												{survey.responseCount}
												<span className="text-xs font-normal text-[#747683]">
													Responden
												</span>
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
