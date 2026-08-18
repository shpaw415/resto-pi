export {};

declare global {
	interface Env {
		DB: D1Database;
		DYNAMIC_PAGE_KV: KVNamespace;
		AUTH_SECRET?: string;
		PUBLIC_AUTH_CLIENT_ID?: string;
		PUBLIC_AUTH_ISSUER?: string;
		PUBLIC_AUTH_REDIRECT_URI?: string;
	}
}
