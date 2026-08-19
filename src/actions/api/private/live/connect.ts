"no action";

import type { CtxData } from "../../../../action-utils/api-types";
import { resolveOpsRestaurant } from "../../../../lib/ops/access";

export const onRequest: PagesFunction<Env, never, CtxData> = async (ctx) => {
	if (ctx.request.headers.get("Upgrade") !== "websocket") {
		return new Response("Expected websocket", { status: 426 });
	}
	const restaurantId = new URL(ctx.request.url).searchParams.get("restaurantId") ?? undefined;
	const access = await resolveOpsRestaurant(ctx, restaurantId);
	if (!access.ok) {
		return new Response(access.error, { status: 403 });
	}
	if (!ctx.env.RESTO_LIVE) {
		return new Response("Flux live indisponible.", { status: 503 });
	}
	const headers = new Headers(ctx.request.headers);
	headers.set(
		"x-resto-live",
		JSON.stringify({
			userId: access.identity.id,
			kind: access.authorKind,
			name: access.identity.name ?? access.identity.email,
			restaurantId: access.restaurantId,
		}),
	);
	const stub = ctx.env.RESTO_LIVE.getByName(`resto:${access.restaurantId}`);
	return stub.fetch(new Request(ctx.request, { headers }));
};
