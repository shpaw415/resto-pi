import { createOpenAuthsterClient } from "openauthster-shared/client/user";
import type { CtxData } from "./action-utils/api-types";

export type PublicSession = {
	email?: string;
	name?: string;
	role?: string;
};

export type PrivateSession = Record<string, never>;

const clientCache = new Map<string, unknown>();

function truncateKey(key: string) {
	if (key.length > 100) {
		return key.slice(0, 100);
	}
	return key;
}

export function createClient(
	props: { ctx?: EventContext<Env, never, CtxData> } = {},
) {
	return createOpenAuthsterClient<PublicSession, PrivateSession, string>({
		issuerURI: process.env.PUBLIC_AUTH_ISSUER as string,
		clientID: process.env.PUBLIC_AUTH_CLIENT_ID as string,
		redirectURI:
			(process.env.PUBLIC_AUTH_REDIRECT_URI as string | undefined) ??
			"http://localhost:3000/callback",
		secret: process.env.AUTH_SECRET as string,
		cache_provider: {
			async get(key) {
				if (!props.ctx) {
					const res = clientCache.get(key);
					if (!res) return null;
					return res;
				}
				const res = await props.ctx.env.DYNAMIC_PAGE_KV.get(truncateKey(key));
				if (!res) return null;
				return JSON.parse(res);
			},
			async set(key, value, ttl) {
				if (!props.ctx) {
					clientCache.set(key, value);
					return;
				}
				await props.ctx.env.DYNAMIC_PAGE_KV.put(
					truncateKey(key),
					JSON.stringify(value),
					{
						expirationTtl: Math.max(
							60,
							Math.floor((ttl.getTime() - Date.now()) / 1000),
						),
					},
				);
			},
			async delete(key) {
				if (!props.ctx) {
					clientCache.delete(key);
					return;
				}
				await props.ctx.env.DYNAMIC_PAGE_KV.delete(truncateKey(key));
			},
		},
	});
}

export type ClientType = ReturnType<typeof createClient>;
