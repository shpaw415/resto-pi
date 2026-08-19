"use action";

import { getContext } from "@next/action/context";
import type { CtxData } from "../../../../action-utils/api-types";
import { getIdentity } from "../../../../lib/auth/guard";
import { geocodeAddress, withQuebecHint } from "../../../../lib/geo/nominatim";
import { canAccessAdmin } from "../../../../lib/auth/roles";

export async function GET(address: string) {
	const ctx = getContext(arguments) as unknown as EventContext<
		Env,
		never,
		CtxData
	>;
	const identity = getIdentity(ctx);
	if (!canAccessAdmin(identity?.parsed ?? null)) {
		return { ok: false as const, error: "Accès refusé." };
	}
	const geo = await geocodeAddress(withQuebecHint(address));
	if (!geo) {
		return { ok: false as const, error: "Adresse introuvable." };
	}
	return { ok: true as const, ...geo };
}
