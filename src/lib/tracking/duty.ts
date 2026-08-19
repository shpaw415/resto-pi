import { and, eq } from "drizzle-orm";
import type { CtxData } from "../../action-utils/api-types";
import { getDb, newId } from "../../db/client";
import { courierDuty } from "../../db/schema";

export async function getDuty(
	ctx: EventContext<Env, never, CtxData>,
	restaurantId: string,
	courierUserId: string,
) {
	const db = getDb(ctx);
	const [row] = await db
		.select()
		.from(courierDuty)
		.where(
			and(
				eq(courierDuty.restaurantId, restaurantId),
				eq(courierDuty.courierUserId, courierUserId),
			),
		)
		.limit(1)
		.all();
	return Boolean(row?.punchedIn);
}

export async function setDuty(
	ctx: EventContext<Env, never, CtxData>,
	input: {
		restaurantId: string;
		courierUserId: string;
		punchedIn: boolean;
	},
) {
	const db = getDb(ctx);
	const now = new Date().toISOString();
	const [existing] = await db
		.select()
		.from(courierDuty)
		.where(
			and(
				eq(courierDuty.restaurantId, input.restaurantId),
				eq(courierDuty.courierUserId, input.courierUserId),
			),
		)
		.limit(1)
		.all();
	if (existing) {
		await db
			.update(courierDuty)
			.set({
				punchedIn: input.punchedIn,
				punchedInAt: input.punchedIn ? now : existing.punchedInAt,
				punchedOutAt: input.punchedIn ? null : now,
				updatedAt: now,
			})
			.where(eq(courierDuty.id, existing.id));
		return { ok: true as const, punchedIn: input.punchedIn };
	}
	await db.insert(courierDuty).values({
		id: newId("dty"),
		restaurantId: input.restaurantId,
		courierUserId: input.courierUserId,
		punchedIn: input.punchedIn,
		punchedInAt: input.punchedIn ? now : null,
		punchedOutAt: input.punchedIn ? null : now,
		updatedAt: now,
	});
	return { ok: true as const, punchedIn: input.punchedIn };
}

export async function listActiveCourierIds(
	ctx: EventContext<Env, never, CtxData>,
	restaurantId: string,
) {
	const db = getDb(ctx);
	const rows = await db
		.select()
		.from(courierDuty)
		.where(
			and(
				eq(courierDuty.restaurantId, restaurantId),
				eq(courierDuty.punchedIn, true),
			),
		)
		.all();
	return new Set(rows.map((row) => row.courierUserId));
}
