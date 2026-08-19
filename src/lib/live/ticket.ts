import type { ChatAuthorKind } from "../ops/types";
import type { LivePeer } from "./protocol";

export type LiveTicketPayload = LivePeer & { exp: number };

function bytesToB64url(bytes: ArrayBuffer | Uint8Array): string {
	const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	let binary = "";
	for (const byte of view) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function b64urlToBytes(value: string): Uint8Array {
	const padded = value.replaceAll("-", "+").replaceAll("_", "/");
	const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
	const binary = atob(padded + pad);
	const out = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		out[i] = binary.charCodeAt(i);
	}
	return out;
}

async function hmacKey(secret: string) {
	return crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"],
	);
}

export async function mintLiveTicket(
	secret: string,
	peer: LivePeer,
	ttlMs = 60_000,
): Promise<string> {
	const payload: LiveTicketPayload = { ...peer, exp: Date.now() + ttlMs };
	const body = bytesToB64url(new TextEncoder().encode(JSON.stringify(payload)));
	const key = await hmacKey(secret);
	const sig = bytesToB64url(
		await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)),
	);
	return `${body}.${sig}`;
}

export async function verifyLiveTicket(
	secret: string,
	token: string,
): Promise<LivePeer | null> {
	const [body, sig] = token.split(".");
	if (!body || !sig) {
		return null;
	}
	const key = await hmacKey(secret);
	const ok = await crypto.subtle.verify(
		"HMAC",
		key,
		b64urlToBytes(sig),
		new TextEncoder().encode(body),
	);
	if (!ok) {
		return null;
	}
	try {
		const payload = JSON.parse(
			new TextDecoder().decode(b64urlToBytes(body)),
		) as LiveTicketPayload;
		if (!payload.userId || !payload.restaurantId || payload.exp < Date.now()) {
			return null;
		}
		if (payload.kind !== "staff" && payload.kind !== "courier") {
			return null;
		}
		return {
			userId: payload.userId,
			kind: payload.kind as ChatAuthorKind,
			name: payload.name ?? null,
			restaurantId: payload.restaurantId,
		};
	} catch {
		return null;
	}
}
