"use action";

import { getContext } from "@next/action/context";
import type { CtxData } from "../../../../action-utils/api-types";
import { resolveOpsRestaurant } from "../../../../lib/ops/access";
import { getClientNote, saveClientNote } from "../../../../lib/ops/notes";

export async function GET(phone: string, restaurantId?: string) {
	const ctx = getContext(arguments) as unknown as EventContext<
		Env,
		never,
		CtxData
	>;
	const access = await resolveOpsRestaurant(ctx, restaurantId);
	if (!access.ok) {
		return { ok: false as const, error: access.error };
	}
	const note = await getClientNote(ctx, access.restaurantId, phone);
	return { ok: true as const, note };
}

export async function PUT(phone: string, note: string, restaurantId?: string) {
	const ctx = getContext(arguments) as unknown as EventContext<
		Env,
		never,
		CtxData
	>;
	const access = await resolveOpsRestaurant(ctx, restaurantId);
	if (!access.ok) {
		return { ok: false as const, error: access.error };
	}
	const result = await saveClientNote(ctx, {
		restaurantId: access.restaurantId,
		phone,
		note,
		userId: access.identity.id!,
	});
	if (!result.ok) {
		return result;
	}
	const saved = await getClientNote(ctx, access.restaurantId, phone);
	return { ok: true as const, note: saved };
}
