import { desc, eq } from "drizzle-orm";
import type { CtxData } from "../../action-utils/api-types";
import { getDb, newId } from "../../db/client";
import { courierPositions, restaurants, users } from "../../db/schema";

export type CourierLivePosition = {
	courierUserId: string;
	name: string | null;
	email: string | null;
	lat: number;
	lng: number;
	recordedAt: string;
};

export async function recordCourierPosition(
	ctx: EventContext<Env, never, CtxData>,
	input: {
		restaurantId: string;
		courierUserId: string;
		lat: number;
		lng: number;
	},
) {
	if (
		!Number.isFinite(input.lat) ||
		!Number.isFinite(input.lng) ||
		input.lat < -90 ||
		input.lat > 90 ||
		input.lng < -180 ||
		input.lng > 180
	) {
		return { ok: false as const, error: "Coordonnées invalides." };
	}
	const db = getDb(ctx);
	const id = newId("posi");
	const recordedAt = new Date().toISOString();
	await db.insert(courierPositions).values({
		id,
		restaurantId: input.restaurantId,
		courierUserId: input.courierUserId,
		lat: input.lat,
		lng: input.lng,
		recordedAt,
	});
	return { ok: true as const, recordedAt };
}

export async function listLatestCourierPositions(
	ctx: EventContext<Env, never, CtxData>,
	restaurantId: string,
): Promise<CourierLivePosition[]> {
	const db = getDb(ctx);
	const rows = await db
		.select()
		.from(courierPositions)
		.where(eq(courierPositions.restaurantId, restaurantId))
		.orderBy(desc(courierPositions.recordedAt))
		.all();
	const people = await db.select().from(users).all();
	const byUser = new Map<string, CourierLivePosition>();
	for (const row of rows) {
		if (byUser.has(row.courierUserId)) {
			continue;
		}
		const person = people.find((user) => user.id === row.courierUserId);
		byUser.set(row.courierUserId, {
			courierUserId: row.courierUserId,
			name: person?.name ?? null,
			email: person?.email ?? null,
			lat: row.lat,
			lng: row.lng,
			recordedAt: row.recordedAt,
		});
	}
	return [...byUser.values()];
}

export async function getRestaurantMapCenter(
	ctx: EventContext<Env, never, CtxData>,
	restaurantId: string,
): Promise<{ lat: number; lng: number; name: string }> {
	const db = getDb(ctx);
	const [row] = await db
		.select()
		.from(restaurants)
		.where(eq(restaurants.id, restaurantId))
		.limit(1)
		.all();
	return {
		lat: row?.lat ?? 45.5017,
		lng: row?.lng ?? -73.5673,
		name: row?.name ?? "Restaurant",
	};
}
