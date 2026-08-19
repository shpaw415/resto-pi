"use action";

import { getContext } from "@next/action/context";
import type { CtxData } from "../../../../action-utils/api-types";
import {
	resolveActiveRestaurant,
	upsertUserFromIdentity,
} from "../../../../lib/auth/access";
import { canShareCourierPosition } from "../../../../lib/auth/roles";
import { getDuty, setDuty } from "../../../../lib/tracking/duty";

async function resolveCourierDuty(ctx: EventContext<Env, never, CtxData>) {
	const identity = ctx.data.identity;
	if (!identity?.id || !canShareCourierPosition(identity.parsed)) {
		return { ok: false as const, error: "Accès livreur requis." };
	}
	await upsertUserFromIdentity(ctx, identity);
	const { active } = await resolveActiveRestaurant(ctx, identity.parsed);
	if (!active) {
		return { ok: false as const, error: "Aucun restaurant lié." };
	}
	return { ok: true as const, identity, restaurantId: active.id };
}

export async function GET() {
	const ctx = getContext(arguments) as unknown as EventContext<
		Env,
		never,
		CtxData
	>;
	const access = await resolveCourierDuty(ctx);
	if (!access.ok) {
		return access;
	}
	return {
		ok: true as const,
		punchedIn: await getDuty(ctx, access.restaurantId, access.identity.id!),
	};
}

export async function POST(punchedIn: boolean) {
	const ctx = getContext(arguments) as unknown as EventContext<
		Env,
		never,
		CtxData
	>;
	const access = await resolveCourierDuty(ctx);
	if (!access.ok) {
		return access;
	}
	return setDuty(ctx, {
		restaurantId: access.restaurantId,
		courierUserId: access.identity.id!,
		punchedIn,
	});
}
