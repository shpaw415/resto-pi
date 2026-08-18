"use action";

import { getContext } from "@next/action/context";
import type { CtxData } from "../../../../action-utils/api-types";
import { getIdentity } from "../../../../lib/auth/guard";
import { RESTAURANT_COOKIE } from "../../../../common";
import {
	listRestaurants,
	saveRestaurant,
	type SaveRestaurantInput,
} from "../../../../lib/restaurants/service";

export async function GET() {
	const ctx = getContext(arguments) as unknown as EventContext<
		Env,
		never,
		CtxData
	>;
	const identity = getIdentity(ctx);
	if (!identity?.parsed) {
		return [];
	}
	return listRestaurants(ctx, identity.parsed);
}

export async function POST(body: SaveRestaurantInput) {
	const ctx = getContext(arguments) as unknown as EventContext<
		Env,
		never,
		CtxData
	>;
	const identity = getIdentity(ctx);
	return saveRestaurant(ctx, identity?.parsed ?? null, body);
}

export async function PUT(slug: string) {
	const ctx = getContext(arguments) as unknown as EventContext<
		Env,
		never,
		CtxData
	>;
	if (!getIdentity(ctx)?.parsed) {
		return { ok: false as const, error: "Accès refusé." };
	}
	return {
		ok: true as const,
		cookie: `${RESTAURANT_COOKIE}=${encodeURIComponent(slug)}; Path=/; SameSite=Lax`,
	};
}
