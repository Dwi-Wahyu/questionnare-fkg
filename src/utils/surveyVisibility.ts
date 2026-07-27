export interface QuestionVisibilityInput {
	conditionalParentQuestionId: number | null;
	conditionalParentOptionIds: number[] | null;
}

export interface AnswerStateItem {
	valueText?: string | null;
	valueOptionIds?: number[] | null;
	valueGrid?: Record<string, number> | null;
}

/**
 * Checks if a question should be visible based on current answers state.
 */
export function isQuestionVisible(
	q: QuestionVisibilityInput,
	answersState: Record<number, AnswerStateItem>,
): boolean {
	if (!q.conditionalParentQuestionId) {
		return true;
	}

	const parentAns = answersState[q.conditionalParentQuestionId];
	if (!parentAns || !parentAns.valueOptionIds) {
		return false;
	}

	const allowedOptionIds = q.conditionalParentOptionIds || [];
	return parentAns.valueOptionIds.some((optId) =>
		allowedOptionIds.includes(optId),
	);
}

/**
 * Clean up answers that are no longer visible because their parent condition changed.
 */
export function cleanupHiddenAnswers<T extends AnswerStateItem>(
	questions: {
		id: number;
		conditionalParentQuestionId: number | null;
		conditionalParentOptionIds: number[] | null;
	}[],
	answers: Record<number, T>,
): Record<number, T> {
	const newAnswers = { ...answers };
	let changed = true;

	while (changed) {
		changed = false;
		for (const q of questions) {
			if (newAnswers[q.id] && !isQuestionVisible(q, newAnswers)) {
				delete newAnswers[q.id];
				changed = true;
			}
		}
	}

	return newAnswers;
}
