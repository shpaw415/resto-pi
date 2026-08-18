import { createClient } from "@auth";
import type { CtxData } from "../../action-utils/api-types";
import { resolveUserIdentity } from "../../lib/auth/identity";

export const onRequest: PagesFunction<Env, never, CtxData> = async (ctx) => {
	try {
		const auth = await createClient({ ctx })
			.setTokenFromRequest(ctx.request)
			.catch(() => ({ isAuthenticated: false }) as never);
		ctx.data.auth = auth;
		if (!auth.isAuthenticated) {
			return new Response(null, {
				status: 302,
				headers: { Location: "/login" },
			});
		}
		ctx.data.identity = await resolveUserIdentity(auth);
		return ctx.next();
	} catch (error) {
		console.error("livreur middleware", error);
		return new Response("Internal Server Error", { status: 500 });
	}
};
