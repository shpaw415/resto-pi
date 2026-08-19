"use action";

import { getContext } from "@next/action/context";
import type { CtxData } from "../../../../action-utils/api-types";
import type { CourierAlertKind } from "../../../../db/schema";
import { courierAlertKinds } from "../../../../db/schema";
import {
	resolveActiveRestaurant,
	upsertUserFromIdentity,
} from "../../../../lib/auth/access";
import { canShareCourierPosition } from "../../../../lib/auth/roles";
import { createCourierAlert } from "../../../../lib/tracking/service";

export async function POST(kind: CourierAlertKind) {
	const ctx = getContext(arguments) as unknown as EventContext<
		Env,
		never,
		CtxData
	>;
	const identity = ctx.data.identity;
	if (!identity?.id || !canShareCourierPosition(identity.parsed)) {
		return { ok: false as const, error: "Accès livreur requis." };
	}
	if (!courierAlertKinds.includes(kind)) {
		return { ok: false as const, error: "Action inconnue." };
	}
	await upsertUserFromIdentity(ctx, identity);
	const { active } = await resolveActiveRestaurant(ctx, identity.parsed);
	if (!active) {
		return { ok: false as const, error: "Aucun restaurant lié." };
	}
	return createCourierAlert(ctx, {
		restaurantId: active.id,
		courierUserId: identity.id,
		kind,
	});
}
