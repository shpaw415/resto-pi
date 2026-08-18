import type { CtxData } from "../../../action-utils/api-types";
import { authenticateApiKey } from "../../../lib/api-keys/service";

const CORS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers": "Authorization, Content-Type",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export const onRequest: PagesFunction<Env, never, CtxData> = async (ctx) => {
	if (ctx.request.method === "OPTIONS") {
		return new Response(null, { status: 204, headers: CORS });
	}
	const key = await authenticateApiKey(
		ctx,
		ctx.request.headers.get("authorization"),
	);
	if (!key) {
		return new Response(JSON.stringify({ error: "Clé API invalide." }), {
			status: 401,
			headers: { "content-type": "application/json", ...CORS },
		});
	}
	ctx.data.apiKey = {
		id: key.id,
		restaurantId: key.restaurantId,
		name: key.name,
		scopes: key.scopes,
	};
	const response = await ctx.next();
	const headers = new Headers(response.headers);
	for (const [name, value] of Object.entries(CORS)) {
		headers.set(name, value);
	}
	return new Response(response.body, {
		status: response.status,
		headers,
	});
};
