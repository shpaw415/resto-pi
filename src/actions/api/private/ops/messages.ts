"use action";

import { getContext } from "@next/action/context";
import type { CtxData } from "../../../../action-utils/api-types";
import { resolveOpsRestaurant } from "../../../../lib/ops/access";
import {
	listMessages,
	listRestaurantCouriers,
	postMessage,
} from "../../../../lib/ops/messages";

export async function GET(restaurantId: string, courierUserId: string) {
	const ctx = getContext(arguments) as unknown as EventContext<
		Env,
		never,
		CtxData
	>;
	const access = await resolveOpsRestaurant(ctx, restaurantId || undefined);
	if (!access.ok) {
		return { ok: false as const, error: access.error };
	}
	const threadId =
		access.authorKind === "courier"
			? access.identity.id!
			: courierUserId;
	return {
		ok: true as const,
		selfId: access.identity.id,
		authorKind: access.authorKind,
		couriers: await listRestaurantCouriers(ctx, access.restaurantId),
		messages: await listMessages(ctx, access.restaurantId, threadId),
	};
}

export async function POST(
	body: string,
	restaurantId: string,
	courierUserId: string,
) {
	const ctx = getContext(arguments) as unknown as EventContext<
		Env,
		never,
		CtxData
	>;
	const access = await resolveOpsRestaurant(ctx, restaurantId || undefined);
	if (!access.ok) {
		return { ok: false as const, error: access.error };
	}
	const threadId =
		access.authorKind === "courier"
			? access.identity.id!
			: courierUserId;
	const result = await postMessage(ctx, {
		restaurantId: access.restaurantId,
		courierUserId: threadId,
		authorUserId: access.identity.id!,
		authorKind: access.authorKind,
		body,
	});
	if (!result.ok) {
		return result;
	}
	return {
		ok: true as const,
		messages: await listMessages(ctx, access.restaurantId, threadId),
	};
}
