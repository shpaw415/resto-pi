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
import type { LiveAlert, LiveCourier, LiveOutbound } from "../lib/live/protocol";
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
	children,
}: {
	restaurantId?: string;
	children: ReactNode;
}) {
	const [connected, setConnected] = useState(false);
	const [couriers, setCouriers] = useState<LiveCourier[]>([]);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [onlineCourierIds, setOnlineCourierIds] = useState<string[]>([]);
	const [alerts, setAlerts] = useState<LiveAlert[]>([]);
	const [authorKind, setAuthorKind] = useState<ChatAuthorKind>("staff");
	const socketRef = useRef<WebSocket | null>(null);

	useEffect(() => {
		let closed = false;
		let retry: number | undefined;
		let socket: WebSocket | null = null;

		async function connect() {
			const session = await loadLiveSession(restaurantId ?? "");
			if (closed || !session.ok) {
				return;
			}
			setAuthorKind(session.authorKind);
			socket = new WebSocket(toWsUrl(session.url));
			socketRef.current = socket;
			socket.onopen = () => {
				if (!closed) {
					setConnected(true);
				}
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
					return;
				}
				if (payload.type === "alert") {
					setAlerts((current) =>
						current.some((item) => item.id === payload.alert.id)
							? current
							: [payload.alert, ...current],
					);
					return;
				}
				if (payload.type === "alerts-archived") {
					setAlerts((current) =>
						current.filter((item) => !payload.ids.includes(item.id)),
					);
				}
			};
			socket.onclose = () => {
				setConnected(false);
				socketRef.current = null;
				if (!closed) {
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
	}, [restaurantId]);

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
