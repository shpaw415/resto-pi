import type { ChatAuthorKind, ChatMessage } from "../ops/types";

export type LiveCourier = {
	courierUserId: string;
	name: string | null;
	email: string | null;
	lat: number;
	lng: number;
	recordedAt: string;
};

export type LivePeer = {
	userId: string;
	kind: ChatAuthorKind;
	name: string | null;
	restaurantId: string;
};

export type LiveInbound =
	| { type: "position"; lat: number; lng: number }
	| { type: "chat"; body: string }
	| { type: "ping" };

export type LiveOutbound =
	| { type: "snapshot"; couriers: LiveCourier[]; messages: ChatMessage[] }
	| { type: "position"; courier: LiveCourier }
	| { type: "chat"; message: ChatMessage }
	| { type: "error"; error: string }
	| { type: "pong" };

export type LiveSession = {
	ok: true;
	mode: "proxy" | "ticket";
	url: string;
	ticket?: string;
	restaurantId: string;
	authorKind: ChatAuthorKind;
};

export function parseInbound(raw: string): LiveInbound | null {
	try {
		const data = JSON.parse(raw) as LiveInbound;
		if (!data || typeof data !== "object" || !("type" in data)) {
			return null;
		}
		if (data.type === "ping") {
			return data;
		}
		if (data.type === "chat" && typeof data.body === "string") {
			return data;
		}
		if (
			data.type === "position" &&
			typeof data.lat === "number" &&
			typeof data.lng === "number"
		) {
			return data;
		}
		return null;
	} catch {
		return null;
	}
}
