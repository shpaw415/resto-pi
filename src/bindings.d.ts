interface Env {
	DB: D1Database;
	RESTO_LIVE?: DurableObjectNamespace;
	PUBLIC_LIVE_ORIGIN?: string;
	AUTH_SECRET?: string;
}
