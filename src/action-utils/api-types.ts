import type { createClient } from "../auth";
import type { AppDatabase } from "../db/client";
import type { UserIdentity } from "../lib/auth/identity";

export type AuthenticatedApiKey = {
	id: string;
	restaurantId: string;
	name: string;
	scopes: import("../db/schema").ApiKeyScope[];
};

export type CtxData = {
	auth?: ReturnType<typeof createClient>;
	db?: AppDatabase;
	identity?: UserIdentity;
	apiKey?: AuthenticatedApiKey;
};
