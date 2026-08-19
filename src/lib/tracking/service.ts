import { and, desc, eq, isNull } from "drizzle-orm";
import type { CtxData } from "../../action-utils/api-types";
import { getDb, newId } from "../../db/client";
import {
	type CourierAlertKind,
	courierAlerts,
	courierPositions,
	restaurants,
	users,
} from "../../db/schema";
import { geocodeAddress, withQuebecHint } from "../geo/nominatim";
import { listActiveCourierIds } from "./duty";
import { COURIER_ALERT_LABELS } from "./labels";

export { COURIER_ALERT_LABELS };

export type CourierAlert = {
	id: string;
	kind: CourierAlertKind;
	label: string;
	courierUserId: string;
	courierName: string | null;
	createdAt: string;
};

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
	const active = await listActiveCourierIds(ctx, restaurantId);
	const byUser = new Map<string, CourierLivePosition>();
	for (const row of rows) {
		if (byUser.has(row.courierUserId) || !active.has(row.courierUserId)) {
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

export async function createCourierAlert(
	ctx: EventContext<Env, never, CtxData>,
	input: {
		restaurantId: string;
		courierUserId: string;
		kind: CourierAlertKind;
	},
) {
	const db = getDb(ctx);
	const id = newId("alt");
	const createdAt = new Date().toISOString();
	await db.insert(courierAlerts).values({
		id,
		restaurantId: input.restaurantId,
		courierUserId: input.courierUserId,
		kind: input.kind,
		createdAt,
	});
	return { ok: true as const, id, createdAt };
}

export async function archiveCourierAlerts(
	ctx: EventContext<Env, never, CtxData>,
	restaurantId: string,
) {
	const db = getDb(ctx);
	const now = new Date().toISOString();
	const active = await db
		.select({ id: courierAlerts.id })
		.from(courierAlerts)
		.where(
			and(
				eq(courierAlerts.restaurantId, restaurantId),
				isNull(courierAlerts.archivedAt),
			),
		)
		.all();
	if (active.length === 0) {
		return { ok: true as const, ids: [] as string[] };
	}
	await db
		.update(courierAlerts)
		.set({ archivedAt: now })
		.where(
			and(
				eq(courierAlerts.restaurantId, restaurantId),
				isNull(courierAlerts.archivedAt),
			),
		);
	return { ok: true as const, ids: active.map((row) => row.id) };
}

export async function listRecentCourierAlerts(
	ctx: EventContext<Env, never, CtxData>,
	restaurantId: string,
	limit = 20,
): Promise<CourierAlert[]> {
	const db = getDb(ctx);
	const rows = await db
		.select()
		.from(courierAlerts)
		.where(
			and(
				eq(courierAlerts.restaurantId, restaurantId),
				isNull(courierAlerts.archivedAt),
			),
		)
		.orderBy(desc(courierAlerts.createdAt))
		.all();
	const people = await db.select().from(users).all();
	return rows.slice(0, limit).map((row) => {
		const person = people.find((user) => user.id === row.courierUserId);
		return {
			id: row.id,
			kind: row.kind,
			label: COURIER_ALERT_LABELS[row.kind],
			courierUserId: row.courierUserId,
			courierName: person?.name ?? person?.email ?? null,
			createdAt: row.createdAt,
		};
	});
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
	if (row?.lat != null && row?.lng != null) {
		return { lat: row.lat, lng: row.lng, name: row.name };
	}
	if (row?.address) {
		const geo = await geocodeAddress(withQuebecHint(row.address));
		if (geo) {
			await db
				.update(restaurants)
				.set({ lat: geo.lat, lng: geo.lng, updatedAt: new Date().toISOString() })
				.where(eq(restaurants.id, restaurantId));
			return { lat: geo.lat, lng: geo.lng, name: row.name };
		}
	}
	return {
		lat: 45.5756,
		lng: -70.882,
		name: row?.name ?? "Restaurant",
	};
}
