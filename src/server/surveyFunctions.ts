import { createServerFn } from "@tanstack/react-start";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import {
	answers,
	questionOptions,
	questions,
	responses,
	sections,
	surveys,
} from "./db/schema";
import { broadcast } from "./liveRegistry";

// 1. Fetch published surveys for landing page
export const getPublishedSurveysFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const list = await db
			.select({
				id: surveys.id,
				slug: surveys.slug,
				title: surveys.title,
				description: surveys.description,
				category: surveys.category,
				bannerUrl: surveys.bannerUrl,
				createdAt: surveys.createdAt,
			})
			.from(surveys)
			.where(eq(surveys.status, "published"));

		// Fetch question counts for each
		const surveysWithCounts = await Promise.all(
			list.map(async (s) => {
				const [qCount] = await db
					.select({ count: sql<number>`count(*)` })
					.from(questions)
					.where(eq(questions.surveyId, s.id));
				return {
					...s,
					questionCount: qCount?.count || 0,
				};
			}),
		);

		return surveysWithCounts;
	},
);

// 2. Fetch full survey structure by slug (for survey taking)
export const getSurveyDetailsFn = createServerFn({ method: "GET" })
	.validator((slug: string) => slug)
	.handler(async ({ data: slug }) => {
		const [survey] = await db
			.select()
			.from(surveys)
			.where(and(eq(surveys.slug, slug), eq(surveys.status, "published")));

		if (!survey) {
			throw new Error("Survei tidak ditemukan atau belum dipublikasikan");
		}

		const surveySections = await db
			.select()
			.from(sections)
			.where(eq(sections.surveyId, survey.id))
			.orderBy(sections.order);

		const surveyQuestions = await db
			.select()
			.from(questions)
			.where(eq(questions.surveyId, survey.id))
			.orderBy(questions.order);

		const questionIds = surveyQuestions.map((q) => q.id);

		const surveyOptions =
			questionIds.length > 0
				? await db
						.select()
						.from(questionOptions)
						.where(
							sql`${questionOptions.questionId} IN (${sql.join(questionIds, sql`, `)})`,
						)
						.orderBy(questionOptions.order)
				: [];

		return {
			survey,
			sections: surveySections,
			questions: surveyQuestions.map((q) => ({
				...q,
				options: surveyOptions.filter((o) => o.questionId === q.id),
			})),
		};
	});

// 3. Save draft response (when starting a survey)
export const startResponseFn = createServerFn({ method: "POST" })
	.validator((data: { surveyId: number; clientDraftId: string }) => data)
	.handler(async ({ data }) => {
		const [survey] = await db
			.select()
			.from(surveys)
			.where(eq(surveys.id, data.surveyId));
		if (!survey) throw new Error("Survei tidak ditemukan.");

		if (survey.periodValueEnd) {
			const now = new Date();
			let isExpired = false;
			if (survey.periodType === "month") {
				const [year, month] = survey.periodValueEnd.split("-");
				const endOfPeriod = new Date(
					Number(year),
					Number(month),
					0,
					23,
					59,
					59,
					999,
				);
				isExpired = now > endOfPeriod;
			} else {
				const [year, month, day] = survey.periodValueEnd.split("-");
				const endOfPeriod = new Date(
					Number(year),
					Number(month) - 1,
					Number(day),
					23,
					59,
					59,
					999,
				);
				isExpired = now > endOfPeriod;
			}
			if (isExpired) {
				throw new Error(
					"Maaf, periode pengisian kuesioner ini telah berakhir.",
				);
			}
		}

		const [inserted] = await db.insert(responses).values({
			surveyId: data.surveyId,
			status: "started",
			clientDraftId: data.clientDraftId,
			startedAt: new Date(),
		});

		return {
			success: true,
			responseId: (inserted as any).insertId,
		};
	});

// 4. Submit completed response and its answers
export const submitResponseFn = createServerFn({ method: "POST" })
	.validator(
		(data: {
			surveyId: number;
			clientDraftId: string;
			answers: {
				questionId: number;
				valueText?: string | null;
				valueOptionIds?: number[] | null;
				valueGrid?: Record<string, number> | null;
			}[];
		}) => data,
	)
	.handler(async ({ data }) => {
		const [survey] = await db
			.select()
			.from(surveys)
			.where(eq(surveys.id, data.surveyId));
		if (!survey) throw new Error("Survei tidak ditemukan.");

		if (survey.periodValueEnd) {
			const now = new Date();
			let isExpired = false;
			if (survey.periodType === "month") {
				const [year, month] = survey.periodValueEnd.split("-");
				const endOfPeriod = new Date(
					Number(year),
					Number(month),
					0,
					23,
					59,
					59,
					999,
				);
				isExpired = now > endOfPeriod;
			} else {
				const [year, month, day] = survey.periodValueEnd.split("-");
				const endOfPeriod = new Date(
					Number(year),
					Number(month) - 1,
					Number(day),
					23,
					59,
					59,
					999,
				);
				isExpired = now > endOfPeriod;
			}
			if (isExpired) {
				throw new Error(
					"Maaf, kuesioner ini sudah ditutup karena telah berakhir.",
				);
			}
		}

		const uniqueQuestions = await db
			.select({
				id: questions.id,
				title: questions.title,
				config: questions.config,
			})
			.from(questions)
			.where(eq(questions.surveyId, data.surveyId));

		const uniqueQuestionIds = new Set(
			uniqueQuestions
				.filter((q) => (q.config as any)?.uniqueAnswer === true)
				.map((q) => q.id),
		);

		const result = await db.transaction(async (tx) => {
			// Find if response already exists via clientDraftId, or create new
			let responseId: number;

			const [existing] = await tx
				.select()
				.from(responses)
				.where(
					and(
						eq(responses.surveyId, data.surveyId),
						eq(responses.clientDraftId, data.clientDraftId),
					),
				);

			if (existing) {
				responseId = existing.id;
				await tx
					.update(responses)
					.set({
						status: "completed",
						submittedAt: new Date(),
					})
					.where(eq(responses.id, responseId));

				// Delete old answers for this response to overwrite
				await tx.delete(answers).where(eq(answers.responseId, responseId));
			} else {
				const [inserted] = await tx.insert(responses).values({
					surveyId: data.surveyId,
					status: "completed",
					clientDraftId: data.clientDraftId,
					startedAt: new Date(Date.now() - 5 * 60 * 1000), // assume started 5 mins ago
					submittedAt: new Date(),
				});
				responseId = (inserted as any).insertId;
			}

			// Validate unique answers, ignoring current responseId
			for (const a of data.answers) {
				if (!uniqueQuestionIds.has(a.questionId)) continue;
				const value = (a.valueText || "").trim();
				if (!value) continue;

				const [dup] = await tx
					.select({ id: answers.id })
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

				if (dup && dup.id !== undefined) {
					const [dupResponse] = await tx
						.select({ responseId: answers.responseId })
						.from(answers)
						.where(eq(answers.id, dup.id));
					if (!dupResponse || dupResponse.responseId !== responseId) {
						throw new Error(
							"NIM ini sudah pernah mengirimkan jawaban untuk survei ini. Setiap NIM hanya dapat mengisi satu kali.",
						);
					}
				}
			}

			// Insert answers
			const answerRows = data.answers.map((a) => ({
				responseId,
				questionId: a.questionId,
				valueText: a.valueText || null,
				valueOptionIds: a.valueOptionIds || null,
				valueGrid: a.valueGrid || null,
			}));

			if (answerRows.length > 0) {
				await tx.insert(answers).values(answerRows);
			}

			return {
				success: true,
				responseId,
			};
		});

		// Notify live SSE viewers that a response was submitted
		try {
			broadcast(data.surveyId, "answer", { at: Date.now() });
		} catch (err) {
			console.error("Failed to broadcast response notification:", err);
		}

		return result;
	});

// Cache for public landing stats to prevent heavy DB load
const statsCache = ((globalThis as any).__statsCache ||
	((globalThis as any).__statsCache = {
		data: null,
		timestamp: 0,
	})) as {
	data: {
		activeSurveys: number;
		totalParticipants: number;
		avgTimeMinutes: number;
	} | null;
	timestamp: number;
};

export const getPublicLandingStatsFn = createServerFn({
	method: "GET",
}).handler(async () => {
	const now = Date.now();
	if (statsCache.data && now - statsCache.timestamp < 60000) {
		return statsCache.data;
	}

	// 1. Active surveys count
	const [activeCount] = await db
		.select({ count: sql<number>`count(*)` })
		.from(surveys)
		.where(eq(surveys.status, "published"));

	// 2. Total completed responses
	const [completedCount] = await db
		.select({ count: sql<number>`count(*)` })
		.from(responses)
		.where(eq(responses.status, "completed"));

	// 3. Average completion time in seconds
	const [avgDuration] = await db
		.select({
			avgSeconds: sql<number>`coalesce(avg(timestampdiff(SECOND, ${responses.startedAt}, ${responses.submittedAt})), 0)`,
		})
		.from(responses)
		.where(
			and(
				eq(responses.status, "completed"),
				sql`${responses.submittedAt} is not null`,
			),
		);

	// Convert to minutes, default to 5 if 0
	const avgTimeMinutes =
		Math.max(1, Math.round((avgDuration?.avgSeconds || 0) / 60)) || 5;

	const data = {
		activeSurveys: activeCount?.count || 0,
		totalParticipants: completedCount?.count || 0,
		avgTimeMinutes,
	};

	statsCache.data = data;
	statsCache.timestamp = now;

	return data;
});
