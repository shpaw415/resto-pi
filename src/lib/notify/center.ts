export type ActivityKind = "message" | "punch-in" | "alert" | "dispatch";

export type Activity = {
	id: string;
	kind: ActivityKind;
	title: string;
	body: string;
	at: string;
	read: boolean;
};

const MAX = 40;
const SOUND_CANDIDATES = [
	"/notification.mp3",
	"/notification.wav",
	"/assets/notification.mp3",
	"/assets/notification.wav",
];

const listeners = new Set<(items: Activity[]) => void>();
let items: Activity[] = [];
let audio: HTMLAudioElement | null = null;
let soundReady = false;

function emit() {
	for (const listener of listeners) {
		listener(items);
	}
}

function playSound() {
	if (typeof window === "undefined") {
		return;
	}
	if (!audio) {
		audio = new Audio();
		audio.preload = "auto";
		const tryNext = (index: number) => {
			const src = SOUND_CANDIDATES[index];
			if (!src) {
				return;
			}
			audio!.src = src;
			void audio!.play().then(
				() => {
					soundReady = true;
				},
				() => {
					if (!soundReady) {
						tryNext(index + 1);
					}
				},
			);
		};
		tryNext(0);
		return;
	}
	audio.currentTime = 0;
	void audio.play().catch(() => undefined);
}

export function pushActivity(input: Omit<Activity, "id" | "at" | "read">) {
	const next: Activity = {
		...input,
		id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
		at: new Date().toISOString(),
		read: false,
	};
	items = [next, ...items].slice(0, MAX);
	playSound();
	emit();
	return next;
}

export function markActivitiesRead() {
	items = items.map((item) => ({ ...item, read: true }));
	emit();
}

export function unreadCount() {
	return items.filter((item) => !item.read).length;
}

export function subscribeActivities(listener: (next: Activity[]) => void) {
	listeners.add(listener);
	listener(items);
	return () => {
		listeners.delete(listener);
	};
}
