export type DebugLine = {
	at: string;
	scope: string;
	message: string;
};

const KEY = "resto-pi-devmode";
const MAX = 40;
const listeners = new Set<(lines: DebugLine[]) => void>();
const modeListeners = new Set<(on: boolean) => void>();
let lines: DebugLine[] = [];
let enabled = false;

function readStored() {
	try {
		return window.localStorage.getItem(KEY) === "1";
	} catch {
		return false;
	}
}

export function isDebugEnabled() {
	return enabled;
}

export function setDebugEnabled(next: boolean) {
	enabled = next;
	try {
		window.localStorage.setItem(KEY, next ? "1" : "0");
	} catch {
		// ignore
	}
	for (const listener of modeListeners) {
		listener(enabled);
	}
}

export function hydrateDebugMode() {
	enabled = readStored();
	return enabled;
}

export function debugLog(scope: string, message: string, extra?: unknown) {
	if (!enabled) {
		return;
	}
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

export function subscribeDebugMode(listener: (on: boolean) => void) {
	modeListeners.add(listener);
	listener(enabled);
	return () => {
		modeListeners.delete(listener);
	};
}
