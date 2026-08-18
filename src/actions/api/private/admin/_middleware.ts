import type { CtxData } from "../../../../action-utils/api-types";
import { canEnterAdmin } from "../../../../lib/auth/identity";

export const onRequest: PagesFunction<Env, never, CtxData> = async (ctx) => {
	if (!canEnterAdmin(ctx.data.identity ?? {
		id: null,
		email: null,
		name: null,
		role: null,
		parsed: null,
	})) {
		return new Response("Forbidden", { status: 403 });
	}
	return ctx.next();
};
