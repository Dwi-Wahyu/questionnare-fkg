import { createFileRoute } from "@tanstack/react-router";
import { liveRegistry } from "../../server/liveRegistry";

export const Route = createFileRoute("/api/surveys/live")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				console.log(`[SSE Server] Aggregate presence connection requested. Active aggregate listeners=${liveRegistry.aggregateListeners.size}`);
				let controller: ReadableStreamDefaultController;
				const stream = new ReadableStream({
					start(c) {
						controller = c;
						liveRegistry.aggregateListeners.add(c);

						// Send initial presence data immediately on connection
						const data: Record<number, number> = {};
						for (const [id, count] of liveRegistry.fillerCounts.entries()) {
							if (count > 0) {
								data[id] = count;
							}
						}
						const initialPayload = `event: presence\ndata: ${JSON.stringify(data)}\n\n`;
						try {
							c.enqueue(new TextEncoder().encode(initialPayload));
						} catch {}

						// heartbeat comment tiap 25s agar koneksi tidak ditutup proxy/idle-timeout
						const ping = setInterval(() => {
							try {
								c.enqueue(new TextEncoder().encode(": ping\n\n"));
							} catch {}
						}, 25000);

						request.signal.addEventListener("abort", () => {
							console.log(`[SSE Server] Aggregate presence client aborted`);
							clearInterval(ping);
							liveRegistry.aggregateListeners.delete(c);
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
