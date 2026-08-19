import { and, desc, eq, inArray } from "drizzle-orm";
import type { CtxData } from "../../action-utils/api-types";
import type { DispatchStatus } from "../../db/schema";
import { getDb, newId } from "../../db/client";
import { deliveryHubs, orders, restaurants } from "../../db/schema";
import { dispatchStatuses } from "../../db/schema";
import { fromDispatchStatus, toDispatchStatus } from "./status";
import type { DispatchJob } from "./types";

export type { DispatchJob };

export async function ensureSharedHub(
	ctx: EventContext<Env, never, CtxData>,
) {
	const db = getDb(ctx);
	const existing = await db.select().from(deliveryHubs).limit(1).all();
	if (existing[0]) {
		return existing[0];
	}
	const hub = {
		id: newId("hub"),
		slug: "centre-partage",
		name: "Centre partagé",
	};
	await db.insert(deliveryHubs).values(hub);
	const restos = await db.select().from(restaurants).all();
	for (const resto of restos) {
		if (!resto.hubId) {
			await db
				.update(restaurants)
				.set({ hubId: hub.id, updatedAt: new Date().toISOString() })
				.where(eq(restaurants.id, resto.id));
		}
	}
	return hub;
}

export async function getHubForRestaurant(
	ctx: EventContext<Env, never, CtxData>,
	restaurantId: string,
) {
	const db = getDb(ctx);
	const [resto] = await db
		.select()
		.from(restaurants)
		.where(eq(restaurants.id, restaurantId))
		.limit(1)
		.all();
	if (!resto) {
		return null;
	}
	if (resto.hubId) {
		const [hub] = await db
			.select()
			.from(deliveryHubs)
			.where(eq(deliveryHubs.id, resto.hubId))
			.limit(1)
			.all();
		return hub ?? null;
	}
	const hub = await ensureSharedHub(ctx);
	await db
		.update(restaurants)
		.set({ hubId: hub.id, updatedAt: new Date().toISOString() })
		.where(eq(restaurants.id, restaurantId));
	return hub;
}

export async function listHubRestaurantIds(
	ctx: EventContext<Env, never, CtxData>,
	hubId: string,
) {
	const db = getDb(ctx);
	const rows = await db
		.select({ id: restaurants.id })
		.from(restaurants)
		.where(eq(restaurants.hubId, hubId))
		.all();
	return rows.map((row) => row.id);
}

export async function listHubJobs(
	ctx: EventContext<Env, never, CtxData>,
	restaurantId: string,
): Promise<{ hub: { id: string; name: string } | null; jobs: DispatchJob[] }> {
	const hub = await getHubForRestaurant(ctx, restaurantId);
	if (!hub) {
		return { hub: null, jobs: [] };
	}
	const db = getDb(ctx);
	const members = await db
		.select()
		.from(restaurants)
		.where(eq(restaurants.hubId, hub.id))
		.all();
	const ids = members.map((row) => row.id);
	if (ids.length === 0) {
		return { hub: { id: hub.id, name: hub.name }, jobs: [] };
	}
	const rows = await db
		.select()
		.from(orders)
		.where(and(eq(orders.type, "livraison"), inArray(orders.restaurantId, ids)))
		.orderBy(desc(orders.updatedAt))
		.all();
	const byId = new Map(members.map((row) => [row.id, row.name]));
	return {
		hub: { id: hub.id, name: hub.name },
		jobs: rows.map((row) => ({
			id: row.id,
			restaurantId: row.restaurantId,
			restaurantName: byId.get(row.restaurantId) ?? "Restaurant",
			phone: row.customerPhone,
			address: row.customerAddress,
			customerName: row.customerName,
			status: toDispatchStatus(row.status),
			updatedAt: row.updatedAt,
		})),
	};
}

export async function setDispatchStatus(
	ctx: EventContext<Env, never, CtxData>,
	input: { orderId: string; restaurantId: string; status: DispatchStatus },
) {
	if (!dispatchStatuses.includes(input.status)) {
		return { ok: false as const, error: "Statut invalide." };
	}
	const hub = await getHubForRestaurant(ctx, input.restaurantId);
	if (!hub) {
		return { ok: false as const, error: "Aucun centre." };
	}
	const memberIds = await listHubRestaurantIds(ctx, hub.id);
	const db = getDb(ctx);
	const [order] = await db
		.select()
		.from(orders)
		.where(eq(orders.id, input.orderId))
		.limit(1)
		.all();
	if (!order || !memberIds.includes(order.restaurantId)) {
		return { ok: false as const, error: "Course introuvable." };
	}
	if (order.type !== "livraison") {
		return { ok: false as const, error: "Pas une livraison." };
	}
	const next = fromDispatchStatus(input.status);
	const now = new Date().toISOString();
	await db
		.update(orders)
		.set({ status: next, updatedAt: now })
		.where(eq(orders.id, order.id));
	const [resto] = await db
		.select()
		.from(restaurants)
		.where(eq(restaurants.id, order.restaurantId))
		.limit(1)
		.all();
	const job: DispatchJob = {
		id: order.id,
		restaurantId: order.restaurantId,
		restaurantName: resto?.name ?? "Restaurant",
		phone: order.customerPhone,
		address: order.customerAddress,
		customerName: order.customerName,
		status: input.status,
		updatedAt: now,
	};
	return { ok: true as const, job, hubId: hub.id };
}
