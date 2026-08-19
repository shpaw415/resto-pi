export type DebugLine = {
	at: string;
	scope: string;
	message: string;
};

const MAX = 40;
const listeners = new Set<(lines: DebugLine[]) => void>();
let lines: DebugLine[] = [];

export function debugLog(scope: string, message: string, extra?: unknown) {
	const at = new Date().toLocaleTimeString("fr-CA");
	const line = { at, scope, message };
	lines = [...lines.slice(-(MAX - 1)), line];
	console.info(`[${scope}] ${message}`, extra ?? "");
	for (const listener of listeners) {
		listener(lines);
	}
}

export function getDebugLines() {
	return lines;
}

export function subscribeDebug(listener: (next: DebugLine[]) => void) {
	listeners.add(listener);
	listener(lines);
	return () => {
		listeners.delete(listener);
	};
}
