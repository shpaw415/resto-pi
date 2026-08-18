"no action";

import type { CtxData } from "../../../action-utils/api-types";
import { hasScope } from "../../../lib/api-keys/service";
import {
	createOrder,
	getOrderById,
	type CreateOrderInput,
} from "../../../lib/orders/service";

export const onRequestGet: PagesFunction<Env, never, CtxData> = async (ctx) => {
	const key = ctx.data.apiKey;
	if (!key || !hasScope(key.scopes, "orders:read")) {
		return Response.json({ error: "Scope orders:read requis." }, { status: 403 });
	}
	const url = new URL(ctx.request.url);
	const id = url.searchParams.get("id");
	if (!id) {
		return Response.json({ error: "id requis." }, { status: 400 });
	}
	const order = await getOrderById(ctx, id, key.restaurantId);
	if (!order) {
		return Response.json({ error: "Introuvable." }, { status: 404 });
	}
	return Response.json({
		id: order.id,
		status: order.status,
		type: order.type,
		totalCents: order.totalCents,
		customerName: order.customerName,
		items: order.items,
	});
};

export const onRequestPost: PagesFunction<Env, never, CtxData> = async (ctx) => {
	const key = ctx.data.apiKey;
	if (!key || !hasScope(key.scopes, "orders:write")) {
		return Response.json({ error: "Scope orders:write requis." }, { status: 403 });
	}
	const body = (await ctx.request.json()) as Omit<
		CreateOrderInput,
		"restaurantId" | "source"
	>;
	const result = await createOrder(ctx, {
		...body,
		restaurantId: key.restaurantId,
		source: "api",
	});
	if (!result.ok) {
		return Response.json({ error: result.error }, { status: 400 });
	}
	return Response.json({ id: result.id, status: "en_attente" }, { status: 201 });
};
