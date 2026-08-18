import { and, eq } from "drizzle-orm";
import type { CtxData } from "../../action-utils/api-types";
import { getDb, newId } from "../../db/client";
import { type PosAdapterId, posConnections } from "../../db/schema";
import { ColossalPosAdapter } from "./colossal";
import { MockPosAdapter } from "./mock";
import {
	mergePosIpConfig,
	parsePosIpConfig,
	type PosIpApiConfig,
	publicPosIpConfig,
} from "./posipapi";
import type { PosAdapter } from "./types";

export function getAdapter(
	id: PosAdapterId,
	configJson = "{}",
): PosAdapter {
	if (id === "colossal") {
		return new ColossalPosAdapter(parsePosIpConfig(configJson));
	}
	return new MockPosAdapter();
}

export async function getPosConnection(
	ctx: EventContext<Env, never, CtxData>,
	restaurantId: string,
) {
	const db = getDb(ctx);
	const [row] = await db
		.select()
		.from(posConnections)
		.where(eq(posConnections.restaurantId, restaurantId))
		.limit(1)
		.all();
	if (row) {
		return row;
	}
	const id = newId("pos");
	await db.insert(posConnections).values({
		id,
		restaurantId,
		adapter: "mock",
		configJson: "{}",
		isActive: true,
	});
	const [created] = await db
		.select()
		.from(posConnections)
		.where(eq(posConnections.id, id))
		.limit(1)
		.all();
	return created!;
}

export async function setPosAdapter(
	ctx: EventContext<Env, never, CtxData>,
	restaurantId: string,
	adapter: PosAdapterId,
) {
	const current = await getPosConnection(ctx, restaurantId);
	const db = getDb(ctx);
	await db
		.update(posConnections)
		.set({ adapter, updatedAt: new Date().toISOString() })
		.where(
			and(
				eq(posConnections.id, current.id),
				eq(posConnections.restaurantId, restaurantId),
			),
		);
	return { ok: true as const, adapter };
}

export function connectionPublicView(row: {
	id: string;
	restaurantId: string;
	adapter: PosAdapterId;
	configJson: string;
	isActive: boolean;
}) {
	return {
		id: row.id,
		restaurantId: row.restaurantId,
		adapter: row.adapter,
		isActive: row.isActive,
		config: publicPosIpConfig(parsePosIpConfig(row.configJson)),
	};
}

export async function savePosIpConfig(
	ctx: EventContext<Env, never, CtxData>,
	restaurantId: string,
	patch: Partial<PosIpApiConfig>,
) {
	const current = await getPosConnection(ctx, restaurantId);
	const merged = mergePosIpConfig(parsePosIpConfig(current.configJson), patch);
	const db = getDb(ctx);
	await db
		.update(posConnections)
		.set({
			adapter: "colossal",
			configJson: JSON.stringify(merged),
			updatedAt: new Date().toISOString(),
		})
		.where(
			and(
				eq(posConnections.id, current.id),
				eq(posConnections.restaurantId, restaurantId),
			),
		);
	return {
		ok: true as const,
		config: publicPosIpConfig(merged),
	};
}
