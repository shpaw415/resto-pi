import { GET as loadLiveSession } from "@api/private/live/session";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { CourierAlertKind } from "../db/schema";
import type { DispatchJob } from "../lib/dispatch/types";
import type { LiveAlert, LiveCourier, LiveOutbound } from "../lib/live/protocol";
import { debugLog } from "../lib/debug/logger";
import { pushActivity } from "../lib/notify/center";
import type { ChatAuthorKind, ChatMessage } from "../lib/ops/types";

type RestoLiveValue = {
	connected: boolean;
	couriers: LiveCourier[];
	messages: ChatMessage[];
	onlineCourierIds: string[];
	alerts: LiveAlert[];
	authorKind: ChatAuthorKind;
	sendChat: (body: string, courierUserId: string) => boolean;
	sendPosition: (lat: number, lng: number) => boolean;
	sendAlert: (kind: CourierAlertKind) => boolean;
	archiveAlerts: () => boolean;
	punchOut: () => boolean;
	punchIn: () => boolean;
	removeCourier: (courierUserId: string) => boolean;
	dispatchJob: DispatchJob | null;
	sendDispatch: (job: DispatchJob) => boolean;
};

const RestoLiveCtx = createContext<RestoLiveValue | null>(null);

function toWsUrl(url: string) {
	if (url.startsWith("ws")) {
		return url;
	}
	const next = new URL(url, window.location.origin);
	next.protocol = next.protocol === "https:" ? "wss:" : "ws:";
	return next.toString();
}

export function RestoLiveProvider({
	restaurantId,
	enabled = true,
	onForceClockOut,
	children,
}: {
	restaurantId?: string;
	enabled?: boolean;
	onForceClockOut?: () => void;
	children: ReactNode;
}) {
	const [connected, setConnected] = useState(false);
	const [couriers, setCouriers] = useState<LiveCourier[]>([]);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [onlineCourierIds, setOnlineCourierIds] = useState<string[]>([]);
	const [alerts, setAlerts] = useState<LiveAlert[]>([]);
	const [authorKind, setAuthorKind] = useState<ChatAuthorKind>("staff");
	const [dispatchJob, setDispatchJob] = useState<DispatchJob | null>(null);
	const selfIdRef = useRef("");
	const socketRef = useRef<WebSocket | null>(null);
	const enabledRef = useRef(enabled);
	enabledRef.current = enabled;

	useEffect(() => {
		if (!enabled) {
			debugLog("ws", "disabled — close");
			socketRef.current?.close();
			socketRef.current = null;
			setConnected(false);
			return;
		}
		let closed = false;
		let retry: number | undefined;
		let socket: WebSocket | null = null;

		async function connect() {
			if (!enabledRef.current) {
				return;
			}
			debugLog("ws", `session restaurant=${restaurantId || "auto"}`);
			const session = await loadLiveSession(restaurantId ?? "");
			if (closed) {
				return;
			}
			if (!session.ok) {
				debugLog("ws", `session échec: ${session.error}`);
				return;
			}
			const url = toWsUrl(session.url);
			debugLog("ws", `open ${session.mode} ${url.split("?")[0]}`);
			setAuthorKind(session.authorKind);
			selfIdRef.current = session.userId;
			socket = new WebSocket(url);
			socketRef.current = socket;
			socket.onopen = () => {
				debugLog("ws", "connected");
				if (!closed) {
					setConnected(true);
				}
			};
			socket.onerror = () => {
				debugLog("ws", "error");
			};
			socket.onmessage = (event) => {
				const payload = JSON.parse(String(event.data)) as LiveOutbound;
				if (payload.type === "snapshot") {
					setCouriers(payload.couriers);
					setMessages(payload.messages);
					setAlerts(payload.alerts);
					setOnlineCourierIds(payload.onlineCourierIds);
					return;
				}
				if (payload.type === "presence") {
					setOnlineCourierIds(payload.onlineCourierIds);
					return;
				}
				if (payload.type === "position") {
					setCouriers((current) => {
						const next = current.filter(
							(item) => item.courierUserId !== payload.courier.courierUserId,
						);
						next.push(payload.courier);
						return next;
					});
					return;
				}
				if (payload.type === "chat") {
					setMessages((current) =>
						current.some((item) => item.id === payload.message.id)
							? current
							: [...current, payload.message],
					);
					if (payload.message.authorUserId !== selfIdRef.current) {
						pushActivity({
							kind: "message",
							title: "Nouveau message",
							body:
								payload.message.body.slice(0, 80) ||
								payload.message.authorName ||
								"Message",
						});
					}
					return;
				}
				if (payload.type === "alert") {
					setAlerts((current) =>
						current.some((item) => item.id === payload.alert.id)
							? current
							: [payload.alert, ...current],
					);
					if (payload.alert.courierUserId !== selfIdRef.current) {
						pushActivity({
							kind: "alert",
							title: payload.alert.label,
							body: payload.alert.courierName || "Livreur",
						});
					}
					return;
				}
				if (payload.type === "dispatch") {
					setDispatchJob(payload.job);
					if (payload.actorUserId !== selfIdRef.current) {
						pushActivity({
							kind: "dispatch",
							title: `Course ${payload.job.status}`,
							body:
								payload.job.address ||
								payload.job.phone ||
								payload.job.restaurantName,
						});
					}
					return;
				}
				if (payload.type === "punch-in") {
					if (payload.courier.userId !== selfIdRef.current) {
						pushActivity({
							kind: "punch-in",
							title: "Livreur en service",
							body: payload.courier.name || "Un livreur a pointé",
						});
					}
					return;
				}
				if (payload.type === "alerts-archived") {
					setAlerts((current) =>
						current.filter((item) => !payload.ids.includes(item.id)),
					);
					return;
				}
				if (payload.type === "courier-removed") {
					setCouriers((current) =>
						current.filter(
							(item) => item.courierUserId !== payload.courierUserId,
						),
					);
					if (payload.courierUserId === selfIdRef.current) {
						onForceClockOut?.();
					}
				}
			};
			socket.onclose = (event) => {
				debugLog("ws", `close ${event.code} ${event.reason || ""}`);
				setConnected(false);
				socketRef.current = null;
				if (!closed && enabledRef.current) {
					retry = window.setTimeout(() => void connect(), 2000);
				}
			};
		}

		void connect();
		return () => {
			closed = true;
			if (retry) {
				window.clearTimeout(retry);
			}
			socket?.close();
			socketRef.current = null;
		};
	}, [restaurantId, enabled]);

	const sendChat = useCallback((body: string, courierUserId: string) => {
		const socket = socketRef.current;
		if (
			!socket ||
			socket.readyState !== WebSocket.OPEN ||
			!body.trim() ||
			!courierUserId
		) {
			return false;
		}
		socket.send(JSON.stringify({ type: "chat", body, courierUserId }));
		return true;
	}, []);

	const sendAlert = useCallback((kind: CourierAlertKind) => {
		const socket = socketRef.current;
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			return false;
		}
		socket.send(JSON.stringify({ type: "alert", kind }));
		return true;
	}, []);

	const archiveAlerts = useCallback(() => {
		const socket = socketRef.current;
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			return false;
		}
		socket.send(JSON.stringify({ type: "archive-alerts" }));
		return true;
	}, []);

	const punchIn = useCallback(() => {
		const socket = socketRef.current;
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			return false;
		}
		socket.send(JSON.stringify({ type: "punch-in" }));
		return true;
	}, []);

	const punchOut = useCallback(() => {
		const socket = socketRef.current;
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			return false;
		}
		socket.send(JSON.stringify({ type: "punch-out" }));
		return true;
	}, []);

	const removeCourier = useCallback((courierUserId: string) => {
		const socket = socketRef.current;
		if (!socket || socket.readyState !== WebSocket.OPEN || !courierUserId) {
			return false;
		}
		socket.send(JSON.stringify({ type: "remove-courier", courierUserId }));
		return true;
	}, []);

	const sendDispatch = useCallback((job: DispatchJob) => {
		const socket = socketRef.current;
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			return false;
		}
		socket.send(
			JSON.stringify({
				type: "dispatch",
				job,
				actorUserId: selfIdRef.current,
			}),
		);
		return true;
	}, []);

	const sendPosition = useCallback((lat: number, lng: number) => {
		const socket = socketRef.current;
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			return false;
		}
		socket.send(JSON.stringify({ type: "position", lat, lng }));
		return true;
	}, []);

	const value = useMemo(
		() => ({
			connected,
			couriers,
			messages,
			onlineCourierIds,
			alerts,
			authorKind,
			sendChat,
			sendPosition,
			sendAlert,
			archiveAlerts,
			punchOut,
			punchIn,
			removeCourier,
			dispatchJob,
			sendDispatch,
		}),
		[
			connected,
			couriers,
			messages,
			onlineCourierIds,
			alerts,
			authorKind,
			sendChat,
			sendPosition,
			sendAlert,
			archiveAlerts,
			punchOut,
			punchIn,
			removeCourier,
			dispatchJob,
			sendDispatch,
		],
	);

	return (
		<RestoLiveCtx.Provider value={value}>{children}</RestoLiveCtx.Provider>
	);
}

export function useRestoLive() {
	const ctx = useContext(RestoLiveCtx);
	if (!ctx) {
		throw new Error("useRestoLive hors RestoLiveProvider");
	}
	return ctx;
}

export function useOptionalRestoLive() {
	return useContext(RestoLiveCtx);
}
