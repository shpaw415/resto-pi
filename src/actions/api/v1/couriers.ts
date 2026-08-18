"no action";

import type { CtxData } from "../../../action-utils/api-types";
import { hasScope } from "../../../lib/api-keys/service";

export const onRequestGet: PagesFunction<Env, never, CtxData> = async (ctx) => {
	const key = ctx.data.apiKey;
	if (!key || !hasScope(key.scopes, "tracking:read")) {
		return Response.json({ error: "Scope tracking:read requis." }, { status: 403 });
	}
	return Response.json(
		{ error: "Suivi livreur disponible en phase 2." },
		{ status: 501 },
	);
};
