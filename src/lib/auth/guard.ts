import type { CtxData } from "../../action-utils/api-types";
import { resolveActiveRestaurant } from "./access";
import type { UserIdentity } from "./identity";
import { canAccessRestaurant, type ParsedRole } from "./roles";

export function getIdentity(
	ctx: EventContext<Env, never, CtxData>,
): UserIdentity | null {
	return ctx.data.identity ?? null;
}

export async function getAccessibleRestaurant(
	ctx: EventContext<Env, never, CtxData>,
	restaurantId: string,
): Promise<
	| { ok: true; identity: UserIdentity; parsed: ParsedRole; restaurantId: string }
	| { ok: false; error: string }
> {
	const identity = ctx.data.identity;
	if (!identity?.parsed) {
		return { ok: false, error: "Accès refusé." };
	}
	const { restaurants } = await resolveActiveRestaurant(ctx, identity.parsed);
	const match = restaurants.find((row) => row.id === restaurantId);
	if (!match || !canAccessRestaurant(identity.parsed, match.slug)) {
		return { ok: false, error: "Restaurant inaccessible." };
	}
	return {
		ok: true,
		identity,
		parsed: identity.parsed,
		restaurantId: match.id,
	};
}
