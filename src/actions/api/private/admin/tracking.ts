"use action";

import { getContext } from "@next/action/context";
import type { CtxData } from "../../../../action-utils/api-types";
import { getAccessibleRestaurant } from "../../../../lib/auth/guard";
import { canTrackCouriers } from "../../../../lib/auth/roles";
import {
	getRestaurantMapCenter,
	listLatestCourierPositions,
	listRecentCourierAlerts,
} from "../../../../lib/tracking/service";

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
	if (!canTrackCouriers(access.parsed)) {
		return { ok: false as const, error: "Accès refusé." };
	}
	const [couriers, center, alerts] = await Promise.all([
		listLatestCourierPositions(ctx, restaurantId),
		getRestaurantMapCenter(ctx, restaurantId),
		listRecentCourierAlerts(ctx, restaurantId),
	]);
	return { ok: true as const, couriers, center, alerts };
}
