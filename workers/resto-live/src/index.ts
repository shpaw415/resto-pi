import { DurableObject } from "cloudflare:workers";
import type { ChatMessage } from "../../../src/lib/ops/types";
import type { LiveInbound, LiveOutbound, LivePeer } from "../../../src/lib/live/protocol";
import { parseInbound } from "../../../src/lib/live/protocol";
import { verifyLiveTicket } from "../../../src/lib/live/ticket";
import type { LiveCourier } from "../../../src/lib/live/protocol";

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
					author_user_id TEXT NOT NULL,
					author_kind TEXT NOT NULL,
					author_name TEXT,
					body TEXT NOT NULL,
					created_at TEXT NOT NULL
				);
			`);
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
		await this.handleChat(peer, inbound.body);
	}

	async webSocketClose(ws: WebSocket, code: number, reason: string) {
		ws.close(code, reason);
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
		jsonSend(ws, {
			type: "snapshot",
			couriers: this.listPositions(),
			messages: await this.listMessages(),
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

	private async listMessages(): Promise<ChatMessage[]> {
		const local = this.ctx.storage.sql
			.exec<{
				id: string;
				author_user_id: string;
				author_kind: string;
				author_name: string | null;
				body: string;
				created_at: string;
			}>("SELECT * FROM messages ORDER BY created_at DESC LIMIT 80")
			.toArray()
			.reverse()
			.map((row) => ({
				id: row.id,
				authorUserId: row.author_user_id,
				authorKind: row.author_kind === "courier" ? "courier" as const : "staff" as const,
				authorName: row.author_name,
				body: row.body,
				createdAt: row.created_at,
			}));
		if (local.length > 0) {
			return local;
		}
		const peer = this.ctx.getWebSockets()[0]?.deserializeAttachment() as
			| SocketState
			| null;
		if (!peer) {
			return [];
		}
		const rows = await this.env.DB.prepare(
			`SELECT m.id, m.author_user_id, m.author_kind, m.body, m.created_at,
				u.name as author_name, u.email as author_email
			 FROM staff_courier_messages m
			 LEFT JOIN users u ON u.id = m.author_user_id
			 WHERE m.restaurant_id = ?
			 ORDER BY m.created_at DESC
			 LIMIT 80`,
		)
			.bind(peer.restaurantId)
			.all<{
				id: string;
				author_user_id: string;
				author_kind: string;
				body: string;
				created_at: string;
				author_name: string | null;
				author_email: string | null;
			}>();
		const messages = (rows.results ?? []).reverse().map((row) => ({
			id: row.id,
			authorUserId: row.author_user_id,
			authorKind: row.author_kind === "courier" ? "courier" as const : "staff" as const,
			authorName: row.author_name ?? row.author_email,
			body: row.body,
			createdAt: row.created_at,
		}));
		for (const message of messages) {
			this.ctx.storage.sql.exec(
				`INSERT OR IGNORE INTO messages
				 (id, author_user_id, author_kind, author_name, body, created_at)
				 VALUES (?, ?, ?, ?, ?, ?)`,
				message.id,
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

	private async handleChat(peer: LivePeer, rawBody: string) {
		const body = rawBody.trim();
		if (!body || body.length > 1000) {
			return;
		}
		const id = newId("msg");
		const createdAt = new Date().toISOString();
		this.ctx.storage.sql.exec(
			`INSERT INTO messages
			 (id, author_user_id, author_kind, author_name, body, created_at)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			id,
			peer.userId,
			peer.kind,
			peer.name,
			body,
			createdAt,
		);
		await this.env.DB.prepare(
			`INSERT INTO staff_courier_messages
			 (id, restaurant_id, author_user_id, author_kind, body, created_at)
			 VALUES (?, ?, ?, ?, ?, ?)`,
		)
			.bind(id, peer.restaurantId, peer.userId, peer.kind, body, createdAt)
			.run();
		this.broadcast({
			type: "chat",
			message: {
				id,
				authorUserId: peer.userId,
				authorKind: peer.kind,
				authorName: peer.name,
				body,
				createdAt,
			},
		});
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
