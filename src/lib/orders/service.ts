import { and, desc, eq } from "drizzle-orm";
import type { CtxData } from "../../action-utils/api-types";
import { getDb, newId } from "../../db/client";
import {
	type OrderSource,
	type OrderStatus,
	type OrderType,
	orderItemExtras,
	orderItems,
	orderStatusEvents,
	orders,
	productVariants,
	products,
} from "../../db/schema";
import type { UserIdentity } from "../auth/identity";
import { nextKitchenStatus, prevKitchenStatus } from "./status";

export type CreateOrderInput = {
	restaurantId: string;
	type: OrderType;
	source?: OrderSource;
	externalPosId?: string;
	customerName?: string;
	customerPhone?: string;
	customerAddress?: string;
	notes?: string;
	items: Array<{
		productId?: string;
		variantId?: string;
		name: string;
		quantity: number;
		unitPriceCents: number;
		extras?: Array<{ name: string; priceCentsDelta: number }>;
	}>;
};

export async function listOrders(
	ctx: EventContext<Env, never, CtxData>,
	restaurantId: string,
) {
	const db = getDb(ctx);
	const rows = await db
		.select()
		.from(orders)
		.where(eq(orders.restaurantId, restaurantId))
		.orderBy(desc(orders.createdAt))
		.all();
	const items = await db.select().from(orderItems).all();
	const extras = await db.select().from(orderItemExtras).all();
	return rows.map((order) => {
		const orderLine = items.filter((item) => item.orderId === order.id);
		return {
			...order,
			items: orderLine.map((item) => ({
				...item,
				extras: extras.filter((extra) => extra.orderItemId === item.id),
			})),
		};
	});
}

export async function findOrderByExternalId(
	ctx: EventContext<Env, never, CtxData>,
	restaurantId: string,
	externalPosId: string,
) {
	const db = getDb(ctx);
	const [row] = await db
		.select()
		.from(orders)
		.where(
			and(
				eq(orders.restaurantId, restaurantId),
				eq(orders.externalPosId, externalPosId),
			),
		)
		.limit(1)
		.all();
	return row ?? null;
}

export async function getOrderById(
	ctx: EventContext<Env, never, CtxData>,
	orderId: string,
	restaurantId?: string,
) {
	const db = getDb(ctx);
	const [order] = await db
		.select()
		.from(orders)
		.where(
			restaurantId
				? and(eq(orders.id, orderId), eq(orders.restaurantId, restaurantId))
				: eq(orders.id, orderId),
		)
		.limit(1)
		.all();
	if (!order) {
		return null;
	}
	const items = await db
		.select()
		.from(orderItems)
		.where(eq(orderItems.orderId, order.id))
		.all();
	const extras = await db.select().from(orderItemExtras).all();
	const events = await db
		.select()
		.from(orderStatusEvents)
		.where(eq(orderStatusEvents.orderId, order.id))
		.all();
	return {
		...order,
		items: items.map((item) => ({
			...item,
			extras: extras.filter((extra) => extra.orderItemId === item.id),
		})),
		events,
	};
}

export async function createOrder(
	ctx: EventContext<Env, never, CtxData>,
	input: CreateOrderInput,
	identity?: UserIdentity | null,
) {
	if (!input.items.length) {
		return { ok: false as const, error: "La commande est vide." };
	}
	const db = getDb(ctx);
	const id = newId("ord");
	let subtotal = 0;
	const now = new Date().toISOString();
	const resolvedItems = [];
	for (const item of input.items) {
		let name = item.name;
		let unitPrice = item.unitPriceCents;
		if (item.variantId) {
			const [variant] = await db
				.select()
				.from(productVariants)
				.where(eq(productVariants.id, item.variantId))
				.limit(1)
				.all();
			if (variant) {
				unitPrice = variant.priceCents;
				const [product] = item.productId
					? await db
							.select()
							.from(products)
							.where(eq(products.id, item.productId))
							.limit(1)
							.all()
					: [];
				name = product
					? `${product.name} — ${variant.name}`
					: variant.name;
			}
		}
		const extrasTotal = (item.extras ?? []).reduce(
			(sum, extra) => sum + extra.priceCentsDelta,
			0,
		);
		const qty = Math.max(1, item.quantity);
		subtotal += (unitPrice + extrasTotal) * qty;
		resolvedItems.push({
			...item,
			name,
			unitPriceCents: unitPrice,
			quantity: qty,
		});
	}

	await db.insert(orders).values({
		id,
		restaurantId: input.restaurantId,
		type: input.type,
		status: "en_attente",
		source: input.source ?? "api",
		externalPosId: input.externalPosId ?? null,
		customerName: input.customerName?.trim() || null,
		customerPhone: input.customerPhone?.trim() || null,
		customerAddress: input.customerAddress?.trim() || null,
		notes: input.notes?.trim() || null,
		subtotalCents: subtotal,
		totalCents: subtotal,
		createdByUserId: identity?.id ?? null,
		updatedAt: now,
	});

	for (const item of resolvedItems) {
		const itemId = newId("itm");
		await db.insert(orderItems).values({
			id: itemId,
			orderId: id,
			productId: item.productId ?? null,
			variantId: item.variantId ?? null,
			nameSnapshot: item.name,
			quantity: item.quantity,
			unitPriceCents: item.unitPriceCents,
		});
		for (const extra of item.extras ?? []) {
			await db.insert(orderItemExtras).values({
				id: newId("itx"),
				orderItemId: itemId,
				nameSnapshot: extra.name,
				priceCentsDelta: extra.priceCentsDelta,
			});
		}
	}

	await db.insert(orderStatusEvents).values({
		id: newId("ose"),
		orderId: id,
		fromStatus: null,
		toStatus: "en_attente",
		actorUserId: identity?.id ?? null,
		actorLabel: identity?.name || identity?.email || input.source || "api",
	});

	return { ok: true as const, id };
}

export async function transitionOrder(
	ctx: EventContext<Env, never, CtxData>,
	orderId: string,
	restaurantId: string,
	direction: "next" | "prev",
	identity?: UserIdentity | null,
) {
	const db = getDb(ctx);
	const [order] = await db
		.select()
		.from(orders)
		.where(and(eq(orders.id, orderId), eq(orders.restaurantId, restaurantId)))
		.limit(1)
		.all();
	if (!order) {
		return { ok: false as const, error: "Commande introuvable." };
	}
	const next =
		direction === "next"
			? nextKitchenStatus(order.status)
			: prevKitchenStatus(order.status);
	if (!next) {
		return { ok: false as const, error: "Transition impossible." };
	}
	const now = new Date().toISOString();
	await db
		.update(orders)
		.set({ status: next, updatedAt: now })
		.where(eq(orders.id, order.id));
	await db.insert(orderStatusEvents).values({
		id: newId("ose"),
		orderId: order.id,
		fromStatus: order.status,
		toStatus: next,
		actorUserId: identity?.id ?? null,
		actorLabel: identity?.name || identity?.email || "staff",
	});
	return { ok: true as const, status: next };
}

export function countByStatus(
	rows: Array<{ status: OrderStatus }>,
): Record<OrderStatus, number> {
	const counts = {
		en_attente: 0,
		peut_preparer: 0,
		en_preparation: 0,
		pret: 0,
		termine: 0,
		assigne: 0,
		en_livraison: 0,
		livre: 0,
	} satisfies Record<OrderStatus, number>;
	for (const row of rows) {
		counts[row.status] += 1;
	}
	return counts;
}
