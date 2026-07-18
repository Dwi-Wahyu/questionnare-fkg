const g = globalThis as any;

export interface LiveRegistry {
	channels: Map<number, Set<ReadableStreamDefaultController>>;
	fillerCounts: Map<number, number>;
	aggregateListeners: Set<ReadableStreamDefaultController>;
}

export const liveRegistry: LiveRegistry = g.__liveRegistry || (g.__liveRegistry = {
	channels: new Map(),
	fillerCounts: new Map(),
	aggregateListeners: new Set(),
});

export function broadcast(surveyId: number, event: string, data: unknown) {
	const subs = liveRegistry.channels.get(surveyId);
	console.log(`[SSE Server] Broadcasting event="${event}" to surveyId=${surveyId}, activeSubs=${subs?.size || 0}`);
	if (subs) {
		const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
		for (const c of subs) {
			try {
				c.enqueue(new TextEncoder().encode(payload));
			} catch {
				/* controller already closed */
			}
		}
	}
}

export function broadcastAggregate() {
	const data: Record<number, number> = {};
	for (const [id, count] of liveRegistry.fillerCounts.entries()) {
		if (count > 0) {
			data[id] = count;
		}
	}
	const payload = `event: presence\ndata: ${JSON.stringify(data)}\n\n`;
	console.log(`[SSE Server] Broadcasting aggregate presence, activeListenersCount=${liveRegistry.aggregateListeners.size}`);
	for (const c of liveRegistry.aggregateListeners) {
		try {
			c.enqueue(new TextEncoder().encode(payload));
		} catch {
			/* controller already closed */
		}
	}
}
