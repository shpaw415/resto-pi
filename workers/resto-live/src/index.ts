import { DurableObject } from "cloudflare:workers";
import type { ChatMessage } from "../../../src/lib/ops/types";
import type { LiveInbound, LiveOutbound, LivePeer } from "../../../src/lib/live/protocol";
import { parseInbound } from "../../../src/lib/live/protocol";
import { verifyLiveTicket } from "../../../src/lib/live/ticket";
import type { LiveAlert, LiveCourier } from "../../../src/lib/live/protocol";
import {
	COURIER_ALERT_KIND_SET,
	COURIER_ALERT_LABELS,
} from "../../../src/lib/tracking/labels";

export interface LiveEnv {
	RESTO_LIVE: DurableObjectNamespace<RestaurantLive>;
	DB: D1Database;
	AUTH_SECRET: string;
}

type SocketState = LivePeer;

function newId(prefix: string) {
	return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

function jsonSend(ws: WebSocket, payload: LiveOutbound) {
	ws.send(JSON.stringify(payload));
}

export class RestaurantLive extends DurableObject<LiveEnv> {
	constructor(ctx: DurableObjectState, env: LiveEnv) {
		super(ctx, env);
		this.ctx.blockConcurrencyWhile(async () => {
			this.ctx.storage.sql.exec(`
				CREATE TABLE IF NOT EXISTS positions (
					courier_user_id TEXT PRIMARY KEY,
					name TEXT,
					email TEXT,
					lat REAL NOT NULL,
					lng REAL NOT NULL,
					recorded_at TEXT NOT NULL
				);
				CREATE TABLE IF NOT EXISTS messages (
					id TEXT PRIMARY KEY,
					courier_user_id TEXT NOT NULL DEFAULT '',
					author_user_id TEXT NOT NULL,
					author_kind TEXT NOT NULL,
					author_name TEXT,
					body TEXT NOT NULL,
					created_at TEXT NOT NULL
				);
			`);
			try {
				this.ctx.storage.sql.exec(
					"ALTER TABLE messages ADD COLUMN courier_user_id TEXT NOT NULL DEFAULT ''",
				);
			} catch {
				// already migrated
			}
		});
	}

	async fetch(request: Request): Promise<Response> {
		if (request.headers.get("Upgrade") !== "websocket") {
			return new Response("Expected websocket", { status: 426 });
		}
		const peer = this.readPeer(request);
		if (!peer) {
			return new Response("Unauthorized", { status: 401 });
		}
		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);
		this.ctx.acceptWebSocket(server);
		server.serializeAttachment(peer);
		this.ctx.waitUntil(this.pushSnapshot(server));
		this.broadcastPresence();
		return new Response(null, { status: 101, webSocket: client });
	}

	async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
		if (typeof raw !== "string") {
			return;
		}
		const peer = ws.deserializeAttachment() as SocketState | null;
		const inbound = parseInbound(raw);
		if (!peer || !inbound) {
			jsonSend(ws, { type: "error", error: "Message invalide." });
			return;
		}
		if (inbound.type === "ping") {
			jsonSend(ws, { type: "pong" });
			return;
		}
		if (inbound.type === "position") {
			if (peer.kind !== "courier") {
				jsonSend(ws, { type: "error", error: "Position réservée au livreur." });
				return;
			}
			await this.handlePosition(peer, inbound);
			return;
		}
		if (inbound.type === "alert") {
			if (peer.kind !== "courier") {
				jsonSend(ws, { type: "error", error: "Alerte réservée au livreur." });
				return;
			}
			await this.handleAlert(peer, inbound.kind);
			return;
		}
		if (inbound.type === "archive-alerts") {
			if (peer.kind !== "staff") {
				jsonSend(ws, { type: "error", error: "Archivage réservé au resto." });
				return;
			}
			await this.handleArchive(peer);
			return;
		}
		if (inbound.type === "punch-out") {
			if (peer.kind !== "courier") {
				return;
			}
			await this.removeCourier(peer.restaurantId, peer.userId);
			return;
		}
		if (inbound.type === "remove-courier") {
			if (peer.kind !== "staff") {
				jsonSend(ws, { type: "error", error: "Retrait réservé au resto." });
				return;
			}
			await this.removeCourier(peer.restaurantId, inbound.courierUserId);
			return;
		}
		await this.handleChat(peer, inbound);
	}

	async webSocketClose(ws: WebSocket, code: number, reason: string) {
		ws.close(code, reason);
		this.broadcastPresence();
	}

	private readPeer(request: Request): LivePeer | null {
		const header = request.headers.get("x-resto-live");
		if (header) {
			try {
				return JSON.parse(header) as LivePeer;
			} catch {
				return null;
			}
		}
		return null;
	}

	private async pushSnapshot(ws: WebSocket) {
		const peer = ws.deserializeAttachment() as SocketState | null;
		jsonSend(ws, {
			type: "snapshot",
			couriers: this.listPositions(),
			messages: await this.listMessages(peer),
			alerts: await this.listAlerts(peer),
			onlineCourierIds: this.onlineCourierIds(),
		});
	}

	private onlineCourierIds(): string[] {
		const ids = new Set<string>();
		for (const socket of this.ctx.getWebSockets()) {
			const peer = socket.deserializeAttachment() as SocketState | null;
			if (peer?.kind === "courier") {
				ids.add(peer.userId);
			}
		}
		return [...ids];
	}

	private broadcastPresence() {
		this.broadcast({
			type: "presence",
			onlineCourierIds: this.onlineCourierIds(),
		});
	}

	private listPositions(): LiveCourier[] {
		return this.ctx.storage.sql
			.exec<{
				courier_user_id: string;
				name: string | null;
				email: string | null;
				lat: number;
				lng: number;
				recorded_at: string;
			}>("SELECT * FROM positions")
			.toArray()
			.map((row) => ({
				courierUserId: row.courier_user_id,
				name: row.name,
				email: row.email,
				lat: row.lat,
				lng: row.lng,
				recordedAt: row.recorded_at,
			}));
	}

	private async listMessages(peer: SocketState | null): Promise<ChatMessage[]> {
		const local = this.ctx.storage.sql
			.exec<{
				id: string;
				courier_user_id: string;
				author_user_id: string;
				author_kind: string;
				author_name: string | null;
				body: string;
				created_at: string;
			}>("SELECT * FROM messages ORDER BY created_at DESC LIMIT 200")
			.toArray()
			.reverse()
			.map((row) => ({
				id: row.id,
				courierUserId: row.courier_user_id,
				authorUserId: row.author_user_id,
				authorKind: row.author_kind === "courier" ? "courier" as const : "staff" as const,
				authorName: row.author_name,
				body: row.body,
				createdAt: row.created_at,
			}))
			.filter((row) =>
				peer?.kind === "courier" ? row.courierUserId === peer.userId : Boolean(row.courierUserId),
			);
		if (local.length > 0 || !peer) {
			return local.slice(-80);
		}
		const sql =
			peer.kind === "courier"
				? `SELECT m.id, m.courier_user_id, m.author_user_id, m.author_kind, m.body, m.created_at,
					u.name as author_name, u.email as author_email
				 FROM staff_courier_messages m
				 LEFT JOIN users u ON u.id = m.author_user_id
				 WHERE m.restaurant_id = ? AND m.courier_user_id = ?
				 ORDER BY m.created_at DESC
				 LIMIT 80`
				: `SELECT m.id, m.courier_user_id, m.author_user_id, m.author_kind, m.body, m.created_at,
					u.name as author_name, u.email as author_email
				 FROM staff_courier_messages m
				 LEFT JOIN users u ON u.id = m.author_user_id
				 WHERE m.restaurant_id = ?
				 ORDER BY m.created_at DESC
				 LIMIT 80`;
		const query =
			peer.kind === "courier"
				? this.env.DB.prepare(sql).bind(peer.restaurantId, peer.userId)
				: this.env.DB.prepare(sql).bind(peer.restaurantId);
		const rows = await query.all<{
			id: string;
			courier_user_id: string;
			author_user_id: string;
			author_kind: string;
			body: string;
			created_at: string;
			author_name: string | null;
			author_email: string | null;
		}>();
		const messages = (rows.results ?? []).reverse().map((row) => ({
			id: row.id,
			courierUserId: row.courier_user_id,
			authorUserId: row.author_user_id,
			authorKind: row.author_kind === "courier" ? "courier" as const : "staff" as const,
			authorName: row.author_name ?? row.author_email,
			body: row.body,
			createdAt: row.created_at,
		}));
		for (const message of messages) {
			this.ctx.storage.sql.exec(
				`INSERT OR IGNORE INTO messages
				 (id, courier_user_id, author_user_id, author_kind, author_name, body, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`,
				message.id,
				message.courierUserId,
				message.authorUserId,
				message.authorKind,
				message.authorName,
				message.body,
				message.createdAt,
			);
		}
		return messages;
	}

	private async handlePosition(peer: LivePeer, inbound: Extract<LiveInbound, { type: "position" }>) {
		if (
			!Number.isFinite(inbound.lat) ||
			!Number.isFinite(inbound.lng) ||
			inbound.lat < -90 ||
			inbound.lat > 90 ||
			inbound.lng < -180 ||
			inbound.lng > 180
		) {
			return;
		}
		const recordedAt = new Date().toISOString();
		this.ctx.storage.sql.exec(
			`INSERT INTO positions (courier_user_id, name, email, lat, lng, recorded_at)
			 VALUES (?, ?, ?, ?, ?, ?)
			 ON CONFLICT(courier_user_id) DO UPDATE SET
			 	name = excluded.name,
			 	lat = excluded.lat,
			 	lng = excluded.lng,
			 	recorded_at = excluded.recorded_at`,
			peer.userId,
			peer.name,
			null,
			inbound.lat,
			inbound.lng,
			recordedAt,
		);
		await this.env.DB.prepare(
			`INSERT INTO courier_positions
			 (id, restaurant_id, courier_user_id, lat, lng, recorded_at)
			 VALUES (?, ?, ?, ?, ?, ?)`,
		)
			.bind(
				newId("posi"),
				peer.restaurantId,
				peer.userId,
				inbound.lat,
				inbound.lng,
				recordedAt,
			)
			.run();
		this.broadcast({
			type: "position",
			courier: {
				courierUserId: peer.userId,
				name: peer.name,
				email: null,
				lat: inbound.lat,
				lng: inbound.lng,
				recordedAt,
			},
		});
	}

	private async handleChat(
		peer: LivePeer,
		inbound: Extract<LiveInbound, { type: "chat" }>,
	) {
		const body = inbound.body.trim();
		const courierUserId =
			peer.kind === "courier" ? peer.userId : inbound.courierUserId;
		if (!body || body.length > 1000 || !courierUserId) {
			return;
		}
		const id = newId("msg");
		const createdAt = new Date().toISOString();
		this.ctx.storage.sql.exec(
			`INSERT INTO messages
			 (id, courier_user_id, author_user_id, author_kind, author_name, body, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			id,
			courierUserId,
			peer.userId,
			peer.kind,
			peer.name,
			body,
			createdAt,
		);
		await this.env.DB.prepare(
			`INSERT INTO staff_courier_messages
			 (id, restaurant_id, courier_user_id, author_user_id, author_kind, body, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		)
			.bind(
				id,
				peer.restaurantId,
				courierUserId,
				peer.userId,
				peer.kind,
				body,
				createdAt,
			)
			.run();
		this.sendToThread(courierUserId, {
			type: "chat",
			message: {
				id,
				courierUserId,
				authorUserId: peer.userId,
				authorKind: peer.kind,
				authorName: peer.name,
				body,
				createdAt,
			},
		});
	}

	private sendToThread(courierUserId: string, payload: LiveOutbound) {
		const encoded = JSON.stringify(payload);
		for (const socket of this.ctx.getWebSockets()) {
			const peer = socket.deserializeAttachment() as SocketState | null;
			if (!peer) {
				continue;
			}
			if (peer.kind === "staff" || peer.userId === courierUserId) {
				socket.send(encoded);
			}
		}
	}

	private async listAlerts(peer: SocketState | null): Promise<LiveAlert[]> {
		if (!peer) {
			return [];
		}
		const rows = await this.env.DB.prepare(
			`SELECT a.id, a.kind, a.courier_user_id, a.created_at,
				u.name as courier_name, u.email as courier_email
			 FROM courier_alerts a
			 LEFT JOIN users u ON u.id = a.courier_user_id
			 WHERE a.restaurant_id = ? AND a.archived_at IS NULL
			 ORDER BY a.created_at DESC
			 LIMIT 20`,
		)
			.bind(peer.restaurantId)
			.all<{
				id: string;
				kind: string;
				courier_user_id: string;
				created_at: string;
				courier_name: string | null;
				courier_email: string | null;
			}>();
		return (rows.results ?? []).flatMap((row) => {
			if (!COURIER_ALERT_KIND_SET.has(row.kind)) {
				return [];
			}
			const kind = row.kind as keyof typeof COURIER_ALERT_LABELS;
			return [
				{
					id: row.id,
					kind,
					label: COURIER_ALERT_LABELS[kind],
					courierUserId: row.courier_user_id,
					courierName: row.courier_name ?? row.courier_email,
					createdAt: row.created_at,
				},
			];
		});
	}

	private async handleAlert(peer: LivePeer, kind: string) {
		if (!COURIER_ALERT_KIND_SET.has(kind)) {
			return;
		}
		const typed = kind as keyof typeof COURIER_ALERT_LABELS;
		const id = newId("alt");
		const createdAt = new Date().toISOString();
		await this.env.DB.prepare(
			`INSERT INTO courier_alerts
			 (id, restaurant_id, courier_user_id, kind, created_at)
			 VALUES (?, ?, ?, ?, ?)`,
		)
			.bind(id, peer.restaurantId, peer.userId, typed, createdAt)
			.run();
		this.broadcast({
			type: "alert",
			alert: {
				id,
				kind: typed,
				label: COURIER_ALERT_LABELS[typed],
				courierUserId: peer.userId,
				courierName: peer.name,
				createdAt,
			},
		});
	}

	private async handleArchive(peer: LivePeer) {
		const rows = await this.env.DB.prepare(
			`SELECT id FROM courier_alerts
			 WHERE restaurant_id = ? AND archived_at IS NULL`,
		)
			.bind(peer.restaurantId)
			.all<{ id: string }>();
		const ids = (rows.results ?? []).map((row) => row.id);
		if (ids.length === 0) {
			this.broadcast({ type: "alerts-archived", ids: [] });
			return;
		}
		await this.env.DB.prepare(
			`UPDATE courier_alerts SET archived_at = ?
			 WHERE restaurant_id = ? AND archived_at IS NULL`,
		)
			.bind(new Date().toISOString(), peer.restaurantId)
			.run();
		this.broadcast({ type: "alerts-archived", ids });
	}

	private async removeCourier(restaurantId: string, courierUserId: string) {
		this.ctx.storage.sql.exec(
			"DELETE FROM positions WHERE courier_user_id = ?",
			courierUserId,
		);
		await this.env.DB.prepare(
			`UPDATE courier_duty
			 SET punched_in = 0, punched_out_at = ?, updated_at = ?
			 WHERE restaurant_id = ? AND courier_user_id = ?`,
		)
			.bind(new Date().toISOString(), new Date().toISOString(), restaurantId, courierUserId)
			.run();
		this.broadcast({ type: "courier-removed", courierUserId });
		for (const socket of this.ctx.getWebSockets()) {
			const peer = socket.deserializeAttachment() as SocketState | null;
			if (peer?.kind === "courier" && peer.userId === courierUserId) {
				socket.close(4000, "punch-out");
			}
		}
		this.broadcastPresence();
	}

	private broadcast(payload: LiveOutbound) {
		const encoded = JSON.stringify(payload);
		for (const socket of this.ctx.getWebSockets()) {
			socket.send(encoded);
		}
	}
}

function corsHeaders(request: Request) {
	const origin = request.headers.get("Origin") ?? "*";
	return {
		"Access-Control-Allow-Origin": origin,
		"Access-Control-Allow-Headers": "content-type, authorization, cookie",
		"Access-Control-Allow-Credentials": "true",
	};
}

export default {
	async fetch(request: Request, env: LiveEnv): Promise<Response> {
		if (request.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders(request) });
		}
		const url = new URL(request.url);
		if (url.pathname !== "/ws" && url.pathname !== "/") {
			return new Response("Not found", { status: 404 });
		}
		const ticket = url.searchParams.get("ticket") ?? "";
		const peer = await verifyLiveTicket(env.AUTH_SECRET, ticket);
		if (!peer) {
			return new Response("Unauthorized", { status: 401 });
		}
		if (request.headers.get("Upgrade") !== "websocket") {
			return new Response("Expected websocket", {
				status: 426,
				headers: corsHeaders(request),
			});
		}
		const headers = new Headers(request.headers);
		headers.set("x-resto-live", JSON.stringify(peer));
		const stub = env.RESTO_LIVE.getByName(`resto:${peer.restaurantId}`);
		return stub.fetch(new Request(request, { headers }));
	},
} satisfies ExportedHandler<LiveEnv>;
