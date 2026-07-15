import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getUserFromSession } from "./auth";
import { db } from "./db";
import {
	answers,
	questionOptions,
	questions,
	reportGenerations,
	responses,
	sections,
	surveys,
	users,
} from "./db/schema";

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
	firstSectionId: number,
) {
	return question.sectionId === firstSectionId;
}

function getFirstSectionId(surveySections: { id: number; order: number }[]) {
	if (surveySections.length === 0) return null;
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
		}) => data,
	)
	.handler(async ({ data }) => {
		await assertAdmin();

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
				periodValue: data.periodValue,
				periodValueEnd: data.periodValueEnd,
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
			.orderBy(desc(responses.submittedAt))
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

// Helper function to compute survey stats (shared between charts tab and report generator)
async function computeSurveyStats(
	surveyId: number,
	userRole: "admin" | "visitor",
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

	// Aggregate statistics per question
	const stats = surveyQuestions.map((q) => {
		const qOptions = surveyOptions.filter((o) => o.questionId === q.id);
		const qAnswers = allAnswers.filter((a) => a.questionId === q.id);
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

	return {
		stats,
		surveyQuestions,
		surveyOptions,
		allAnswers,
		surveySections,
		firstSectionId,
	};
}

// 9. Get detailed response statistics (for the charts)
export const getAdminSurveyAnswersStatsFn = createServerFn({ method: "GET" })
	.validator((surveyId: number) => surveyId)
	.handler(async ({ data: surveyId }) => {
		const user = await assertUser();
		const { stats } = await computeSurveyStats(surveyId, user.role);
		return stats;
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
				id?: number;
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
				options?: {
					id?: number;
					group: "choice" | "row" | "column";
					label: string;
					order: number;
				}[];
			}[];
		}) => data,
	)
	.handler(async ({ data }) => {
		await assertAdmin();

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

			// 2. Process questions
			const sentQuestionIds: number[] = [];

			for (const q of data.questions) {
				const mappedSectionId = sectionIdMap[q.sectionOrder];
				if (!mappedSectionId) continue;

				let questionId: number;

				if (q.id) {
					await tx
						.update(questions)
						.set({
							sectionId: mappedSectionId,
							type: q.type,
							title: q.title,
							description: q.description || "",
							required: q.required,
							order: q.order,
						})
						.where(eq(questions.id, q.id));

					questionId = q.id;
					sentQuestionIds.push(questionId);
				} else {
					const [inserted] = await tx.insert(questions).values({
						surveyId: data.surveyId,
						sectionId: mappedSectionId,
						type: q.type,
						title: q.title,
						description: q.description || "",
						required: q.required,
						order: q.order,
					});
					questionId = (inserted as any).insertId;
					sentQuestionIds.push(questionId);
				}

				// 3. Process question options
				const sentOptionIds: number[] = [];
				if (q.options && q.options.length > 0) {
					for (const opt of q.options) {
						if (opt.id) {
							await tx
								.update(questionOptions)
								.set({
									group: opt.group,
									label: opt.label,
									value: opt.label,
									order: opt.order,
								})
								.where(eq(questionOptions.id, opt.id));
							sentOptionIds.push(opt.id);
						} else {
							const [insertedOpt] = await tx.insert(questionOptions).values({
								questionId,
								group: opt.group,
								label: opt.label,
								value: opt.label,
								order: opt.order,
							});
							sentOptionIds.push((insertedOpt as any).insertId);
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

// 13. Export real row-level CSV data for a survey (Admin only)
// 13. Export real row-level CSV data for a survey (Admin only)
export const exportAdminSurveyResponsesCSVFn = createServerFn({ method: "GET" })
	.validator(
		(data: {
			surveyId: number;
			filterQuestionId?: number;
			filterOptionIds?: number[];
		}) => data,
	)
	.handler(async ({ data }) => {
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

		if (filterQuestionId != null && filterOptionIds && filterOptionIds.length > 0) {
			filterQuestion = surveyQuestions.find((q) => q.id === filterQuestionId);
			filterOptions = surveyOptions.filter(
				(o) => filterOptionIds.includes(o.id) && o.questionId === filterQuestionId,
			);
			if (!filterQuestion || filterOptions.length === 0) {
				throw new Error(
					"Filter pertanyaan/nilai tidak valid untuk survei ini.",
				);
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
				and(
					eq(responses.surveyId, surveyId),
					eq(responses.status, "completed"),
				),
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

		const csvEscape = (val: string | null | undefined) => {
			if (val === null || val === undefined) return '""';
			return `"${String(val).replace(/"/g, '""')}"`;
		};

		// 3. Build CSV summary block (metadata only — no aggregate table)
		const summaryRows: string[] = [];
		summaryRows.push(`Ringkasan Survei — ${survey.title}`);
		summaryRows.push(`Total Respon (Selesai),${filteredResponses.length}`);
		summaryRows.push(`Diekspor pada,${new Date().toISOString()}`);

		if (filterQuestion && filterOptions.length > 0) {
			const labels = filterOptions.map((o) => o.label).join(", ");
			summaryRows.push(
				`Filter Diterapkan,${csvEscape(`${filterQuestion.title} = ${labels}`)}`,
			);
		}

		// 4. Build column plans
		interface ColumnPlan {
			header: string;
			resolve: (r: any, idx: number, ansList: any[]) => string;
		}

		const columnPlans: ColumnPlan[] = [
			{
				header: "No. Respon",
				resolve: (r, idx) => String(idx + 1),
			},
			{
				header: "Timestamp",
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

		for (const q of surveyQuestions) {
			const qOptions = surveyOptions.filter((o) => o.questionId === q.id);
			if (q.type === "grid") {
				const rows = qOptions.filter((o) => o.group === "row");
				const cols = qOptions.filter((o) => o.group === "column");
				for (const r of rows) {
					const headerText = duplicateGridRowLabels.has(r.label)
						? `${q.title} — ${r.label}`
						: r.label;

					columnPlans.push({
						header: headerText,
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
					resolve: (rObj, idx, ansList) => {
						const answer = ansList.find((a) => a.questionId === q.id);
						return answer?.valueText ?? "";
					},
				});
			}
		}

		// 5. Generate CSV strings
		const headerRow = columnPlans.map((cp) => csvEscape(cp.header)).join(",");
		const dataRows = filteredResponses.map((r, idx) => {
			const ansList = answersByResponseId.get(r.id) || [];
			return columnPlans
				.map((cp) => csvEscape(cp.resolve(r, idx, ansList)))
				.join(",");
		});

		const csvContent =
			"\uFEFF" + [...summaryRows, "", headerRow, ...dataRows].join("\n");

		const slugify = (s: string) =>
			s
				.toLowerCase()
				.normalize("NFKD")
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/(^-|-$)/g, "");

		const filenameSuffix =
			filterQuestion && filterOptions.length > 0
				? `_${slugify(filterQuestion.title)}-${filterOptions.map((o) => slugify(o.label)).join("+")}`
				: "";

		return {
			csv: csvContent,
			filename: `responses_survey_${survey.slug}${filenameSuffix}.csv`,
		};
	});

// Helper for scale threshold bucketing
function getScaleBucket(
	avg: number,
	options: { value: string | null; label: string }[],
) {
	const numericOptions = options
		.map((o) => ({
			val: o.value ? Number.parseFloat(o.value) : Number.parseFloat(o.label),
			label: o.label,
		}))
		.filter((o) => !Number.isNaN(o.val))
		.sort((a, b) => a.val - b.val);

	if (numericOptions.length === 0) return "-";
	if (numericOptions.length === 1) return numericOptions[0].label;

	// Find the option with the closest value
	let closestOption = numericOptions[0];
	let minDiff = Math.abs(avg - numericOptions[0].val);

	for (const opt of numericOptions) {
		const diff = Math.abs(avg - opt.val);
		if (diff < minDiff) {
			minDiff = diff;
			closestOption = opt;
		}
	}
	return closestOption.label;
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
			}[];
		}) => data,
	)
	.handler(async ({ data: { surveyId, charts } }) => {
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

		// Fetch all responses and get count
		const [responseCountResult] = await db
			.select({ count: sql<number>`count(*)` })
			.from(responses)
			.where(
				and(
					eq(responses.surveyId, surveyId),
					eq(responses.status, "completed"),
				),
			);
		const responseCount = responseCountResult?.count || 0;

		// 1. Get statistics and metadata
		const {
			stats,
			surveyQuestions,
			surveyOptions,
			allAnswers,
			firstSectionId,
		} = await computeSurveyStats(surveyId, user.role);

		// Compute mean scores for linear_scale & multiple_choice
		const allMeans: {
			questionId: number;
			type: string;
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
						val: o.value
							? Number.parseFloat(o.value)
							: Number.parseFloat(o.label),
						label: o.label,
					}))
					.filter((o) => !Number.isNaN(o.val));

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
						const category = getScaleBucket(mean, qOptions);
						allMeans.push({ questionId: q.id, type: q.type, mean, category });
					}
				}
			}
		}

		// Calculate overall mean of linear scale questions
		const linearScaleMeans = allMeans.filter((m) => m.type === "linear_scale");
		let overallMeanVal = 0;
		let overallCategoryVal = "-";
		if (linearScaleMeans.length > 0) {
			const sum = linearScaleMeans.reduce((acc, m) => acc + m.mean, 0);
			overallMeanVal = sum / linearScaleMeans.length;
			const firstScaleQ = surveyQuestions.find(
				(q) => q.type === "linear_scale",
			);
			if (firstScaleQ) {
				const firstQOptions = surveyOptions.filter(
					(o) => o.questionId === firstScaleQ.id,
				);
				overallCategoryVal = getScaleBucket(overallMeanVal, firstQOptions);
			}
		}

		// 2. Build Groq Prompt
		let userPrompt = `Berikut adalah data hasil survei:\n\n`;
		userPrompt += `Judul Survei: ${survey.title}\n`;
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
					.filter((v): v is string => typeof v === "string" && v.trim() !== "")
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

			const meanItem = allMeans.find((m) => m.questionId === q.id);
			indicatorsData.push({
				label: q.title,
				mean: meanItem ? meanItem.mean.toFixed(2) : "-",
				category: meanItem ? meanItem.category : "-",
			});

			const matchedChart = charts.find((c) => c.questionId === q.id);
			if (matchedChart && matchedChart.imageBase64) {
				chartsData.push({
					label: q.title,
					image: {
						width: 14,
						height: 8,
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
		const filenameVal = `Laporan_Survei_${survey.slug}.docx`;

		// 4. Record the generation only after successful generation
		await db.insert(reportGenerations).values({
			surveyId,
			userId,
			fileBase64: base64Data,
			fileName: filenameVal,
		});

		return {
			base64: base64Data,
			filename: filenameVal,
			cooldownApplied: process.env.ENVIRONMENT !== "DEVELOPMENT",
		};
	});

// 15. Fetch the latest successfully generated report (if any) for a survey (Admin only)
export const getLatestSurveyReportFn = createServerFn({ method: "GET" })
	.validator((surveyId: number) => surveyId)
	.handler(async ({ data: surveyId }) => {
		const user = await assertAdmin();

		const [latest] = await db
			.select({
				id: reportGenerations.id,
				fileName: reportGenerations.fileName,
				fileBase64: reportGenerations.fileBase64,
				generatedAt: reportGenerations.generatedAt,
			})
			.from(reportGenerations)
			.where(eq(reportGenerations.surveyId, surveyId))
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
