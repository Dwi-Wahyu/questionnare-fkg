import { useEffect, useRef, useState } from "react";
import {
	getLiveStatusFn,
	heartbeatFn,
	leaveFillerFn,
} from "../server/livePresenceFunctions";

const POLL_MS = 4000;
const HEARTBEAT_MS = 5000;

export function useSurveyLive(
	surveyId: number,
	role: "filler" | "viewer",
	onAnswer?: () => void,
) {
	const [presenceCount, setPresenceCount] = useState(0);
	const onAnswerRef = useRef(onAnswer);
	const lastActivityRef = useRef<number | null>(null);
	const clientIdRef = useRef<string>(
		typeof crypto !== "undefined" && crypto.randomUUID
			? crypto.randomUUID()
			: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
	);

	useEffect(() => {
		onAnswerRef.current = onAnswer;
	}, [onAnswer]);

	useEffect(() => {
		if (!surveyId) return;
		let cancelled = false;
		const clientId = clientIdRef.current;
		lastActivityRef.current = null; // reset baseline per survey/role mount

		async function poll() {
			try {
				const status = await getLiveStatusFn({ data: { surveyId } });
				if (cancelled) return;
				setPresenceCount(status.presenceCount);

				if (lastActivityRef.current === null) {
					// First tick after mount: just record the baseline, don't fire onAnswer
					// (avoids refetching immediately on every navigation to the page).
					lastActivityRef.current = status.lastActivityAt;
				} else if (status.lastActivityAt > lastActivityRef.current) {
					lastActivityRef.current = status.lastActivityAt;
					onAnswerRef.current?.();
				}
			} catch (err) {
				console.error(
					`[useSurveyLive] poll failed for surveyId=${surveyId}:`,
					err,
				);
			}
		}

		async function sendHeartbeat() {
			try {
				await heartbeatFn({ data: { surveyId, clientId, role } });
			} catch (err) {
				console.error(
					`[useSurveyLive] heartbeat failed for surveyId=${surveyId}:`,
					err,
				);
			}
		}

		poll();
		const pollInterval = setInterval(poll, POLL_MS);

		let heartbeatInterval: ReturnType<typeof setInterval> | undefined;
		if (role === "filler") {
			sendHeartbeat();
			heartbeatInterval = setInterval(sendHeartbeat, HEARTBEAT_MS);
		}

		return () => {
			cancelled = true;
			clearInterval(pollInterval);
			if (heartbeatInterval) clearInterval(heartbeatInterval);
			if (role === "filler") {
				// Best-effort immediate leave so the badge drops without waiting
				// for the 12s stale timeout. Fire-and-forget on unmount.
				leaveFillerFn({ data: { surveyId, clientId } }).catch(() => {});
			}
		};
	}, [surveyId, role]);

	return presenceCount;
}
