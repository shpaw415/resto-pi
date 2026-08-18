"use action";

import { getContext } from "@next/action/context";
import type { CtxData } from "../../../../action-utils/api-types";
import type { PosAdapterId } from "../../../../db/schema";
import { getAccessibleRestaurant } from "../../../../lib/auth/guard";
import { canManagePos } from "../../../../lib/auth/roles";
import { syncCatalogFromPos } from "../../../../lib/catalog/sync-pos";
import { seedDemoData } from "../../../../lib/dev/seed";
import {
	createOrder,
	findOrderByExternalId,
} from "../../../../lib/orders/service";
import type { PosIpApiConfig } from "../../../../lib/pos/posipapi";
import {
	connectionPublicView,
	getAdapter,
	getPosConnection,
	savePosIpConfig,
	setPosAdapter,
} from "../../../../lib/pos/registry";

export async function GET(restaurantId: string) {
	const ctx = getContext(arguments) as unknown as EventContext<
		Env,
		never,
		CtxData
	>;
	const access = await getAccessibleRestaurant(ctx, restaurantId);
	if (!access.ok) {
		return { ok: false as const, error: access.error };
	}
	if (!canManagePos(access.parsed)) {
		return { ok: false as const, error: "Accès refusé." };
	}
	return connectionPublicView(await getPosConnection(ctx, restaurantId));
}

export async function PUT(
	restaurantId: string,
	payload:
		| PosAdapterId
		| { adapter?: PosAdapterId; config?: Partial<PosIpApiConfig> },
) {
	const ctx = getContext(arguments) as unknown as EventContext<
		Env,
		never,
		CtxData
	>;
	const access = await getAccessibleRestaurant(ctx, restaurantId);
	if (!access.ok) {
		return { ok: false as const, error: access.error };
	}
	if (!canManagePos(access.parsed)) {
		return { ok: false as const, error: "Accès refusé." };
	}
	if (typeof payload === "string") {
		return setPosAdapter(ctx, restaurantId, payload);
	}
	if (payload.adapter) {
		await setPosAdapter(ctx, restaurantId, payload.adapter);
	}
	if (payload.config) {
		return savePosIpConfig(ctx, restaurantId, payload.config);
	}
	return { ok: true as const };
}

export async function POST(
	restaurantId: string | null,
	action: "import" | "seed" | "ping" | "sync-menu",
) {
	const ctx = getContext(arguments) as unknown as EventContext<
		Env,
		never,
		CtxData
	>;
	if (action === "seed") {
		const identity = ctx.data.identity;
		if (!canManagePos(identity?.parsed ?? null)) {
			return { ok: false as const, error: "Accès refusé." };
		}
		return seedDemoData(ctx);
	}
	if (!restaurantId) {
		return { ok: false as const, error: "Restaurant requis." };
	}
	const access = await getAccessibleRestaurant(ctx, restaurantId);
	if (!access.ok) {
		return { ok: false as const, error: access.error };
	}
	const { identity, parsed } = access;
	if (!canManagePos(parsed)) {
		return { ok: false as const, error: "Accès refusé." };
	}
	const connection = await getPosConnection(ctx, restaurantId);
	const adapter = getAdapter(connection.adapter, connection.configJson);
	try {
		if (action === "ping") {
			if (!adapter.ping) {
				return { ok: true as const, message: "Mock : rien à tester." };
			}
			return { ok: true as const, message: await adapter.ping() };
		}
		if (action === "sync-menu") {
			if (!adapter.fetchMenu) {
				return { ok: false as const, error: "Ce POS ne fournit pas de menu." };
			}
			const menu = await adapter.fetchMenu();
			const synced = await syncCatalogFromPos(ctx, restaurantId, menu);
			return {
				ok: true as const,
				message: `Menu POS : ${synced.products} produits, ${synced.categories} catégories.`,
				synced,
			};
		}
		const incoming = await adapter.pullNewOrders(restaurantId);
		const created: string[] = [];
		let skipped = 0;
		for (const order of incoming) {
			const existing = await findOrderByExternalId(
				ctx,
				restaurantId,
				order.externalPosId,
			);
			if (existing) {
				skipped += 1;
				continue;
			}
			const result = await createOrder(ctx, order, identity);
			if (result.ok) {
				created.push(result.id);
			}
		}
		return { ok: true as const, created, skipped };
	} catch (error) {
		return {
			ok: false as const,
			error: error instanceof Error ? error.message : "Erreur POS",
		};
	}
}
