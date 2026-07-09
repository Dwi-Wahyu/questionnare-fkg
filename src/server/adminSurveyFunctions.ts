import { createServerFn } from "@tanstack/react-start";
import { eq, and, sql, gte, desc, inArray } from "drizzle-orm";
import { db } from "./db";
import {
	surveys,
	sections,
	questions,
	questionOptions,
	responses,
	answers,
	users,
} from "./db/schema";
import { getUserFromSession } from "./auth";

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
		}) => data,
	)
	.handler(async ({ data }) => {
		const user = await assertAdmin();

		const [inserted] = await db.insert(surveys).values({
			title: data.title,
			slug: data.slug,
			category: data.category,
			description: data.description || "",
			bannerUrl: data.bannerUrl || null,
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
		}) => data,
	)
	.handler(async ({ data }) => {
		await assertAdmin();

		await db
			.update(surveys)
			.set({
				title: data.title,
				slug: data.slug,
				category: data.category,
				status: data.status,
				description: data.description || "",
				bannerUrl: data.bannerUrl || null,
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
		await assertUser();

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
					nama: namaAns?.valueText || "Anonim",
					nim: nimAns?.valueText || "-",
				};
			}),
		);

		return {
			responses: listWithDetails,
			totalCount: totalCount?.count || 0,
		};
	});

// 9. Get detailed response statistics (for the charts)
export const getAdminSurveyAnswersStatsFn = createServerFn({ method: "GET" })
	.validator((surveyId: number) => surveyId)
	.handler(async ({ data: surveyId }) => {
		await assertUser();

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

			if (q.type === "grid") {
				// Grid matrix aggregation: rowId -> colId -> count
				const rows = qOptions.filter((o) => o.group === "row");
				const cols = qOptions.filter((o) => o.group === "column");

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
				// Option selection aggregation: optionLabel -> count
				const optionCounts: Record<string, number> = {};
				qOptions.forEach((o) => {
					optionCounts[o.label] = 0;
				});

				let totalAnswersCount = 0;

				qAnswers.forEach((ans) => {
					const optIds = ans.valueOptionIds as number[] | null;
					if (optIds && optIds.length > 0) {
						optIds.forEach((id) => {
							const opt = qOptions.find((o) => o.id === id);
							if (opt) {
								optionCounts[opt.label] = (optionCounts[opt.label] || 0) + 1;
								totalAnswersCount++;
							}
						});
					}
				});

				return {
					questionId: q.id,
					title: q.title,
					type: q.type,
					data: Object.entries(optionCounts).map(([label, count]) => ({
						label,
						count,
						percentage:
							totalAnswersCount > 0
								? Math.round((count / totalAnswersCount) * 100)
								: 0,
					})),
				};
			} else {
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

			const sentSectionIds = data.sections
				.map((s) => s.id)
				.filter((id): id is number => id !== undefined);
			const sectionsToDelete = dbSections
				.map((s) => s.id)
				.filter((id) => !sentSectionIds.includes(id));

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
