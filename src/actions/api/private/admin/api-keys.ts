"use action";

import { getContext } from "@next/action/context";
import type { CtxData } from "../../../../action-utils/api-types";
import type { ApiKeyScope } from "../../../../db/schema";
import { canManageApiKeys } from "../../../../lib/auth/roles";
import { getAccessibleRestaurant } from "../../../../lib/auth/guard";
import {
	createApiKey,
	listApiKeys,
	revokeApiKey,
} from "../../../../lib/api-keys/service";

export async function GET(restaurantId: string) {
	const ctx = getContext(arguments) as unknown as EventContext<
		Env,
		never,
		CtxData
	>;
	const access = await getAccessibleRestaurant(ctx, restaurantId);
	if (!access.ok) {
		return { ok: false as const, error: access.error };
	}
	if (!canManageApiKeys(access.parsed)) {
		return { ok: false as const, error: "Accès refusé." };
	}
	return listApiKeys(ctx, restaurantId);
}

export async function POST(body: {
	restaurantId: string;
	name: string;
	scopes: ApiKeyScope[];
}) {
	const ctx = getContext(arguments) as unknown as EventContext<
		Env,
		never,
		CtxData
	>;
	const access = await getAccessibleRestaurant(ctx, body.restaurantId);
	if (!access.ok) {
		return { ok: false as const, error: access.error };
	}
	const { parsed } = access;
	if (!canManageApiKeys(parsed)) {
		return { ok: false as const, error: "Accès refusé." };
	}
	return createApiKey(ctx, body);
}

export async function DELETE(restaurantId: string, id: string) {
	const ctx = getContext(arguments) as unknown as EventContext<
		Env,
		never,
		CtxData
	>;
	const access = await getAccessibleRestaurant(ctx, restaurantId);
	if (!access.ok) {
		return { ok: false as const, error: access.error };
	}
	if (!canManageApiKeys(access.parsed)) {
		return { ok: false as const, error: "Accès refusé." };
	}
	return revokeApiKey(ctx, id, restaurantId);
}
