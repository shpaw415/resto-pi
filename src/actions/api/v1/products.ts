"no action";

import type { CtxData } from "../../../action-utils/api-types";
import { hasScope } from "../../../lib/api-keys/service";
import { listPublicCatalog } from "../../../lib/catalog/public";

export const onRequestGet: PagesFunction<Env, never, CtxData> = async (ctx) => {
	const key = ctx.data.apiKey;
	if (!key || !hasScope(key.scopes, "catalog:read")) {
		return Response.json({ error: "Scope catalog:read requis." }, { status: 403 });
	}
	const catalog = await listPublicCatalog(ctx, key.restaurantId);
	return Response.json(catalog);
};
