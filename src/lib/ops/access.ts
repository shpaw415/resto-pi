import type { CtxData } from "../../action-utils/api-types";
import {
	resolveActiveRestaurant,
	upsertUserFromIdentity,
} from "../auth/access";
import { getAccessibleRestaurant } from "../auth/guard";
import type { ParsedRole } from "../auth/roles";
import {
	canAccessAdmin,
	canShareCourierPosition,
} from "../auth/roles";

export function canUseOps(parsed: ParsedRole | null): boolean {
	return canAccessAdmin(parsed) || canShareCourierPosition(parsed);
}

export async function resolveOpsRestaurant(
	ctx: EventContext<Env, never, CtxData>,
	restaurantId?: string,
) {
	const identity = ctx.data.identity;
	if (!identity?.id || !identity.parsed) {
		return { ok: false as const, error: "Non authentifié." };
	}
	if (!canUseOps(identity.parsed)) {
		return { ok: false as const, error: "Accès refusé." };
	}
	await upsertUserFromIdentity(ctx, identity);
	if (restaurantId) {
		const access = await getAccessibleRestaurant(ctx, restaurantId);
		if (!access.ok) {
			return { ok: false as const, error: access.error };
		}
		return {
			ok: true as const,
			identity,
			restaurantId: access.restaurantId,
			authorKind:
				canShareCourierPosition(identity.parsed) &&
				!canAccessAdmin(identity.parsed)
					? ("courier" as const)
					: ("staff" as const),
		};
	}
	const { active } = await resolveActiveRestaurant(ctx, identity.parsed);
	if (!active) {
		return { ok: false as const, error: "Aucun restaurant lié." };
	}
	return {
		ok: true as const,
		identity,
		restaurantId: active.id,
		authorKind:
			canShareCourierPosition(identity.parsed) &&
			!canAccessAdmin(identity.parsed)
				? ("courier" as const)
				: ("staff" as const),
	};
}
