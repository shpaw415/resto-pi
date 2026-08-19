"use action";

import { getContext } from "@next/action/context";
import type { CtxData } from "../../../../action-utils/api-types";
import type { LiveSession } from "../../../../lib/live/protocol";
import { mintLiveTicket } from "../../../../lib/live/ticket";
import { resolveOpsRestaurant } from "../../../../lib/ops/access";

export async function GET(restaurantId?: string) {
	const ctx = getContext(arguments) as unknown as EventContext<
		Env,
		never,
		CtxData
	>;
	const access = await resolveOpsRestaurant(ctx, restaurantId);
	if (!access.ok) {
		return { ok: false as const, error: access.error };
	}
	const peer = {
		userId: access.identity.id!,
		kind: access.authorKind,
		name: access.identity.name ?? access.identity.email,
		restaurantId: access.restaurantId,
	};
	if (ctx.env.RESTO_LIVE) {
		return {
			ok: true as const,
			mode: "proxy",
			url: `/api/private/live/connect?restaurantId=${encodeURIComponent(access.restaurantId)}`,
			restaurantId: access.restaurantId,
			authorKind: access.authorKind,
		} satisfies LiveSession;
	}
	const origin = (
		ctx.env.PUBLIC_LIVE_ORIGIN ||
		process.env.PUBLIC_LIVE_ORIGIN ||
		""
	).replace(/\/$/, "");
	if (!origin) {
		return { ok: false as const, error: "Flux live indisponible." };
	}
	const secret = ctx.env.AUTH_SECRET || process.env.AUTH_SECRET || "";
	if (!secret) {
		return { ok: false as const, error: "AUTH_SECRET manquant." };
	}
	const ticket = await mintLiveTicket(secret, peer);
	const wsOrigin = origin.replace(/^http/i, "ws");
	return {
		ok: true as const,
		mode: "ticket",
		url: `${wsOrigin}/ws?ticket=${encodeURIComponent(ticket)}`,
		ticket,
		restaurantId: access.restaurantId,
		authorKind: access.authorKind,
	} satisfies LiveSession;
}
