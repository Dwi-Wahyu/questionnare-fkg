// src/server/livePresence.ts
const g = globalThis as any;

const STALE_MS = 12_000; // a filler is considered "gone" if no heartbeat in 12s

interface PresenceStore {
	fillers: Map<number, Map<string, number>>; // surveyId -> clientId -> lastSeen(ms)
	lastActivity: Map<number, number>; // surveyId -> ms timestamp of most recent submitted answer
}

export const presenceStore: PresenceStore =
	g.__presenceStore ||
	(g.__presenceStore = {
		fillers: new Map(),
		lastActivity: new Map(),
	});

function pruneStale(surveyId: number) {
	const map = presenceStore.fillers.get(surveyId);
	if (!map) return;
	const now = Date.now();
	for (const [clientId, lastSeen] of map) {
		if (now - lastSeen > STALE_MS) map.delete(clientId);
	}
	if (map.size === 0) presenceStore.fillers.delete(surveyId);
}

export function heartbeat(surveyId: number, clientId: string) {
	if (!presenceStore.fillers.has(surveyId)) {
		presenceStore.fillers.set(surveyId, new Map());
	}
	presenceStore.fillers.get(surveyId)!.set(clientId, Date.now());
}

export function removeFiller(surveyId: number, clientId: string) {
	presenceStore.fillers.get(surveyId)?.delete(clientId);
}

export function getPresenceCount(surveyId: number): number {
	pruneStale(surveyId);
	return presenceStore.fillers.get(surveyId)?.size ?? 0;
}

export function getAggregatePresence(): Record<number, number> {
	const data: Record<number, number> = {};
	for (const surveyId of Array.from(presenceStore.fillers.keys())) {
		const count = getPresenceCount(surveyId);
		if (count > 0) data[surveyId] = count;
	}
	return data;
}

export function markAnswered(surveyId: number) {
	presenceStore.lastActivity.set(surveyId, Date.now());
}

export function getLastActivity(surveyId: number): number {
	return presenceStore.lastActivity.get(surveyId) ?? 0;
}
