import { useEffect, useRef, useState } from "react";

export function useSurveyLive(
	surveyId: number,
	role: "filler" | "viewer",
	onAnswer?: () => void,
) {
	const [presenceCount, setPresenceCount] = useState(0);
	const onAnswerRef = useRef(onAnswer);

	// Keep the ref updated with the latest callback
	useEffect(() => {
		onAnswerRef.current = onAnswer;
	}, [onAnswer]);

	useEffect(() => {
		if (!surveyId) return;
		console.log(
			`[useSurveyLive Client] Connecting to SSE for surveyId=${surveyId}, role=${role}`,
		);
		const es = new EventSource(`/api/surveys/${surveyId}/live?role=${role}`);

		es.onopen = () => {
			console.log(
				`[useSurveyLive Client] Connection opened for surveyId=${surveyId}, role=${role}`,
			);
		};

		es.onerror = (err) => {
			console.error(
				`[useSurveyLive Client] Connection error for surveyId=${surveyId}:`,
				err,
			);
		};

		es.addEventListener("presence", (e) => {
			try {
				const data = JSON.parse(e.data);
				console.log(
					`[useSurveyLive Client] Presence count update for surveyId=${surveyId}:`,
					data.count,
				);
				setPresenceCount(data.count);
			} catch (err) {
				console.error("Error parsing presence event data:", err);
			}
		});

		let debounceTimer: ReturnType<typeof setTimeout> | null = null;
		es.addEventListener("answer", (e) => {
			console.log(
				`[useSurveyLive Client] Answer event received for surveyId=${surveyId}`,
			);
			if (debounceTimer) clearTimeout(debounceTimer);
			// Merge burst submissions to 1 refetch every 2.5 seconds
			debounceTimer = setTimeout(() => {
				console.log(
					`[useSurveyLive Client] Triggering onAnswer callback for surveyId=${surveyId}`,
				);
				onAnswerRef.current?.();
			}, 2500);
		});

		return () => {
			console.log(
				`[useSurveyLive Client] Closing EventSource for surveyId=${surveyId}, role=${role}`,
			);
			if (debounceTimer) clearTimeout(debounceTimer);
			es.close(); // Crucial to prevent memory leaks
		};
	}, [surveyId, role]);

	return presenceCount;
}
