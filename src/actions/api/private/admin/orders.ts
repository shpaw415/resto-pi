"use action";

import { getContext } from "@next/action/context";
import type { CtxData } from "../../../../action-utils/api-types";
import { canChangeOrderStatus } from "../../../../lib/auth/roles";
import { getAccessibleRestaurant } from "../../../../lib/auth/guard";
import {
	getOrderById,
	listOrders,
	transitionOrder,
} from "../../../../lib/orders/service";

export async function GET(restaurantId: string, orderId?: string) {
	const ctx = getContext(arguments) as unknown as EventContext<
		Env,
		never,
		CtxData
	>;
	const access = await getAccessibleRestaurant(ctx, restaurantId);
	if (!access.ok) {
		return { ok: false as const, error: access.error };
	}
	if (orderId) {
		return getOrderById(ctx, orderId, restaurantId);
	}
	return listOrders(ctx, restaurantId);
}

export async function POST(
	restaurantId: string,
	orderId: string,
	direction: "next" | "prev",
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
	const { identity, parsed } = access;
	if (!canChangeOrderStatus(parsed)) {
		return { ok: false as const, error: "Accès refusé." };
	}
	return transitionOrder(ctx, orderId, restaurantId, direction, identity);
}
