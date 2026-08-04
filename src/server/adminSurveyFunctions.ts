import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getUserFromSession } from "./auth";
import { db } from "./db";
import {
	answers,
	questionOptions,
	questions,
	reportGenerations,
	responses,
	sections,
	surveyCategories,
	surveys,
	users,
} from "./db/schema";
import { detectSiakadField } from "./siakadFieldDetection";

// Middleware to assert user is logged in
async function assertUser() {
	const user = await getUserFromSession();
	if (!user || (user.role !== "admin" && user.role !== "visitor")) {
		throw new Error("Akses ditolak. Anda tidak memiliki izin.");
	}
	return user;
}

// Middleware to assert user is admin (write actions)
async function assertAdmin() {
	const user = await getUserFromSession();
	if (!user || user.role !== "admin") {
		throw new Error(
			"Akses ditolak. Hanya Admin yang dapat melakukan tindakan ini.",
		);
	}
	return user;
}

function isPersonalInfoQuestion(
	question: { sectionId: number },
	firstSectionId: number | null,
) {
	if (firstSectionId === null) return false;
	return question.sectionId === firstSectionId;
}

function getFirstSectionId(surveySections: { id: number; order: number }[]) {
	if (surveySections.length <= 1) return null;
	return [...surveySections].sort((a, b) => a.order - b.order)[0].id;
}

// 1. Fetch dashboard statistics
export const getAdminDashboardStatsFn = createServerFn({
	method: "GET",
}).handler(async () => {
	await assertUser();

	const [totalSurveys] = await db
		.select({ count: sql<number>`count(*)` })
		.from(surveys);
	const [totalResponses] = await db
		.select({ count: sql<number>`count(*)` })
		.from(responses)
		.where(eq(responses.status, "completed"));

	const startOfMonth = new Date();
	startOfMonth.setDate(1);
	startOfMonth.setHours(0, 0, 0, 0);

	const [monthResponses] = await db
		.select({ count: sql<number>`count(*)` })
		.from(responses)
		.where(
			and(
				eq(responses.status, "completed"),
				gte(responses.submittedAt, startOfMonth),
			),
		);

	// Started vs Completed for Completion Rate
	const [totalStarted] = await db
		.select({ count: sql<number>`count(*)` })
		.from(responses);
	const completionRate =
		totalStarted && totalStarted.count > 0
			? Math.round(((totalResponses?.count || 0) / totalStarted.count) * 100)
			: 100;

	// Survey breakdown
	const surveyBreakdown = await db
		.select({
			status: surveys.status,
			count: sql<number>`count(*)`,
		})
		.from(surveys)
		.groupBy(surveys.status);

	return {
		totalSurveys: totalSurveys?.count || 0,
		totalResponses: totalResponses?.count || 0,
		monthResponses: monthResponses?.count || 0,
		completionRate,
		surveyBreakdown,
	};
});

// 2. Fetch recent activity (latest submissions)
export const getAdminRecentResponsesFn = createServerFn({
	method: "GET",
}).handler(async () => {
	await assertUser();

	// Query recent responses with survey names
	const list = await db
		.select({
			id: responses.id,
			surveyId: responses.surveyId,
			surveyTitle: surveys.title,
			submittedAt: responses.submittedAt,
			status: responses.status,
		})
		.from(responses)
		.innerJoin(surveys, eq(responses.surveyId, surveys.id))
		.where(eq(responses.status, "completed"))
		.orderBy(desc(responses.submittedAt))
		.limit(10);

	// Fetch respondent name from answers if available
	const listWithNames = await Promise.all(
		list.map(async (r) => {
			// Find answer in Data Diri that contains "nama" in question title
			const [nameAns] = await db
				.select({ value: answers.valueText })
				.from(answers)
				.innerJoin(questions, eq(answers.questionId, questions.id))
				.where(
					and(
						eq(answers.responseId, r.id),
						sql`lower(${questions.title}) like '%nama%'`,
					),
				);

			return {
				...r,
				respondentName: nameAns?.value || "Anonim",
			};
		}),
	);

	return listWithNames;
});

// 2b. Fetch fixed list of survey categories (used by create/settings forms + public landing filter)
export const getSurveyCategoriesFn = createServerFn({ method: "GET" }).handler(
	async () => {
		return db
			.select({
				slug: surveyCategories.slug,
				name: surveyCategories.name,
				requirePeriod: surveyCategories.requirePeriod,
				enableConditional: surveyCategories.enableConditional,
			})
			.from(surveyCategories)
			.orderBy(surveyCategories.order);
	},
);

// 3. Fetch list of surveys grouped by category (or categories separately)
export const getAdminSurveysListFn = createServerFn({ method: "GET" }).handler(
	async () => {
		await assertUser();

		const list = await db
			.select({
				id: surveys.id,
				slug: surveys.slug,
				title: surveys.title,
				status: surveys.status,
				category: surveys.category,
				bannerUrl: surveys.bannerUrl,
				periodType: surveys.periodType,
				periodValue: surveys.periodValue,
				periodValueEnd: surveys.periodValueEnd,
				updatedAt: surveys.updatedAt,
			})
			.from(surveys)
			.orderBy(desc(surveys.updatedAt));

		const withCounts = await Promise.all(
			list.map(async (s) => {
				const [rCount] = await db
					.select({ count: sql<number>`count(*)` })
					.from(responses)
					.where(
						and(
							eq(responses.surveyId, s.id),
							eq(responses.status, "completed"),
						),
					);
				return {
					...s,
					responseCount: rCount?.count || 0,
				};
			}),
		);

		return withCounts;
	},
);

// 4. Create new survey
export const createAdminSurveyFn = createServerFn({ method: "POST" })
	.validator(
		(data: {
			title: string;
			slug: string;
			category: string;
			description?: string;
			bannerUrl?: string;
			periodType?: "month" | "date";
			periodValue?: string;
			periodValueEnd?: string;
			targetRespondentCount?: number | null;
		}) => data,
	)
	.handler(async ({ data }) => {
		const user = await assertAdmin();

		if (!data.periodValue || !data.periodValueEnd) {
			throw new Error("Periode survei (mulai dan berakhir) wajib diisi.");
		}

		const regex =
			data.periodType === "date" ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}$/;
		if (!regex.test(data.periodValue) || !regex.test(data.periodValueEnd)) {
			throw new Error("Format periode survei tidak valid.");
		}

		if (data.periodValueEnd < data.periodValue) {
			throw new Error("Periode berakhir tidak boleh mendahului periode mulai.");
		}

		const [inserted] = await db.insert(surveys).values({
			title: data.title,
			slug: data.slug,
			category: data.category,
			description: data.description || "",
			bannerUrl: data.bannerUrl || null,
			periodType: data.periodType || "month",
			periodValue: data.periodValue,
			periodValueEnd: data.periodValueEnd,
			targetRespondentCount: data.targetRespondentCount ?? null,
			status: "draft",
			createdBy: user.id,
		});

		const surveyId = (inserted as any).insertId;

		// Create a default implicit section
		await db.insert(sections).values({
			surveyId,
			title: "Data Diri",
			description: "Informasi Data Diri Responden",
			order: 0,
		});

		return {
			success: true,
			surveyId,
		};
	});

// 5. Update survey settings
export const updateAdminSurveySettingsFn = createServerFn({ method: "POST" })
	.validator(
		(data: {
			id: number;
			title: string;
			slug: string;
			category: string;
			status: "draft" | "published" | "archived";
			description?: string;
			bannerUrl?: string;
			periodType?: "month" | "date";
			periodValue?: string | null;
			periodValueEnd?: string | null;
			targetRespondentCount?: number | null;
		}) => data,
	)
	.handler(async ({ data }) => {
		await assertAdmin();

		const [categoryObj] = await db
			.select()
			.from(surveyCategories)
			.where(eq(surveyCategories.slug, data.category));

		const requirePeriod = categoryObj?.requirePeriod ?? false;

		if (requirePeriod && (!data.periodValue || !data.periodValueEnd)) {
			throw new Error("Periode survei (mulai dan berakhir) wajib diisi.");
		}

		if (data.periodValue && data.periodValueEnd) {
			const regex =
				data.periodType === "date" ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}$/;
			if (!regex.test(data.periodValue) || !regex.test(data.periodValueEnd)) {
				throw new Error("Format periode survei tidak valid.");
			}

			if (data.periodValueEnd < data.periodValue) {
				throw new Error("Periode berakhir tidak boleh mendahului periode mulai.");
			}
		}

		await db
			.update(surveys)
			.set({
				title: data.title,
				slug: data.slug,
				category: data.category,
				status: data.status,
				description: data.description || "",
				bannerUrl: data.bannerUrl || null,
				periodType: data.periodType || "month",
				periodValue: data.periodValue || null,
				periodValueEnd: data.periodValueEnd || null,
				targetRespondentCount: data.targetRespondentCount ?? null,
				updatedAt: new Date(),
			})
			.where(eq(surveys.id, data.id));

		return { success: true };
	});

// 6. Delete survey
export const deleteAdminSurveyFn = createServerFn({ method: "POST" })
	.validator((id: number) => id)
	.handler(async ({ data: id }) => {
		await assertAdmin();

		// Check if responses exist
		const [rCount] = await db
			.select({ count: sql<number>`count(*)` })
			.from(responses)
			.where(
				and(eq(responses.surveyId, id), eq(responses.status, "completed")),
			);

		if (rCount && rCount.count > 0) {
			// Soft-archive instead of deleting
			await db
				.update(surveys)
				.set({ status: "archived", updatedAt: new Date() })
				.where(eq(surveys.id, id));
			return {
				success: true,
				archived: true,
				message: "Survei memiliki data jawaban, diubah status ke Diarsipkan.",
			};
		}

		// FK CASCADE deletes questions, options, answers, responses
		await db.delete(surveys).where(eq(surveys.id, id));
		return { success: true, archived: false };
	});

// Delete a single response (and its cascaded answers) — Admin only
export const deleteAdminSurveyResponseFn = createServerFn({ method: "POST" })
	.validator((data: { surveyId: number; responseId: number }) => data)
	.handler(async ({ data }) => {
		await assertAdmin();

		const [existing] = await db
			.select({ id: responses.id })
			.from(responses)
			.where(
				and(
					eq(responses.id, data.responseId),
					eq(responses.surveyId, data.surveyId),
				),
			);
		if (!existing) throw new Error("Respon tidak ditemukan.");

		// FK CASCADE (answers.responseId -> responses.id) deletes the answers too.
		await db.delete(responses).where(eq(responses.id, data.responseId));

		return { success: true };
	});

// 7. Get full survey details for detail view
export const getAdminSurveyDetailFn = createServerFn({ method: "GET" })
	.validator((id: number) => id)
	.handler(async ({ data: id }) => {
		await assertUser();

		const [survey] = await db.select().from(surveys).where(eq(surveys.id, id));
		if (!survey) throw new Error("Survei tidak ditemukan");

		const surveySections = await db
			.select()
			.from(sections)
			.where(eq(sections.surveyId, id))
			.orderBy(sections.order);

		const surveyQuestions = await db
			.select()
			.from(questions)
			.where(eq(questions.surveyId, id))
			.orderBy(questions.order);

		const questionIds = surveyQuestions.map((q) => q.id);
		const surveyOptions =
			questionIds.length > 0
				? await db
						.select()
						.from(questionOptions)
						.where(inArray(questionOptions.questionId, questionIds))
						.orderBy(questionOptions.order)
				: [];

		const [rCount] = await db
			.select({ count: sql<number>`count(*)` })
			.from(responses)
			.where(
				and(eq(responses.surveyId, id), eq(responses.status, "completed")),
			);

		return {
			survey,
			sections: surveySections,
			questions: surveyQuestions.map((q) => ({
				...q,
				options: surveyOptions.filter((o) => o.questionId === q.id),
			})),
			responseCount: rCount?.count || 0,
		};
	});

// 8. Get individual responses (paginated)
export const getAdminSurveyResponsesListFn = createServerFn({ method: "GET" })
	.validator((data: { surveyId: number; page: number; limit: number }) => data)
	.handler(async ({ data }) => {
		const user = await assertUser();

		const offset = (data.page - 1) * data.limit;

		const list = await db
			.select()
			.from(responses)
			.where(
				and(
					eq(responses.surveyId, data.surveyId),
					eq(responses.status, "completed"),
				),
			)
			.orderBy(asc(responses.submittedAt))
			.limit(data.limit)
			.offset(offset);

		const [totalCount] = await db
			.select({ count: sql<number>`count(*)` })
			.from(responses)
			.where(
				and(
					eq(responses.surveyId, data.surveyId),
					eq(responses.status, "completed"),
				),
			);

		// Gather respondent identifiers from answers (NIM, Nama)
		const listWithDetails = await Promise.all(
			list.map(async (r) => {
				const answersList = await db
					.select({
						questionId: answers.questionId,
						questionTitle: questions.title,
						valueText: answers.valueText,
					})
					.from(answers)
					.innerJoin(questions, eq(answers.questionId, questions.id))
					.where(eq(answers.responseId, r.id));

				const namaAns = answersList.find((a) =>
					a.questionTitle.toLowerCase().includes("nama"),
				);
				const nimAns = answersList.find((a) =>
					a.questionTitle.toLowerCase().includes("nim"),
				);

				return {
					id: r.id,
					submittedAt: r.submittedAt,
					nama: user.role === "visitor" ? "—" : namaAns?.valueText || "Anonim",
					nim: user.role === "visitor" ? "—" : nimAns?.valueText || "-",
				};
			}),
		);

		return {
			responses: listWithDetails,
			totalCount: totalCount?.count || 0,
		};
	});

// Ekstrak angkatan dari NIM sesuai peraturan-nim.md: format F PPP YY NNN (10 digit),
// digit ke-5–6 (index 4–5) = 2 digit tahun masuk. "24" -> "2024".
function extractAngkatanFromNim(nim: string | null | undefined): string | null {
	if (!nim) return null;
	const clean = nim.trim();
	if (!/^[A-Za-z]\d{9}$/.test(clean)) return null;
	const yy = clean.slice(4, 6);
	const yearNum = Number(yy);
	if (Number.isNaN(yearNum)) return null;
	// Heuristik abad: asumsikan NIM Unhas dimulai era 2000-an.
	return `20${yy}`;
}

// Helper function to compute survey stats (shared between charts tab and report generator)
async function computeSurveyStats(
	surveyId: number,
	userRole: "admin" | "visitor",
	filter?: { filterQuestionId?: number; filterOptionIds?: number[] },
) {
	// Fetch all sections to determine the first section (for personal info identification)
	const surveySections = await db
		.select()
		.from(sections)
		.where(eq(sections.surveyId, surveyId))
		.orderBy(sections.order);
	const firstSectionId = getFirstSectionId(surveySections);

	// Fetch all questions and options for this survey
	const surveyQuestions = await db
		.select()
		.from(questions)
		.where(eq(questions.surveyId, surveyId))
		.orderBy(questions.order);

	const questionIds = surveyQuestions.map((q) => q.id);
	const surveyOptions =
		questionIds.length > 0
			? await db
					.select()
					.from(questionOptions)
					.where(inArray(questionOptions.questionId, questionIds))
					.orderBy(questionOptions.order)
			: [];

	// Fetch all answers for completed responses of this survey
	const allAnswers =
		questionIds.length > 0
			? await db
					.select({
						id: answers.id,
						responseId: answers.responseId,
						questionId: answers.questionId,
						valueText: answers.valueText,
						valueOptionIds: answers.valueOptionIds,
						valueGrid: answers.valueGrid,
					})
					.from(answers)
					.innerJoin(responses, eq(answers.responseId, responses.id))
					.where(
						and(
							eq(responses.surveyId, surveyId),
							eq(responses.status, "completed"),
						),
					)
			: [];

	let filterQuestion: (typeof surveyQuestions)[number] | undefined;
	let filterOptions: (typeof surveyOptions)[number][] = [];

	if (
		filter?.filterQuestionId != null &&
		filter.filterOptionIds &&
		filter.filterOptionIds.length > 0
	) {
		filterQuestion = surveyQuestions.find(
			(q) => q.id === filter!.filterQuestionId,
		);
		filterOptions = surveyOptions.filter(
			(o) =>
				filter!.filterOptionIds!.includes(o.id) &&
				o.questionId === filter!.filterQuestionId,
		);
		if (!filterQuestion || filterOptions.length === 0) {
			throw new Error("Filter pertanyaan/nilai tidak valid untuk survei ini.");
		}
		if (filterQuestion.type === "grid") {
			throw new Error(
				"Filter berdasarkan pertanyaan tipe Kisi Pilihan Ganda (Matrix) belum didukung.",
			);
		}
	}

	const allCompletedResponses = await db
		.select({ id: responses.id })
		.from(responses)
		.where(
			and(eq(responses.surveyId, surveyId), eq(responses.status, "completed")),
		);

	let responseCount = allCompletedResponses.length;
	let scopedAnswers = allAnswers;
	if (filterQuestion && filterOptions.length > 0) {
		const filterOptionIdSet = new Set(filterOptions.map((o) => o.id));
		const matchingResponseIds = new Set(
			allAnswers
				.filter((a) => a.questionId === filterQuestion!.id)
				.filter((a) => {
					const optIds = a.valueOptionIds as number[] | null;
					return !!optIds && optIds.some((id) => filterOptionIdSet.has(id));
				})
				.map((a) => a.responseId),
		);
		scopedAnswers = allAnswers.filter((a) =>
			matchingResponseIds.has(a.responseId),
		);
		responseCount = allCompletedResponses.filter((r) =>
			matchingResponseIds.has(r.id),
		).length;
	}

	// Aggregate statistics per question
	const stats = surveyQuestions.map((q) => {
		const qOptions = surveyOptions.filter((o) => o.questionId === q.id);
		const qAnswers = scopedAnswers.filter((a) => a.questionId === q.id);
		const isPersonal =
			firstSectionId !== null && isPersonalInfoQuestion(q, firstSectionId);
		const hidden = isPersonal && userRole === "visitor";

		if (q.type === "grid") {
			// Grid matrix aggregation: rowId -> colId -> count
			const rows = qOptions.filter((o) => o.group === "row");
			const cols = qOptions.filter((o) => o.group === "column");

			if (hidden) {
				return {
					questionId: q.id,
					title: q.title,
					type: q.type,
					optionCount: qOptions.length,
					redacted: true,
					data: {
						rows: [],
						columns: [],
						counts: {},
					},
				};
			}

			const matrixStats: Record<string, Record<string, number>> = {};

			// Initialize
			rows.forEach((r) => {
				matrixStats[r.label] = {};
				cols.forEach((c) => {
					matrixStats[r.label][c.label] = 0;
				});
			});

			qAnswers.forEach((ans) => {
				const gridVal = ans.valueGrid as Record<string, number> | null;
				if (gridVal) {
					Object.entries(gridVal).forEach(([rowOptIdStr, colOptId]) => {
						const rowOpt = qOptions.find((o) => String(o.id) === rowOptIdStr);
						const colOpt = qOptions.find((o) => o.id === colOptId);
						if (rowOpt && colOpt) {
							matrixStats[rowOpt.label][colOpt.label] =
								(matrixStats[rowOpt.label][colOpt.label] || 0) + 1;
						}
					});
				}
			});

			return {
				questionId: q.id,
				title: q.title,
				type: q.type,
				optionCount: qOptions.length,
				data: {
					rows: rows.map((r) => r.label),
					columns: cols.map((c) => c.label),
					counts: matrixStats,
				},
			};
		} else if (
			q.type === "multiple_choice" ||
			q.type === "dropdown" ||
			q.type === "linear_scale" ||
			q.type === "checkboxes"
		) {
			if (hidden) {
				return {
					questionId: q.id,
					title: q.title,
					type: q.type,
					optionCount: qOptions.length,
					redacted: true,
					data: [],
				};
			}

			// Option selection aggregation: optionLabel -> count
			const optionCounts: Record<string, number> = {};
			qOptions.forEach((o) => {
				optionCounts[o.label] = 0;
			});

			const respondentCount = qAnswers.length;

			qAnswers.forEach((ans) => {
				const optIds = ans.valueOptionIds as number[] | null;
				if (optIds && optIds.length > 0) {
					optIds.forEach((id) => {
						const opt = qOptions.find((o) => o.id === id);
						if (opt) {
							optionCounts[opt.label] = (optionCounts[opt.label] || 0) + 1;
						}
					});
				}
			});

			return {
				questionId: q.id,
				title: q.title,
				type: q.type,
				optionCount: qOptions.length,
				data: Object.entries(optionCounts).map(([label, count]) => ({
					label,
					count,
					percentage:
						respondentCount > 0
							? Math.round((count / respondentCount) * 100)
							: 0,
				})),
			};
		} else if (q.title?.toLowerCase().includes("tahun masuk")) {
			if (hidden) {
				return {
					questionId: q.id,
					title: q.title,
					type: q.type,
					redacted: true,
					data: [],
				};
			}

			// Free-text year aggregation: raw valueText -> count, sorted ascending.
			const yearCounts: Record<string, number> = {};
			const respondentCount = qAnswers.length;

			qAnswers.forEach((ans) => {
				const raw =
					typeof ans.valueText === "string" ? ans.valueText.trim() : "";
				if (raw !== "") {
					yearCounts[raw] = (yearCounts[raw] || 0) + 1;
				}
			});

			return {
				questionId: q.id,
				title: q.title,
				type: q.type,
				data: Object.entries(yearCounts)
					.map(([label, count]) => ({
						label,
						count,
						percentage:
							respondentCount > 0
								? Math.round((count / respondentCount) * 100)
								: 0,
					}))
					.sort((a, b) =>
						a.label.localeCompare(b.label, undefined, { numeric: true }),
					),
			};
		} else {
			if (hidden) {
				return {
					questionId: q.id,
					title: q.title,
					type: q.type,
					redacted: true,
					data: [],
				};
			}

			// Text answers aggregation: word list / raw answers list
			const textAnswers = qAnswers
				.map((a) => a.valueText)
				.filter((v): v is string => typeof v === "string" && v.trim() !== "");

			return {
				questionId: q.id,
				title: q.title,
				type: q.type,
				data: textAnswers.slice(0, 50), // return top 50 raw text responses
			};
		}
	});

	// Distribusi Angkatan: pakai pertanyaan "Angkatan" eksplisit jika ada,
	// jika tidak ada, turunkan dari pertanyaan NIM (lihat peraturan-nim.md).
	const hasAngkatanQuestion = surveyQuestions.some((q) =>
		q.title?.toLowerCase().includes("angkatan"),
	);
	const nimQuestion = surveyQuestions.find((q) =>
		q.title?.toLowerCase().includes("nim"),
	);

	if (!hasAngkatanQuestion && nimQuestion && userRole === "admin") {
		const nimAnswers = scopedAnswers.filter(
			(a) => a.questionId === nimQuestion.id,
		);
		const angkatanCounts: Record<string, number> = {};
		nimAnswers.forEach((a) => {
			const angkatan = extractAngkatanFromNim(a.valueText);
			if (angkatan)
				angkatanCounts[angkatan] = (angkatanCounts[angkatan] || 0) + 1;
		});
		const total = nimAnswers.length;
		if (total > 0) {
			stats.push({
				questionId: -1, // stat virtual, tidak terikat pertanyaan manapun
				title: "Distribusi Angkatan",
				type: "short_text",
				data: Object.entries(angkatanCounts)
					.map(([label, count]) => ({
						label,
						count,
						percentage: Math.round((count / total) * 100),
					}))
					.sort((a, b) =>
						a.label.localeCompare(b.label, undefined, { numeric: true }),
					),
			} as any);
		}
	}

	return {
		stats,
		surveyQuestions,
		surveyOptions,
		allAnswers: scopedAnswers,
		surveySections,
		firstSectionId,
		filterQuestion,
		filterOptions,
		subtitle: buildFilterSubtitle(filterQuestion, filterOptions),
		responseCount,
	};
}

// 9. Get detailed response statistics (for the charts)
export const getAdminSurveyAnswersStatsFn = createServerFn({ method: "GET" })
	.validator(
		(data: {
			surveyId: number;
			filterQuestionId?: number;
			filterOptionIds?: number[];
		}) => data,
	)
	.handler(async ({ data }) => {
		const user = await assertUser();
		const { stats, subtitle, responseCount } = await computeSurveyStats(
			data.surveyId,
			user.role,
			{
				filterQuestionId: data.filterQuestionId,
				filterOptionIds: data.filterOptionIds,
			},
		);
		return { stats, subtitle, responseCount };
	});

// 10. Update survey questions (reordering, adding, deleting)
export const updateAdminSurveyQuestionsFn = createServerFn({ method: "POST" })
	.validator(
		(data: {
			surveyId: number;
			sections: {
				id?: number;
				title: string;
				description?: string;
				order: number;
			}[];
			questions: {
				id?: number | string;
				sectionOrder: number; // mapped to section order
				type:
					| "short_text"
					| "paragraph"
					| "multiple_choice"
					| "checkboxes"
					| "dropdown"
					| "linear_scale"
					| "grid"
					| "date";
				title: string;
				description?: string;
				required: boolean;
				order: number;
				config?: Record<string, unknown> | null;
				conditionalParentQuestionId?: number | string | null;
				conditionalParentOptionIds?: (number | string)[] | null;
				options?: {
					id?: number | string;
					group: "choice" | "row" | "column";
					label: string;
					order: number;
				}[];
			}[];
		}) => data,
	)
	.handler(async ({ data }) => {
		await assertAdmin();

		// Validate parent type and circular reference
		for (const q of data.questions) {
			if (q.conditionalParentQuestionId) {
				const parent = data.questions.find(
					(x) => x.id === q.conditionalParentQuestionId,
				);
				if (!parent) {
					throw new Error("Pertanyaan induk tidak ditemukan.");
				}
				if (parent.type !== "multiple_choice") {
					throw new Error(
						`Pertanyaan induk "${parent.title}" harus bertipe Pilihan Ganda.`,
					);
				}
				// Circular reference check
				let current: typeof q | undefined = parent;
				const visited = new Set<string | number>();
				while (current) {
					if (current.id) {
						if (current.id === q.id) {
							throw new Error(
								`Referensi sirkular terdeteksi pada pertanyaan "${q.title}".`,
							);
						}
						if (visited.has(current.id)) {
							break;
						}
						visited.add(current.id);
					}
					current = current.conditionalParentQuestionId
						? data.questions.find(
								(x) => x.id === current?.conditionalParentQuestionId,
							)
						: undefined;
				}
			}
		}

		return await db.transaction(async (tx) => {
			// 1. Process sections. We will sync sections:
			const sectionIdMap: Record<number, number> = {}; // UI order index -> database ID

			for (const sec of data.sections) {
				if (sec.id) {
					await tx
						.update(sections)
						.set({
							title: sec.title,
							description: sec.description || "",
							order: sec.order,
						})
						.where(eq(sections.id, sec.id));
					sectionIdMap[sec.order] = sec.id;
				} else {
					const [inserted] = await tx.insert(sections).values({
						surveyId: data.surveyId,
						title: sec.title,
						description: sec.description || "",
						order: sec.order,
					});
					sectionIdMap[sec.order] = (inserted as any).insertId;
				}
			}

			// Find deleted sections in DB and remove them
			const dbSections = await tx
				.select({ id: sections.id })
				.from(sections)
				.where(eq(sections.surveyId, data.surveyId));

			const activeSectionIds = Object.values(sectionIdMap);
			const sectionsToDelete = dbSections
				.map((s) => s.id)
				.filter((id) => !activeSectionIds.includes(id));

			if (sectionsToDelete.length > 0) {
				await tx.delete(sections).where(inArray(sections.id, sectionsToDelete));
			}

			// Maps for Pass 1
			const questionIdMap = new Map<string | number, number>();
			const optionIdMap = new Map<string | number, number>();

			// 2. Process questions (Pass 1)
			const sentQuestionIds: number[] = [];

			for (const q of data.questions) {
				const mappedSectionId = sectionIdMap[q.sectionOrder];
				if (!mappedSectionId) continue;

				let questionId: number;
				const existingId = typeof q.id === "number" ? q.id : undefined;

				if (existingId) {
					await tx
						.update(questions)
						.set({
							sectionId: mappedSectionId,
							type: q.type,
							title: q.title,
							description: q.description || "",
							required: q.required,
							config: q.config ?? null,
							order: q.order,
							conditionalParentQuestionId: null,
							conditionalParentOptionIds: null,
						})
						.where(eq(questions.id, existingId));

					questionId = existingId;
					sentQuestionIds.push(questionId);
				} else {
					const [inserted] = await tx.insert(questions).values({
						surveyId: data.surveyId,
						sectionId: mappedSectionId,
						type: q.type,
						title: q.title,
						description: q.description || "",
						required: q.required,
						config: q.config ?? null,
						order: q.order,
						conditionalParentQuestionId: null,
						conditionalParentOptionIds: null,
					});
					questionId = (inserted as any).insertId;
					sentQuestionIds.push(questionId);
				}

				if (q.id) {
					questionIdMap.set(q.id, questionId);
				}

				// 3. Process question options
				const sentOptionIds: number[] = [];
				if (q.options && q.options.length > 0) {
					for (const opt of q.options) {
						const existingOptId =
							typeof opt.id === "number" ? opt.id : undefined;
						let optionId: number;

						if (existingOptId) {
							await tx
								.update(questionOptions)
								.set({
									group: opt.group,
									label: opt.label,
									value: opt.label,
									order: opt.order,
								})
								.where(eq(questionOptions.id, existingOptId));
							optionId = existingOptId;
							sentOptionIds.push(optionId);
						} else {
							const [insertedOpt] = await tx.insert(questionOptions).values({
								questionId,
								group: opt.group,
								label: opt.label,
								value: opt.label,
								order: opt.order,
							});
							optionId = (insertedOpt as any).insertId;
							sentOptionIds.push(optionId);
						}

						if (opt.id) {
							optionIdMap.set(opt.id, optionId);
						}
					}
				}

				// Clean deleted options for this question
				const dbOptions = await tx
					.select({ id: questionOptions.id })
					.from(questionOptions)
					.where(eq(questionOptions.questionId, questionId));

				const optionsToDelete = dbOptions
					.map((o) => o.id)
					.filter((id) => !sentOptionIds.includes(id));
				if (optionsToDelete.length > 0) {
					await tx
						.delete(questionOptions)
						.where(inArray(questionOptions.id, optionsToDelete));
				}
			}

			// Find deleted questions in DB and remove them
			const dbQuestions = await tx
				.select({ id: questions.id })
				.from(questions)
				.where(eq(questions.surveyId, data.surveyId));

			const questionsToDelete = dbQuestions
				.map((q) => q.id)
				.filter((id) => !sentQuestionIds.includes(id));
			if (questionsToDelete.length > 0) {
				await tx
					.delete(questions)
					.where(inArray(questions.id, questionsToDelete));
			}

			// Pass 2: Update conditional references
			for (const q of data.questions) {
				const dbQuestionId = q.id ? questionIdMap.get(q.id) : undefined;
				if (!dbQuestionId) continue;

				let dbParentQuestionId: number | null = null;
				let dbParentOptionIds: number[] | null = null;

				if (q.conditionalParentQuestionId) {
					dbParentQuestionId =
						questionIdMap.get(q.conditionalParentQuestionId) ?? null;
				}

				if (
					q.conditionalParentOptionIds &&
					q.conditionalParentOptionIds.length > 0
				) {
					dbParentOptionIds = q.conditionalParentOptionIds
						.map((id) => optionIdMap.get(id))
						.filter((id): id is number => id !== undefined);
				}

				await tx
					.update(questions)
					.set({
						conditionalParentQuestionId: dbParentQuestionId,
						conditionalParentOptionIds: dbParentOptionIds,
					})
					.where(eq(questions.id, dbQuestionId));
			}

			return { success: true };
		});
	});

// 11. Duplicate survey
export const duplicateAdminSurveyFn = createServerFn({ method: "POST" })
	.validator((id: number) => id)
	.handler(async ({ data: id }) => {
		const user = await assertAdmin();

		return await db.transaction(async (tx) => {
			// Fetch original survey
			const [survey] = await tx
				.select()
				.from(surveys)
				.where(eq(surveys.id, id));
			if (!survey) throw new Error("Survei tidak ditemukan");

			// Generate new slug
			const newSlug = `salinan-${survey.slug}-${Date.now()}`;

			// Duplicate survey
			const [insertedSurvey] = await tx.insert(surveys).values({
				title: `Salinan ${survey.title}`,
				slug: newSlug,
				category: survey.category,
				description: survey.description || "",
				bannerUrl: survey.bannerUrl,
				status: "draft",
				createdBy: user.id,
			});
			const newSurveyId = (insertedSurvey as any).insertId;

			// Fetch original sections
			const originalSections = await tx
				.select()
				.from(sections)
				.where(eq(sections.surveyId, id))
				.orderBy(sections.order);

			// We need to keep track of section IDs mapping (old -> new)
			const sectionIdMap: Record<number, number> = {};

			for (const sec of originalSections) {
				const [insertedSec] = await tx.insert(sections).values({
					surveyId: newSurveyId,
					title: sec.title,
					description: sec.description || "",
					order: sec.order,
				});
				sectionIdMap[sec.id] = (insertedSec as any).insertId;
			}

			// Fetch original questions
			const originalQuestions = await tx
				.select()
				.from(questions)
				.where(eq(questions.surveyId, id))
				.orderBy(questions.order);

			const originalQuestionIds = originalQuestions.map((q) => q.id);

			// Fetch original options
			const originalOptions =
				originalQuestionIds.length > 0
					? await tx
							.select()
							.from(questionOptions)
							.where(inArray(questionOptions.questionId, originalQuestionIds))
							.orderBy(questionOptions.order)
					: [];

			// Duplicate questions and options
			for (const q of originalQuestions) {
				if (!q.sectionId || !sectionIdMap[q.sectionId]) continue; // Skip if section missing

				const [insertedQ] = await tx.insert(questions).values({
					surveyId: newSurveyId,
					sectionId: sectionIdMap[q.sectionId],
					type: q.type,
					title: q.title,
					description: q.description || "",
					required: q.required,
					order: q.order,
				});
				const newQuestionId = (insertedQ as any).insertId;

				// Duplicate options for this question
				const qOptions = originalOptions.filter((o) => o.questionId === q.id);
				if (qOptions.length > 0) {
					await tx.insert(questionOptions).values(
						qOptions.map((opt) => ({
							questionId: newQuestionId,
							group: opt.group,
							label: opt.label,
							value: opt.value,
							order: opt.order,
						})),
					);
				}
			}

			return {
				success: true,
				newSurveyId,
			};
		});
	});

// 12. Get detailed response answers for a single response (Individual sub-tab)
export const getAdminSurveyResponseDetailFn = createServerFn({ method: "GET" })
	.validator((data: { surveyId: number; responseId: number }) => data)
	.handler(async ({ data }) => {
		const user = await assertUser();

		const [response] = await db
			.select()
			.from(responses)
			.where(
				and(
					eq(responses.id, data.responseId),
					eq(responses.surveyId, data.surveyId),
					eq(responses.status, "completed"),
				),
			);
		if (!response) throw new Error("Respon tidak ditemukan");

		const surveySections = await db
			.select()
			.from(sections)
			.where(eq(sections.surveyId, data.surveyId))
			.orderBy(sections.order);
		const firstSectionId = getFirstSectionId(surveySections);

		const surveyQuestions = await db
			.select()
			.from(questions)
			.where(eq(questions.surveyId, data.surveyId))
			.orderBy(questions.order);
		const questionIds = surveyQuestions.map((q) => q.id);
		const surveyOptions = questionIds.length
			? await db
					.select()
					.from(questionOptions)
					.where(inArray(questionOptions.questionId, questionIds))
					.orderBy(questionOptions.order)
			: [];

		const responseAnswers = await db
			.select()
			.from(answers)
			.where(eq(answers.responseId, data.responseId));

		const items = surveyQuestions.map((q) => {
			const isPersonal =
				firstSectionId !== null && isPersonalInfoQuestion(q, firstSectionId);
			const hidden = isPersonal && user.role === "visitor";
			const options = surveyOptions.filter((o) => o.questionId === q.id);
			const answer = responseAnswers.find((a) => a.questionId === q.id) || null;

			return {
				questionId: q.id,
				sectionId: q.sectionId,
				type: q.type,
				title: q.title,
				description: q.description,
				required: q.required,
				options,
				isPersonalInfo: isPersonal,
				hidden,
				valueText: hidden ? null : (answer?.valueText ?? null),
				valueOptionIds: hidden
					? null
					: ((answer?.valueOptionIds as number[]) ?? null),
				valueGrid: hidden
					? null
					: ((answer?.valueGrid as Record<string, number>) ?? null),
			};
		});

		return {
			responseId: response.id,
			submittedAt: response.submittedAt,
			items,
		};
	});

export const updateAdminSurveyResponseFn = createServerFn({ method: "POST" })
	.validator(
		(data: {
			surveyId: number;
			responseId: number;
			answers: {
				questionId: number;
				valueText?: string | null;
				valueOptionIds?: number[] | null;
				valueGrid?: Record<string, number> | null;
			}[];
		}) => data,
	)
	.handler(async ({ data }) => {
		await assertAdmin();

		const [response] = await db
			.select()
			.from(responses)
			.where(
				and(
					eq(responses.id, data.responseId),
					eq(responses.surveyId, data.surveyId),
					eq(responses.status, "completed"),
				),
			);
		if (!response) throw new Error("Respon tidak ditemukan");

		// Validasi jawaban unik (config.uniqueAnswer), kecualikan respon ini sendiri
		const surveyQuestions = await db
			.select({ id: questions.id, config: questions.config })
			.from(questions)
			.where(eq(questions.surveyId, data.surveyId));
		const uniqueQuestionIds = new Set(
			surveyQuestions
				.filter((q) => (q.config as any)?.uniqueAnswer === true)
				.map((q) => q.id),
		);

		for (const a of data.answers) {
			if (!uniqueQuestionIds.has(a.questionId)) continue;
			const value = (a.valueText || "").trim();
			if (!value) continue;

			const dupRows = await db
				.select({ responseId: answers.responseId })
				.from(answers)
				.innerJoin(responses, eq(answers.responseId, responses.id))
				.where(
					and(
						eq(answers.questionId, a.questionId),
						eq(responses.surveyId, data.surveyId),
						eq(responses.status, "completed"),
						sql`${answers.valueText} = ${value}`,
					),
				);
			if (dupRows.some((d) => d.responseId !== data.responseId)) {
				throw new Error(
					"Nilai jawaban unik ini sudah dipakai oleh respon lain (mis. NIM sudah terdaftar).",
				);
			}
		}

		await db.transaction(async (tx) => {
			await tx.delete(answers).where(eq(answers.responseId, data.responseId));
			const rows = data.answers.map((a) => ({
				responseId: data.responseId,
				questionId: a.questionId,
				valueText: a.valueText || null,
				valueOptionIds: a.valueOptionIds || null,
				valueGrid: a.valueGrid || null,
			}));
			if (rows.length > 0) await tx.insert(answers).values(rows);
		});

		return { success: true };
	});

// Human-readable description of the currently applied response filter —
// used as the docx subtitle, the Groq prompt context line, and the
// on-screen "cakupan data" preview. Keep this the single source of wording.
function buildFilterSubtitle(
	filterQuestion: { title: string } | undefined,
	filterOptions: { label: string }[],
): string {
	if (!filterQuestion || filterOptions.length === 0) {
		return "Seluruh Data Responden";
	}
	return filterOptions.map((o) => o.label).join(", ");
}

// 13. Export real row-level CSV/XLSX data for a survey (Admin only)
const slugify = (s: string) =>
	s
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");

// Shared helper to build survey response export data
async function buildSurveyResponseExport(data: {
	surveyId: number;
	filterQuestionId?: number;
	filterOptionIds?: number[];
}) {
	const { surveyId, filterQuestionId, filterOptionIds } = data;
	const user = await assertUser();
	if (user.role !== "admin") {
		throw new Error("Akses ditolak. Hanya Admin yang dapat mengekspor data.");
	}

	// 1. Load survey, sections, questions, options (ordered)
	const [survey] = await db
		.select()
		.from(surveys)
		.where(eq(surveys.id, surveyId));
	if (!survey) throw new Error("Survei tidak ditemukan");

	const surveySections = await db
		.select()
		.from(sections)
		.where(eq(sections.surveyId, surveyId))
		.orderBy(sections.order);

	const surveyQuestions = await db
		.select()
		.from(questions)
		.where(eq(questions.surveyId, surveyId))
		.orderBy(questions.order);

	const questionIds = surveyQuestions.map((q) => q.id);
	const surveyOptions = questionIds.length
		? await db
				.select()
				.from(questionOptions)
				.where(inArray(questionOptions.questionId, questionIds))
				.orderBy(questionOptions.order)
		: [];

	let filterQuestion: (typeof surveyQuestions)[number] | undefined;
	let filterOptions: (typeof surveyOptions)[number][] = [];

	if (survey.category === "layanan-pengaduan") {
		if (
			filterQuestionId == null ||
			!filterOptionIds ||
			filterOptionIds.length !== 1
		) {
			throw new Error(
				"Pilih Klarifikasi Laporan terlebih dahulu untuk mengekspor data",
			);
		}
	}

	if (
		filterQuestionId != null &&
		filterOptionIds &&
		filterOptionIds.length > 0
	) {
		filterQuestion = surveyQuestions.find((q) => q.id === filterQuestionId);
		filterOptions = surveyOptions.filter(
			(o) =>
				filterOptionIds.includes(o.id) && o.questionId === filterQuestionId,
		);
		if (!filterQuestion || filterOptions.length === 0) {
			throw new Error("Filter pertanyaan/nilai tidak valid untuk survei ini.");
		}
		if (filterQuestion.type === "grid") {
			throw new Error(
				"Filter berdasarkan pertanyaan tipe Kisi Pilihan Ganda (Matrix) belum didukung.",
			);
		}
	}

	// 2. Load all completed responses and their answers
	const allCompletedResponses = await db
		.select()
		.from(responses)
		.where(
			and(eq(responses.surveyId, surveyId), eq(responses.status, "completed")),
		)
		.orderBy(responses.submittedAt);

	const completedResponseIds = allCompletedResponses.map((r) => r.id);
	const allCompletedAnswers = completedResponseIds.length
		? await db
				.select()
				.from(answers)
				.where(inArray(answers.responseId, completedResponseIds))
		: [];

	let filteredResponses = allCompletedResponses;
	if (filterQuestion && filterOptions.length > 0) {
		const filterOptionIdSet = new Set(filterOptions.map((o) => o.id));
		const matchingResponseIds = new Set(
			allCompletedAnswers
				.filter((a) => {
					if (a.questionId !== filterQuestion!.id) return false;
					const optIds = a.valueOptionIds as number[] | null;
					return !!optIds && optIds.some((id) => filterOptionIdSet.has(id));
				})
				.map((a) => a.responseId),
		);
		filteredResponses = allCompletedResponses.filter((r) =>
			matchingResponseIds.has(r.id),
		);
	}

	// Group answers in memory by responseId
	const answersByResponseId = new Map<number, typeof allCompletedAnswers>();
	for (const ans of allCompletedAnswers) {
		if (!answersByResponseId.has(ans.responseId)) {
			answersByResponseId.set(ans.responseId, []);
		}
		answersByResponseId.get(ans.responseId)!.push(ans);
	}

	// 4. Build column plans
	interface ColumnPlan {
		header: string;
		parentHeader?: string;
		childHeader?: string;
		isGrouped?: boolean;
		resolve: (r: any, idx: number, ansList: any[]) => string;
	}

	const columnPlans: ColumnPlan[] = [
		{
			header: "No. Respon",
			parentHeader: "No. Respon",
			childHeader: "No. Respon",
			resolve: (r, idx) => String(idx + 1),
		},
		{
			header: "Timestamp",
			parentHeader: "Timestamp",
			childHeader: "Timestamp",
			resolve: (r) =>
				r.submittedAt ? new Date(r.submittedAt).toISOString() : "",
		},
	];

	// Check for grid row label collisions across different questions
	const gridRowLabels = new Set<string>();
	const duplicateGridRowLabels = new Set<string>();
	for (const q of surveyQuestions) {
		if (q.type === "grid") {
			const rows = surveyOptions.filter(
				(o) => o.questionId === q.id && o.group === "row",
			);
			for (const r of rows) {
				if (gridRowLabels.has(r.label)) {
					duplicateGridRowLabels.add(r.label);
				} else {
					gridRowLabels.add(r.label);
				}
			}
		}
	}

	const isLayananPengaduan = survey.category === "layanan-pengaduan";
	const selectedOptionId =
		isLayananPengaduan && filterOptionIds && filterOptionIds.length > 0
			? filterOptionIds[0]
			: null;

	for (const q of surveyQuestions) {
		// Skip Klarifikasi Laporan (filter question)
		if (isLayananPengaduan && q.id === filterQuestionId) {
			continue;
		}

		const qOptions = surveyOptions.filter((o) => o.questionId === q.id);

		// Check if it should be a grouped column for layanan-pengaduan
		const isGroupedQuestion =
			isLayananPengaduan &&
			selectedOptionId !== null &&
			q.conditionalParentQuestionId !== null &&
			(q.conditionalParentOptionIds || []).includes(selectedOptionId) &&
			(q.type === "multiple_choice" ||
				q.type === "dropdown" ||
				q.type === "checkboxes");

		if (isGroupedQuestion) {
			// For each choice option, create a column
			const choices = qOptions.filter((o) => o.group === "choice");
			for (const opt of choices) {
				columnPlans.push({
					header: `${q.title} — ${opt.label}`,
					parentHeader: q.title,
					childHeader: opt.label,
					isGrouped: true,
					resolve: (rObj, idx, ansList) => {
						const answer = ansList.find((a) => a.questionId === q.id);
						if (!answer) return "";
						const optIds = answer.valueOptionIds as number[] | null;
						if (optIds && optIds.includes(opt.id)) {
							return "✓";
						}
						return "";
					},
				});
			}
		} else {
			if (q.type === "grid") {
				const rows = qOptions.filter((o) => o.group === "row");
				const cols = qOptions.filter((o) => o.group === "column");
				for (const r of rows) {
					const headerText = duplicateGridRowLabels.has(r.label)
						? `${q.title} — ${r.label}`
						: r.label;

					columnPlans.push({
						header: headerText,
						parentHeader: q.title,
						childHeader: r.label,
						resolve: (rObj, idx, ansList) => {
							const answer = ansList.find((a) => a.questionId === q.id);
							if (!answer || !answer.valueGrid) return "";
							const gridVal = answer.valueGrid as Record<string, number>;
							const colOptId = gridVal[String(r.id)];
							if (!colOptId) return "";
							const colOpt = cols.find((c) => c.id === colOptId);
							return colOpt ? colOpt.label : "";
						},
					});
				}
			} else if (
				q.type === "multiple_choice" ||
				q.type === "dropdown" ||
				q.type === "linear_scale"
			) {
				columnPlans.push({
					header: q.title,
					parentHeader: q.title,
					childHeader: q.title,
					resolve: (rObj, idx, ansList) => {
						const answer = ansList.find((a) => a.questionId === q.id);
						if (
							!answer ||
							!answer.valueOptionIds ||
							answer.valueOptionIds.length === 0
						)
							return "";
						const optId = answer.valueOptionIds[0];
						const opt = qOptions.find((o) => o.id === optId);
						return opt ? opt.label : "";
					},
				});
			} else if (q.type === "checkboxes") {
				columnPlans.push({
					header: q.title,
					parentHeader: q.title,
					childHeader: q.title,
					resolve: (rObj, idx, ansList) => {
						const answer = ansList.find((a) => a.questionId === q.id);
						if (
							!answer ||
							!answer.valueOptionIds ||
							answer.valueOptionIds.length === 0
						)
							return "";
						const labels = answer.valueOptionIds
							.map((id: number) => {
								const opt = qOptions.find((o) => o.id === id);
								return opt ? opt.label : null;
							})
							.filter((l: string | null): l is string => l !== null);
						return labels.join("; ");
					},
				});
			} else {
				// short_text, paragraph, date
				columnPlans.push({
					header: q.title,
					parentHeader: q.title,
					childHeader: q.title,
					resolve: (rObj, idx, ansList) => {
						const answer = ansList.find((a) => a.questionId === q.id);
						return answer?.valueText ?? "";
					},
				});
			}
		}
	}

	const filenameSuffix =
		filterQuestion && filterOptions.length > 0
			? `_${slugify(filterQuestion.title)}-${filterOptions.map((o) => slugify(o.label)).join("+")}`
			: "";

	return {
		survey,
		filteredResponses,
		answersByResponseId,
		columnPlans,
		summaryLines: [
			`Ringkasan Survei — ${survey.title}`,
			`Total Respon (Selesai): ${filteredResponses.length}`,
			`Diekspor pada: ${new Date().toISOString()}`,
			...(filterQuestion && filterOptions.length > 0
				? [
						`Filter Diterapkan: ${filterQuestion.title} = ${filterOptions.map((o) => o.label).join(", ")}`,
					]
				: []),
		],
		filenameSuffix,
	};
}

export const exportAdminSurveyResponsesCSVFn = createServerFn({ method: "GET" })
	.validator(
		(data: {
			surveyId: number;
			filterQuestionId?: number;
			filterOptionIds?: number[];
		}) => data,
	)
	.handler(async ({ data }) => {
		const {
			survey,
			filteredResponses,
			answersByResponseId,
			columnPlans,
			summaryLines,
			filenameSuffix,
		} = await buildSurveyResponseExport(data);

		const csvEscape = (val: string | null | undefined) => {
			if (val === null || val === undefined) return '""';
			return `"${String(val).replace(/"/g, '""')}"`;
		};

		const summaryRows = summaryLines.map((line) => {
			const idx = line.indexOf(": ");
			if (idx === -1) return line;
			return `${line.slice(0, idx)},${csvEscape(line.slice(idx + 2))}`;
		});

		const headerRow = columnPlans.map((cp) => csvEscape(cp.header)).join(",");
		const dataRows = filteredResponses.map((r, idx) => {
			const ansList = answersByResponseId.get(r.id) || [];
			return columnPlans
				.map((cp) => csvEscape(cp.resolve(r, idx, ansList)))
				.join(",");
		});

		const csvContent =
			"\uFEFF" + [...summaryRows, "", headerRow, ...dataRows].join("\n");

		return {
			csv: csvContent,
			filename: `responses_survey_${survey.slug}${filenameSuffix}.csv`,
		};
	});

export const exportAdminSurveyResponsesXLSXFn = createServerFn({
	method: "GET",
})
	.validator(
		(data: {
			surveyId: number;
			filterQuestionId?: number;
			filterOptionIds?: number[];
		}) => data,
	)
	.handler(async ({ data }) => {
		const {
			survey,
			filteredResponses,
			answersByResponseId,
			columnPlans,
			summaryLines,
			filenameSuffix,
		} = await buildSurveyResponseExport(data);

		const ExcelJS = (await import("exceljs")).default;
		const workbook = new ExcelJS.Workbook();
		workbook.creator = "Tracer Study";
		workbook.created = new Date();

		const sheet = workbook.addWorksheet("Respon");

		summaryLines.forEach((line) => {
			sheet.addRow([line]);
		});
		sheet.addRow([]);

		const isLayananPengaduan = survey.category === "layanan-pengaduan";
		const headerRowIndex = summaryLines.length + 2;
		let lastHeaderRowIndex = headerRowIndex;

		if (isLayananPengaduan) {
			// Add Row 1: parentHeader
			const row1Values = columnPlans.map((cp) => cp.parentHeader || cp.header);
			const headerRow1 = sheet.addRow(row1Values);

			// Add Row 2: childHeader
			const row2Values = columnPlans.map((cp) => cp.childHeader || cp.header);
			const headerRow2 = sheet.addRow(row2Values);

			lastHeaderRowIndex = headerRowIndex + 1;

			// Format both rows
			[headerRow1, headerRow2].forEach((row) => {
				row.eachCell((cell) => {
					cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
					cell.fill = {
						type: "pattern",
						pattern: "solid",
						fgColor: { argb: "FF002972" },
					};
					cell.alignment = {
						vertical: "middle",
						horizontal: "center",
						wrapText: true,
					};
					cell.border = {
						top: { style: "thin", color: { argb: "FFFFFFFF" } },
						left: { style: "thin", color: { argb: "FFFFFFFF" } },
						bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
						right: { style: "thin", color: { argb: "FFFFFFFF" } },
					};
				});
			});

			headerRow1.height = 24;
			headerRow2.height = 24;

			// Merge cells
			let colIdx = 1;
			while (colIdx <= columnPlans.length) {
				const cp = columnPlans[colIdx - 1];
				if (cp.isGrouped) {
					let endColIdx = colIdx;
					while (
						endColIdx + 1 <= columnPlans.length &&
						columnPlans[endColIdx].parentHeader === cp.parentHeader &&
						columnPlans[endColIdx].isGrouped
					) {
						endColIdx++;
					}

					if (endColIdx > colIdx) {
						sheet.mergeCells(headerRowIndex, colIdx, headerRowIndex, endColIdx);
						colIdx = endColIdx + 1;
					} else {
						colIdx++;
					}
				} else {
					sheet.mergeCells(headerRowIndex, colIdx, headerRowIndex + 1, colIdx);
					colIdx++;
				}
			}
		} else {
			const headerRow = sheet.addRow(columnPlans.map((cp) => cp.header));
			headerRow.eachCell((cell) => {
				cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
				cell.fill = {
					type: "pattern",
					pattern: "solid",
					fgColor: { argb: "FF002972" },
				};
				cell.alignment = {
					vertical: "middle",
					horizontal: "left",
					wrapText: true,
				};
			});
			headerRow.height = 22;
		}

		filteredResponses.forEach((r, idx) => {
			const ansList = answersByResponseId.get(r.id) || [];
			sheet.addRow(columnPlans.map((cp) => cp.resolve(r, idx, ansList)));
		});

		// Auto-size column widths and estimate header row height
		let maxHeaderLines = 1;
		sheet.columns.forEach((col, i) => {
			const headerText = String(columnPlans[i]?.header ?? "");
			const headerLen = headerText.length;
			let maxLen = headerLen;
			col.eachCell?.({ includeEmpty: false }, (cell) => {
				const len = String(cell.value ?? "").length;
				if (len > maxLen) maxLen = len;
			});
			const colWidth = Math.min(Math.max(maxLen + 2, 12), 40);
			col.width = colWidth;

			// Sane line estimation (wrapText)
			const contentWidth = Math.max(colWidth - 2, 8);
			const lines = Math.ceil(headerLen / contentWidth);
			if (lines > maxHeaderLines) maxHeaderLines = lines;
		});

		if (!isLayananPengaduan) {
			const headerRow = sheet.getRow(headerRowIndex);
			headerRow.height = Math.max(maxHeaderLines * 15 + 6, 22);
		}

		sheet.views = [{ state: "frozen", xSplit: 0, ySplit: lastHeaderRowIndex }];
		sheet.autoFilter = {
			from: { row: lastHeaderRowIndex, column: 1 },
			to: {
				row: lastHeaderRowIndex + filteredResponses.length,
				column: columnPlans.length,
			},
		};

		const buffer = await workbook.xlsx.writeBuffer();
		return {
			base64: Buffer.from(buffer as any).toString("base64"),
			filename: `responses_survey_${survey.slug}${filenameSuffix}.xlsx`,
		};
	});

// Helper to get numeric value for Likert options
function getNumericValueForOption(
	option: { id: number; value: string | null; label: string; order: number },
	allOptions: {
		id: number;
		value: string | null;
		label: string;
		order: number;
	}[],
): number | null {
	const parsedVal = Number.parseFloat(option.value || "");
	if (!Number.isNaN(parsedVal)) return parsedVal;
	const parsedLabel = Number.parseFloat(option.label || "");
	if (!Number.isNaN(parsedLabel)) return parsedLabel;

	const sortedOptions = [...allOptions].sort((a, b) => a.order - b.order);
	const index = sortedOptions.findIndex((o) => o.id === option.id);
	if (index === -1) return null;

	const likertKeywords = [
		"baik",
		"puas",
		"relevan",
		"setuju",
		"sangat",
		"cukup",
		"kurang",
		"tidak",
	];
	const isLikert = sortedOptions.some((o) => {
		const l = (o.label || "").toLowerCase();
		return likertKeywords.some((k) => l.includes(k));
	});

	if (!isLikert) return null;

	const firstLabel = (sortedOptions[0].label || "").toLowerCase().trim();
	const isPositiveFirst =
		firstLabel.includes("sangat") ||
		firstLabel.includes("puas") ||
		firstLabel.includes("baik") ||
		firstLabel.includes("relevan") ||
		firstLabel.includes("setuju");

	if (isPositiveFirst) {
		return sortedOptions.length - index;
	} else {
		return index + 1;
	}
}

// Helper for standard score categorization (1-4 scale)
function getScoreCategory(mean: number): string {
	// TODO: parameterize by scale if a 1-5 survey shows up
	if (mean >= 3.25) return "Sangat Baik";
	if (mean >= 2.5) return "Baik";
	if (mean >= 1.75) return "Cukup";
	return "Kurang";
}

// Helper to assert report rate limit
async function assertReportRateLimit(surveyId: number, userId: number) {
	if (process.env.ENVIRONMENT === "DEVELOPMENT") return;

	const [last] = await db
		.select({ generatedAt: reportGenerations.generatedAt })
		.from(reportGenerations)
		.where(
			and(
				eq(reportGenerations.surveyId, surveyId),
				eq(reportGenerations.userId, userId),
			),
		)
		.orderBy(desc(reportGenerations.generatedAt))
		.limit(1);

	if (!last) return;

	const elapsedMs = Date.now() - last.generatedAt.getTime();
	const windowMs = 10 * 60 * 1000;
	if (elapsedMs < windowMs) {
		const remainingSec = Math.ceil((windowMs - elapsedMs) / 1000);
		throw new Error(
			`Tunggu ${Math.ceil(remainingSec / 60)} menit lagi sebelum generate laporan berikutnya untuk survei ini.`,
		);
	}
}

// 14. Generate automatic survey report with Groq analysis and Recharts charts embedded (Admin only)
export const generateSurveyReportFn = createServerFn({ method: "POST" })
	.validator(
		(data: {
			surveyId: number;
			charts: {
				questionId: number;
				label: string;
				imageBase64: string;
				pxWidth?: number;
				pxHeight?: number;
			}[];
			filterQuestionId?: number;
			filterOptionIds?: number[];
		}) => data,
	)
	.handler(
		async ({
			data: { surveyId, charts, filterQuestionId, filterOptionIds },
		}) => {
			const user = await assertAdmin();
			const userId = user.id;

			const docxTemplates = await import("docx-templates");
			const createReport = docxTemplates.default || docxTemplates.createReport;
			const fs = await import("node:fs");
			const path = await import("node:path");

			// Check payload size
			let totalBase64Length = 0;
			for (const chart of charts) {
				totalBase64Length += chart.imageBase64.length;
			}
			if (totalBase64Length > 7 * 1024 * 1024) {
				throw new Error(
					"Ukuran total gambar grafik terlalu besar (maksimal 5MB).",
				);
			}

			// Check rate limit
			await assertReportRateLimit(surveyId, userId);

			// Load survey details
			const [survey] = await db
				.select()
				.from(surveys)
				.where(eq(surveys.id, surveyId));
			if (!survey) throw new Error("Survei tidak ditemukan");

			// 1. Get statistics and metadata
			const {
				stats,
				surveyQuestions,
				surveyOptions,
				allAnswers,
				firstSectionId,
				filterQuestion,
				filterOptions,
				subtitle,
				responseCount,
			} = await computeSurveyStats(surveyId, user.role, {
				filterQuestionId,
				filterOptionIds,
			});

			// Compute mean scores for linear_scale, multiple_choice & grid
			const allMeans: {
				questionId: number;
				rowOptionId?: number;
				type: string;
				label: string;
				mean: number;
				category: string;
			}[] = [];
			for (const q of surveyQuestions) {
				const isPersonal =
					firstSectionId !== null && isPersonalInfoQuestion(q, firstSectionId);
				if (isPersonal) continue;

				const qOptions = surveyOptions.filter((o) => o.questionId === q.id);
				const qAnswers = allAnswers.filter((a) => a.questionId === q.id);

				if (q.type === "linear_scale" || q.type === "multiple_choice") {
					const numericOptions = qOptions
						.map((o) => ({
							id: o.id,
							val: getNumericValueForOption(o, qOptions),
							label: o.label,
						}))
						.filter(
							(o): o is { id: number; val: number; label: string } =>
								o.val !== null,
						);

					if (numericOptions.length > 0) {
						let sum = 0;
						let count = 0;
						qAnswers.forEach((ans) => {
							const optIds = ans.valueOptionIds as number[] | null;
							if (optIds) {
								optIds.forEach((id) => {
									const opt = numericOptions.find((o) => o.id === id);
									if (opt) {
										sum += opt.val;
										count++;
									}
								});
							}
						});

						if (count > 0) {
							const mean = sum / count;
							const category = getScoreCategory(mean);
							allMeans.push({
								questionId: q.id,
								type: q.type,
								label: q.title,
								mean,
								category,
							});
						}
					}
				} else if (q.type === "grid") {
					const rowOptions = qOptions.filter((o) => o.group === "row");
					const colOptions = qOptions.filter((o) => o.group === "column");
					const numericCols = colOptions
						.map((o) => ({
							id: o.id,
							val: getNumericValueForOption(o, colOptions),
						}))
						.filter((o): o is { id: number; val: number } => o.val !== null);

					if (numericCols.length > 0) {
						for (const row of rowOptions) {
							let sum = 0;
							let count = 0;
							for (const ans of qAnswers) {
								const gridVal = ans.valueGrid as Record<string, number> | null;
								if (!gridVal) continue;
								const colId = gridVal[String(row.id)];
								const col = numericCols.find((c) => c.id === colId);
								if (col) {
									sum += col.val;
									count++;
								}
							}
							if (count > 0) {
								const mean = sum / count;
								allMeans.push({
									questionId: q.id,
									rowOptionId: row.id,
									type: "grid_row",
									label: row.label,
									mean,
									category: getScoreCategory(mean),
								});
							}
						}
					}
				}
			}

			// Calculate overall mean of linear scale and Likert questions
			const validMeans = allMeans.filter(
				(m) =>
					m.type === "linear_scale" ||
					m.type === "multiple_choice" ||
					m.type === "grid_row",
			);
			let overallMeanVal = 0;
			let overallCategoryVal = "-";
			if (validMeans.length > 0) {
				const sum = validMeans.reduce((acc, m) => acc + m.mean, 0);
				overallMeanVal = sum / validMeans.length;
				overallCategoryVal = getScoreCategory(overallMeanVal);
			}

			// 2. Build Groq Prompt
			let userPrompt = `Berikut adalah data hasil survei:\n\n`;
			userPrompt += `Judul Survei: ${survey.title}\n`;
			userPrompt += `Cakupan Data: ${subtitle}\n`;
			if (survey.periodValue) {
				userPrompt += `Periode: ${survey.periodValue} s/d ${survey.periodValueEnd || ""}\n`;
			}
			userPrompt += `Jumlah Responden: ${responseCount} orang\n\n`;

			for (const q of surveyQuestions) {
				const isPersonal =
					firstSectionId !== null && isPersonalInfoQuestion(q, firstSectionId);
				if (isPersonal) continue;

				const qOptions = surveyOptions.filter((o) => o.questionId === q.id);
				const qAnswers = allAnswers.filter((a) => a.questionId === q.id);
				const stat = stats.find((s) => s.questionId === q.id);

				userPrompt += `ID Pertanyaan: ${q.id}\n`;
				userPrompt += `Pertanyaan: ${q.title}\n`;
				userPrompt += `Tipe: ${q.type}\n`;

				if (q.type === "grid") {
					userPrompt += `Hasil Aggregasi (Baris x Kolom):\n`;
					const rows = qOptions.filter((o) => o.group === "row");
					const cols = qOptions.filter((o) => o.group === "column");
					rows.forEach((r) => {
						userPrompt += `- Baris "${r.label}":\n`;
						cols.forEach((c) => {
							const count = stat?.data?.counts?.[r.label]?.[c.label] || 0;
							userPrompt += `  * Kolom "${c.label}": ${count} respon\n`;
						});
					});
				} else if (
					q.type === "multiple_choice" ||
					q.type === "dropdown" ||
					q.type === "linear_scale" ||
					q.type === "checkboxes"
				) {
					userPrompt += `Hasil Pilihan Jawaban:\n`;
					stat?.data?.forEach((item: any) => {
						userPrompt += `- Opsi "${item.label}": ${item.count} respon (${item.percentage}%)\n`;
					});
					const meanItem = allMeans.find((m) => m.questionId === q.id);
					if (meanItem) {
						userPrompt += `Skor Rata-Rata: ${meanItem.mean.toFixed(2)} (Kategori: ${meanItem.category})\n`;
					}
				} else {
					userPrompt += `Daftar Jawaban Responden (Maksimal 30):\n`;
					const textList = qAnswers
						.map((a) => a.valueText)
						.filter(
							(v): v is string => typeof v === "string" && v.trim() !== "",
						)
						.slice(0, 30);
					textList.forEach((txt, idx) => {
						userPrompt += `- [Respon ${idx + 1}]: "${txt}"\n`;
					});
				}
				userPrompt += `\n`;
			}

			const systemPrompt = `Anda adalah seorang ahli analis data akademik dan Tracer Study perguruan tinggi.
Tugas Anda adalah menganalisis hasil survei tracer study dan menghasilkan narasi laporan formal dalam Bahasa Indonesia.

Format output yang diminta wajib berupa JSON valid dengan struktur berikut:
{
  "pendahuluan": "Paragraf pendahuluan laporan (min. 100 kata), menjelaskan tujuan analisis survei secara profesional.",
  "kesimpulan": "Paragraf kesimpulan umum dari seluruh hasil survei (min. 100 kata), menyoroti aspek kekuatan utama dan hal-hal kritis yang perlu ditingkatkan.",
  "interpretations": {
    "<questionId>": "Paragraf analisis & interpretasi mendalam untuk pertanyaan ini (min. 50 kata). Tulis analisis deskriptif mengenai persentase, tren, atau tema jawaban responden. Jangan tampilkan data mentah/angka persentase secara kaku saja, tapi berikan interpretasi makna dari data tersebut bagi institusi."
  },
  "recommendations": [
    "Rekomendasi aksi nyata 1 berdasarkan hasil survei (berorientasi pada peningkatan kurikulum, sarana prasarana, atau layanan).",
    "Rekomendasi aksi nyata 2...",
    "Rekomendasi aksi nyata 3..."
  ]
}

Ketentuan:
1. "interpretations" wajib memiliki key berupa ID pertanyaan (stringified questionId) untuk setiap pertanyaan yang diberikan.
2. Gaya bahasa formal, akademis, objektif, namun solutif.
3. Hindari penggunaan placeholder atau template kosong. Tulis narasi riil.
4. Gunakan istilah-istilah tracer study yang standar (misal: alumni, masa tunggu, keselarasan kerja, kompetensi).`;

			// Call Groq using fetch
			if (!process.env.GROQ_API_KEY) {
				throw new Error("GROQ_API_KEY tidak dikonfigurasi di server.");
			}

			const groqResponse = await fetch(
				"https://api.groq.com/openai/v1/chat/completions",
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						model: "llama-3.3-70b-versatile",
						messages: [
							{ role: "system", content: systemPrompt },
							{ role: "user", content: userPrompt },
						],
						response_format: { type: "json_object" },
						temperature: 0.3,
					}),
				},
			);

			if (!groqResponse.ok) {
				const errText = await groqResponse.text();
				throw new Error(`Gagal menghubungi AI (Groq): ${errText}`);
			}

			const groqData = await groqResponse.json();
			const resultText = groqData.choices?.[0]?.message?.content;
			if (!resultText) {
				throw new Error("AI tidak mengembalikan respon analisis.");
			}

			let analysis: {
				pendahuluan: string;
				kesimpulan: string;
				interpretations: Record<string, string>;
				recommendations: string[];
			};

			try {
				analysis = JSON.parse(resultText);
			} catch (e) {
				throw new Error(
					"Gagal mengurai respon analisis dari AI. Silakan coba lagi.",
				);
			}

			// 3. Render DOCX using docx-templates
			const templatePath = path.join(
				process.cwd(),
				"templates",
				"laporan-survei-template.docx",
			);
			if (!fs.existsSync(templatePath)) {
				throw new Error("Berkas template laporan tidak ditemukan.");
			}
			const templateBuffer = fs.readFileSync(templatePath);

			const indicatorsData: any[] = [];
			const chartsData: any[] = [];
			const interpretationParagraphsData: string[] = [];

			let periodLabel = "-";
			if (survey.periodValue) {
				periodLabel = survey.periodValue;
				if (survey.periodValueEnd) {
					periodLabel += ` s/d ${survey.periodValueEnd}`;
				}
			}

			for (const q of surveyQuestions) {
				const isPersonal =
					firstSectionId !== null && isPersonalInfoQuestion(q, firstSectionId);
				if (isPersonal) continue;

				if (q.type === "grid") {
					const gridMeans = allMeans.filter(
						(m) => m.questionId === q.id && m.type === "grid_row",
					);
					gridMeans.forEach((m) => {
						indicatorsData.push({
							label: m.label,
							mean: m.mean.toFixed(2),
							category: m.category,
						});
					});
				} else {
					const meanItem = allMeans.find((m) => m.questionId === q.id);
					indicatorsData.push({
						label: q.title,
						mean: meanItem ? meanItem.mean.toFixed(2) : "-",
						category: meanItem ? meanItem.category : "-",
					});
				}

				const matchedChart = charts.find((c) => c.questionId === q.id);
				if (matchedChart && matchedChart.imageBase64) {
					let imgWidth = 14;
					let imgHeight = 8;
					if (matchedChart.pxWidth && matchedChart.pxHeight) {
						imgWidth = 14;
						imgHeight = 14 * (matchedChart.pxHeight / matchedChart.pxWidth);
						if (imgHeight > 12) {
							imgHeight = 12;
							imgWidth = 12 * (matchedChart.pxWidth / matchedChart.pxHeight);
						}
					}
					chartsData.push({
						label: q.title,
						image: {
							width: imgWidth,
							height: imgHeight,
							data: Buffer.from(matchedChart.imageBase64, "base64"),
							extension: ".png",
						},
					});
				}

				const narrative =
					analysis.interpretations[String(q.id)] ||
					analysis.interpretations[q.id];
				interpretationParagraphsData.push(
					narrative ||
						`Indikator "${q.title}" menunjukkan data dengan distribusi respon yang terkumpul.`,
				);
			}

			const data = {
				survey: {
					title: survey.title,
					subtitle,
					periodLabel,
				},
				responseCount,
				overallMean: overallMeanVal > 0 ? overallMeanVal.toFixed(2) : "-",
				overallCategory: overallCategoryVal,
				pendahuluan: analysis.pendahuluan,
				kesimpulan: analysis.kesimpulan,
				indicators: indicatorsData,
				charts: chartsData,
				interpretationParagraphs: interpretationParagraphsData,
				recommendations: analysis.recommendations || [],
			};

			const docBuffer = await createReport({
				template: templateBuffer,
				data,
				cmdDelimiter: ["{", "}"],
			});

			const base64Data = Buffer.from(docBuffer).toString("base64");
			const filenameSuffix =
				filterQuestion && filterOptions.length > 0
					? `_${slugify(filterQuestion.title)}-${filterOptions.map((o) => slugify(o.label)).join("+")}`
					: "";
			const filenameVal = `Laporan_Survei_${survey.slug}${filenameSuffix}.docx`;

			const filterKey =
				filterQuestion && filterOptions.length > 0
					? `${filterQuestion.id}:${filterOptions
							.map((o) => o.id)
							.sort((a, b) => a - b)
							.join(",")}`
					: "";

			// 4. Record the generation only after successful generation
			await db.insert(reportGenerations).values({
				surveyId,
				userId,
				fileBase64: base64Data,
				fileName: filenameVal,
				filterKey,
			});

			return {
				base64: base64Data,
				filename: filenameVal,
				cooldownApplied: process.env.ENVIRONMENT !== "DEVELOPMENT",
			};
		},
	);

// 15. Fetch the latest successfully generated report (if any) for a survey (Admin only)
export const getLatestSurveyReportFn = createServerFn({ method: "GET" })
	.validator(
		(data: {
			surveyId: number;
			filterQuestionId?: number;
			filterOptionIds?: number[];
		}) => data,
	)
	.handler(async ({ data }) => {
		const user = await assertAdmin();

		const filterKey =
			data.filterQuestionId != null &&
			data.filterOptionIds &&
			data.filterOptionIds.length > 0
				? `${data.filterQuestionId}:${[...data.filterOptionIds].sort((a, b) => a - b).join(",")}`
				: "";

		const [latest] = await db
			.select({
				id: reportGenerations.id,
				fileName: reportGenerations.fileName,
				fileBase64: reportGenerations.fileBase64,
				generatedAt: reportGenerations.generatedAt,
			})
			.from(reportGenerations)
			.where(
				and(
					eq(reportGenerations.surveyId, data.surveyId),
					eq(reportGenerations.filterKey, filterKey),
				),
			)
			.orderBy(desc(reportGenerations.generatedAt))
			.limit(1);

		if (!latest || !latest.fileBase64) return null;

		return {
			id: latest.id,
			fileName: latest.fileName || "Laporan_Survei.docx",
			base64: latest.fileBase64,
			generatedAt: latest.generatedAt.toISOString(),
		};
	});

// Sarankan mapping otomatis berdasarkan judul pertanyaan yang sudah ada di survei.
export const getSiakadAutofillSuggestionFn = createServerFn({ method: "GET" })
	.validator((surveyId: number) => surveyId)
	.handler(async ({ data: surveyId }) => {
		await assertAdmin();

		const surveyQuestions = await db
			.select({
				id: questions.id,
				title: questions.title,
				type: questions.type,
			})
			.from(questions)
			.where(eq(questions.surveyId, surveyId));

		const shortTextQuestions = surveyQuestions.filter(
			(q) => q.type === "short_text",
		);

		let nimQuestionId: number | null = null;
		const mappings: { questionId: number; field: string }[] = [];

		for (const q of shortTextQuestions) {
			const field = detectSiakadField(q.title);
			if (!field) continue;
			if (field === "nim") {
				nimQuestionId = q.id;
			} else {
				mappings.push({ questionId: q.id, field });
			}
		}

		return {
			candidateQuestions: shortTextQuestions,
			suggestedNimQuestionId: nimQuestionId,
			suggestedMappings: mappings,
		};
	});

// Simpan konfigurasi auto-isi SIAKAD untuk sebuah survei.
export const updateSiakadAutofillConfigFn = createServerFn({ method: "POST" })
	.validator(
		(data: {
			surveyId: number;
			enabled: boolean;
			nimQuestionId: number | null;
			mappings: { questionId: number; field: string }[];
		}) => data,
	)
	.handler(async ({ data }) => {
		await assertAdmin();

		if (data.enabled && !data.nimQuestionId) {
			throw new Error("Pilih pertanyaan NIM terlebih dahulu.");
		}

		await db
			.update(surveys)
			.set({
				siakadAutofillConfig: {
					enabled: data.enabled,
					nimQuestionId: data.nimQuestionId,
					mappings: data.mappings as any,
				},
				updatedAt: new Date(),
			})
			.where(eq(surveys.id, data.surveyId));

		// Otomatis tandai pertanyaan NIM sebagai "Jawaban Unik" supaya enforcement
		// 1-NIM-1-kali-isi di submitResponseFn (lihat §0) aktif.
		if (data.enabled && data.nimQuestionId) {
			const [nimQuestion] = await db
				.select({ id: questions.id, config: questions.config })
				.from(questions)
				.where(eq(questions.id, data.nimQuestionId));

			if (nimQuestion) {
				await db
					.update(questions)
					.set({
						config: { ...(nimQuestion.config as any), uniqueAnswer: true },
					})
					.where(eq(questions.id, data.nimQuestionId));
			}
		}

		return { success: true };
	});

export const updateSurveyCategorySettingsFn = createServerFn({ method: "POST" })
	.validator(
		(data: {
			slug: string;
			name: string;
			requirePeriod: boolean;
			enableConditional: boolean;
		}) => data,
	)
	.handler(async ({ data }) => {
		await assertAdmin();

		await db
			.update(surveyCategories)
			.set({
				name: data.name,
				requirePeriod: data.requirePeriod,
				enableConditional: data.enableConditional,
			})
			.where(eq(surveyCategories.slug, data.slug));

		return { success: true };
	});
