import type { CourierAlertKind } from "../../db/schema";
import type { DispatchJob } from "../dispatch/types";
import type { ChatAuthorKind, ChatMessage } from "../ops/types";

export type LiveAlert = {
	id: string;
	kind: CourierAlertKind;
	label: string;
	courierUserId: string;
	courierName: string | null;
	createdAt: string;
};

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
	| { type: "chat"; body: string; courierUserId: string }
	| { type: "alert"; kind: CourierAlertKind }
	| { type: "archive-alerts" }
	| { type: "punch-out" }
	| { type: "punch-in" }
	| { type: "dispatch"; job: DispatchJob }
	| { type: "remove-courier"; courierUserId: string }
	| { type: "ping" };

export type LiveOutbound =
	| {
			type: "snapshot";
			couriers: LiveCourier[];
			messages: ChatMessage[];
			alerts: LiveAlert[];
			onlineCourierIds: string[];
	  }
	| { type: "position"; courier: LiveCourier }
	| { type: "chat"; message: ChatMessage }
	| { type: "alert"; alert: LiveAlert }
	| { type: "alerts-archived"; ids: string[] }
	| { type: "presence"; onlineCourierIds: string[] }
	| { type: "courier-removed"; courierUserId: string }
	| {
			type: "punch-in";
			courier: { userId: string; name: string | null };
	  }
	| { type: "dispatch"; job: DispatchJob }
	| { type: "error"; error: string }
	| { type: "pong" };

export type LiveSession = {
	ok: true;
	mode: "proxy" | "ticket";
	url: string;
	ticket?: string;
	restaurantId: string;
	authorKind: ChatAuthorKind;
	userId: string;
};

export function parseInbound(raw: string): LiveInbound | null {
	try {
		const data = JSON.parse(raw) as LiveInbound;
		if (!data || typeof data !== "object" || !("type" in data)) {
			return null;
		}
		if (
			data.type === "ping" ||
			data.type === "archive-alerts" ||
			data.type === "punch-out" ||
			data.type === "punch-in"
		) {
			return data;
		}
		if (data.type === "remove-courier" && typeof data.courierUserId === "string") {
			return data;
		}
		if (data.type === "dispatch" && data.job && typeof data.job.id === "string") {
			return data;
		}
		if (data.type === "alert" && typeof data.kind === "string") {
			return data;
		}
		if (
			data.type === "chat" &&
			typeof data.body === "string" &&
			typeof data.courierUserId === "string"
		) {
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
