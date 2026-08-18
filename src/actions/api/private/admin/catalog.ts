"use action";

import { getContext } from "@next/action/context";
import type { CtxData } from "../../../../action-utils/api-types";
import { canManageCatalog } from "../../../../lib/auth/roles";
import { getAccessibleRestaurant } from "../../../../lib/auth/guard";
import {
	archiveProduct,
	listCatalog,
	saveCategory,
	saveProduct,
} from "../../../../lib/catalog/admin";

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
	return listCatalog(ctx, restaurantId);
}

export async function POST(
	kind: "category" | "product",
	body: Parameters<typeof saveCategory>[1] | Parameters<typeof saveProduct>[1],
) {
	const ctx = getContext(arguments) as unknown as EventContext<
		Env,
		never,
		CtxData
	>;
	const access = await getAccessibleRestaurant(ctx, body.restaurantId);
	if (!access.ok) {
		return { ok: false as const, error: access.error };
	}
	const { parsed } = access;
	if (!canManageCatalog(parsed)) {
		return { ok: false as const, error: "Accès refusé." };
	}
	if (kind === "category") {
		return saveCategory(ctx, body as Parameters<typeof saveCategory>[1]);
	}
	return saveProduct(ctx, body as Parameters<typeof saveProduct>[1]);
}

export async function DELETE(restaurantId: string, productId: string) {
	const ctx = getContext(arguments) as unknown as EventContext<
		Env,
		never,
		CtxData
	>;
	const access = await getAccessibleRestaurant(ctx, restaurantId);
	if (!access.ok) {
		return { ok: false as const, error: access.error };
	}
	const { parsed } = access;
	if (!canManageCatalog(parsed)) {
		return { ok: false as const, error: "Accès refusé." };
	}
	return archiveProduct(ctx, productId, restaurantId);
}
