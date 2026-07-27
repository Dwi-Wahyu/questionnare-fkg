// src/server/livePresenceFunctions.ts
import { createServerFn } from "@tanstack/react-start";
import {
	getAggregatePresence,
	getLastActivity,
	getPresenceCount,
	heartbeat,
	removeFiller,
} from "./livePresence";

export const heartbeatFn = createServerFn({ method: "POST" })
	.validator(
		(data: { surveyId: number; clientId: string; role: "filler" | "viewer" }) =>
			data,
	)
	.handler(async ({ data }) => {
		if (data.role === "filler") {
			heartbeat(data.surveyId, data.clientId);
		}
		return { success: true };
	});

export const leaveFillerFn = createServerFn({ method: "POST" })
	.validator((data: { surveyId: number; clientId: string }) => data)
	.handler(async ({ data }) => {
		removeFiller(data.surveyId, data.clientId);
		return { success: true };
	});

export const getLiveStatusFn = createServerFn({ method: "GET" })
	.validator((data: { surveyId: number }) => data)
	.handler(async ({ data }) => {
		return {
			presenceCount: getPresenceCount(data.surveyId),
			lastActivityAt: getLastActivity(data.surveyId),
		};
	});

export const getAggregatePresenceFn = createServerFn({
	method: "GET",
}).handler(async () => {
	return getAggregatePresence();
});
