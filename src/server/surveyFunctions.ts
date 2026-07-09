import { createServerFn } from "@tanstack/react-start";
import { eq, and, sql } from "drizzle-orm";
import { db } from "./db";
import {
	surveys,
	sections,
	questions,
	questionOptions,
	responses,
	answers,
} from "./db/schema";

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
		return await db.transaction(async (tx) => {
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
	});
