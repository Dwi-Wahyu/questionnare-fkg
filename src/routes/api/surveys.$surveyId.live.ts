import { createFileRoute } from "@tanstack/react-router";
import {
	broadcast,
	broadcastAggregate,
	liveRegistry,
} from "../../server/liveRegistry";

export const Route = createFileRoute("/api/surveys/$surveyId/live")({
	server: {
		handlers: {
			GET: async ({ params, request }) => {
				const surveyId = Number(params.surveyId);
				const role = new URL(request.url).searchParams.get("role"); // "filler" | "viewer"
				console.log(
					`[SSE Server] Connection requested for surveyId=${surveyId}, role=${role}`,
				);

				let controller: ReadableStreamDefaultController;
				const stream = new ReadableStream({
					start(c) {
						controller = c;
						if (!liveRegistry.channels.has(surveyId)) {
							liveRegistry.channels.set(surveyId, new Set());
						}
						liveRegistry.channels.get(surveyId)!.add(c);
						console.log(
							`[SSE Server] Added subscriber for surveyId=${surveyId}, role=${role}. Total subs=${liveRegistry.channels.get(surveyId)?.size}`,
						);

						if (role === "filler") {
							liveRegistry.fillerCounts.set(
								surveyId,
								(liveRegistry.fillerCounts.get(surveyId) ?? 0) + 1,
							);
							broadcast(surveyId, "presence", {
								count: liveRegistry.fillerCounts.get(surveyId),
							});
							broadcastAggregate();
						}

						// heartbeat comment tiap 25s agar koneksi tidak ditutup proxy/idle-timeout
						const ping = setInterval(() => {
							try {
								c.enqueue(new TextEncoder().encode(": ping\n\n"));
							} catch {}
						}, 25000);

						request.signal.addEventListener("abort", () => {
							console.log(
								`[SSE Server] Client aborted connection for surveyId=${surveyId}, role=${role}`,
							);
							clearInterval(ping);
							liveRegistry.channels.get(surveyId)?.delete(c);
							if (role === "filler") {
								liveRegistry.fillerCounts.set(
									surveyId,
									Math.max(
										0,
										(liveRegistry.fillerCounts.get(surveyId) ?? 1) - 1,
									),
								);
								broadcast(surveyId, "presence", {
									count: liveRegistry.fillerCounts.get(surveyId),
								});
								broadcastAggregate();
							}
							try {
								c.close();
							} catch {}
						});
					},
				});

				return new Response(stream, {
					headers: {
						"Content-Type": "text/event-stream",
						"Cache-Control": "no-cache",
						Connection: "keep-alive",
					},
				});
			},
		},
	},
});

// dipanggil dari submitResponseFn setelah insert sukses
export function notifySurveyAnswered(surveyId: number) {
	console.log(
		`[SSE Server] notifySurveyAnswered called for surveyId=${surveyId}`,
	);
	broadcast(surveyId, "answer", { at: Date.now() });
}
