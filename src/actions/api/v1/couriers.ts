"no action";

import type { CtxData } from "../../../action-utils/api-types";
import { hasScope } from "../../../lib/api-keys/service";
import { listLatestCourierPositions } from "../../../lib/tracking/service";

export const onRequestGet: PagesFunction<Env, never, CtxData> = async (ctx) => {
	const key = ctx.data.apiKey;
	if (!key || !hasScope(key.scopes, "tracking:read")) {
		return Response.json({ error: "Scope tracking:read requis." }, { status: 403 });
	}
	const couriers = await listLatestCourierPositions(ctx, key.restaurantId);
	return Response.json({ couriers });
};
