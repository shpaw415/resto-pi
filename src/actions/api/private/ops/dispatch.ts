"use action";

import { getContext } from "@next/action/context";
import type { CtxData } from "../../../../action-utils/api-types";
import type { DispatchStatus } from "../../../../db/schema";
import { canAccessAdmin } from "../../../../lib/auth/roles";
import {
	createDispatchJob,
	listHubJobs,
	setDispatchStatus,
	updateDispatchJob,
} from "../../../../lib/dispatch/service";
import { resolveOpsRestaurant } from "../../../../lib/ops/access";

export async function GET(restaurantId: string) {
	const ctx = getContext(arguments) as unknown as EventContext<
		Env,
		never,
		CtxData
	>;
	const access = await resolveOpsRestaurant(ctx, restaurantId || undefined);
	if (!access.ok) {
		return { ok: false as const, error: access.error };
	}
	const data = await listHubJobs(ctx, access.restaurantId);
	return { ok: true as const, ...data };
}

export async function POST(
	orderId: string,
	status: DispatchStatus,
	restaurantId: string,
) {
	const ctx = getContext(arguments) as unknown as EventContext<
		Env,
		never,
		CtxData
	>;
	const access = await resolveOpsRestaurant(ctx, restaurantId || undefined);
	if (!access.ok) {
		return { ok: false as const, error: access.error };
	}
	if (!canAccessAdmin(access.identity.parsed)) {
		return { ok: false as const, error: "Lecture seule." };
	}
	return setDispatchStatus(ctx, {
		orderId,
		restaurantId: access.restaurantId,
		status,
	});
}

export async function PUT(
	body: {
		id?: string;
		phone?: string;
		address?: string;
		note?: string;
		status?: DispatchStatus;
	},
	restaurantId: string,
) {
	const ctx = getContext(arguments) as unknown as EventContext<
		Env,
		never,
		CtxData
	>;
	const access = await resolveOpsRestaurant(ctx, restaurantId || undefined);
	if (!access.ok) {
		return { ok: false as const, error: access.error };
	}
	if (!canAccessAdmin(access.identity.parsed)) {
		return { ok: false as const, error: "Lecture seule." };
	}
	if (body.id) {
		return updateDispatchJob(ctx, {
			orderId: body.id,
			restaurantId: access.restaurantId,
			phone: body.phone,
			address: body.address,
			note: body.note,
			status: body.status,
		});
	}
	return createDispatchJob(ctx, {
		restaurantId: access.restaurantId,
		phone: body.phone,
		address: body.address,
		note: body.note,
		status: body.status,
	});
}
