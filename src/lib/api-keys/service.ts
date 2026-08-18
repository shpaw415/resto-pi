import { and, desc, eq, isNull } from "drizzle-orm";
import type { CtxData } from "../../action-utils/api-types";
import { getDb, newId } from "../../db/client";
import { type ApiKeyScope, apiKeys } from "../../db/schema";

export type CreatedApiKey = {
	id: string;
	prefix: string;
	secret: string;
	scopes: ApiKeyScope[];
};

async function sha256Hex(value: string): Promise<string> {
	const bytes = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

function randomSecret(): string {
	const bytes = new Uint8Array(24);
	crypto.getRandomValues(bytes);
	return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function parseScopes(raw: string): ApiKeyScope[] {
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed.filter(
			(value): value is ApiKeyScope => typeof value === "string",
		);
	} catch {
		return [];
	}
}

export async function listApiKeys(
	ctx: EventContext<Env, never, CtxData>,
	restaurantId: string,
) {
	const db = getDb(ctx);
	const rows = await db
		.select()
		.from(apiKeys)
		.where(eq(apiKeys.restaurantId, restaurantId))
		.orderBy(desc(apiKeys.createdAt))
		.all();
	return rows.map((row) => ({
		...row,
		scopes: parseScopes(row.scopes),
	}));
}

export async function createApiKey(
	ctx: EventContext<Env, never, CtxData>,
	input: {
		restaurantId: string;
		name: string;
		scopes: ApiKeyScope[];
	},
): Promise<{ ok: true; key: CreatedApiKey } | { ok: false; error: string }> {
	const name = input.name.trim();
	if (!name) {
		return { ok: false, error: "Nom requis." };
	}
	if (!input.scopes.length) {
		return { ok: false, error: "Au moins un scope." };
	}
	const token = randomSecret();
	const secret = `rp_live_${token}`;
	const prefix = secret.slice(0, 16);
	const keyHash = await sha256Hex(secret);
	const id = newId("key");
	const db = getDb(ctx);
	await db.insert(apiKeys).values({
		id,
		restaurantId: input.restaurantId,
		name,
		prefix,
		keyHash,
		scopes: JSON.stringify(input.scopes),
	});
	return {
		ok: true,
		key: { id, prefix, secret, scopes: input.scopes },
	};
}

export async function revokeApiKey(
	ctx: EventContext<Env, never, CtxData>,
	id: string,
	restaurantId: string,
) {
	const db = getDb(ctx);
	await db
		.update(apiKeys)
		.set({ revokedAt: new Date().toISOString() })
		.where(and(eq(apiKeys.id, id), eq(apiKeys.restaurantId, restaurantId)));
	return { ok: true as const };
}

export async function authenticateApiKey(
	ctx: EventContext<Env, never, CtxData>,
	bearer: string | null,
) {
	if (!bearer) {
		return null;
	}
	const token = bearer.startsWith("Bearer ") ? bearer.slice(7).trim() : bearer;
	if (!token.startsWith("rp_live_")) {
		return null;
	}
	const keyHash = await sha256Hex(token);
	const db = getDb(ctx);
	const [row] = await db
		.select()
		.from(apiKeys)
		.where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
		.limit(1)
		.all();
	if (!row) {
		return null;
	}
	await db
		.update(apiKeys)
		.set({ lastUsedAt: new Date().toISOString() })
		.where(eq(apiKeys.id, row.id));
	return {
		...row,
		scopes: parseScopes(row.scopes),
	};
}

export function hasScope(
	scopes: ApiKeyScope[],
	needed: ApiKeyScope,
): boolean {
	return scopes.includes(needed);
}
