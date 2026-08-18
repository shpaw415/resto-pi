"no action";

import type { CtxData } from "../../../../action-utils/api-types";
import { hasScope } from "../../../../lib/api-keys/service";
import { getOrderById } from "../../../../lib/orders/service";

export const onRequestGet: PagesFunction<Env, "id", CtxData> = async (ctx) => {
	const key = ctx.data.apiKey;
	if (!key || !hasScope(key.scopes, "orders:read")) {
		return Response.json({ error: "Scope orders:read requis." }, { status: 403 });
	}
	const id = Array.isArray(ctx.params.id) ? ctx.params.id[0] : ctx.params.id;
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
