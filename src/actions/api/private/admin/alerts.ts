"use action";

import { getContext } from "@next/action/context";
import type { CtxData } from "../../../../action-utils/api-types";
import { getAccessibleRestaurant } from "../../../../lib/auth/guard";
import { canTrackCouriers } from "../../../../lib/auth/roles";
import { archiveCourierAlerts } from "../../../../lib/tracking/service";

export async function POST(restaurantId: string) {
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
	return archiveCourierAlerts(ctx, restaurantId);
}
