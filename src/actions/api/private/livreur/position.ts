"use action";

import { getContext } from "@next/action/context";
import type { CtxData } from "../../../../action-utils/api-types";
import { resolveActiveRestaurant, upsertUserFromIdentity } from "../../../../lib/auth/access";
import { canShareCourierPosition } from "../../../../lib/auth/roles";
import { recordCourierPosition } from "../../../../lib/tracking/service";

export async function POST(body: { lat: number; lng: number }) {
	const ctx = getContext(arguments) as unknown as EventContext<
		Env,
		never,
		CtxData
	>;
	const identity = ctx.data.identity;
	if (!identity?.id || !canShareCourierPosition(identity.parsed)) {
		return { ok: false as const, error: "Accès livreur requis." };
	}
	await upsertUserFromIdentity(ctx, identity);
	const { active } = await resolveActiveRestaurant(ctx, identity.parsed);
	if (!active) {
		return { ok: false as const, error: "Aucun restaurant lié." };
	}
	return recordCourierPosition(ctx, {
		restaurantId: active.id,
		courierUserId: identity.id,
		lat: body.lat,
		lng: body.lng,
	});
}
