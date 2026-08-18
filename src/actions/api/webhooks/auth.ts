"no action";

import { WebHook } from "openauthster-shared/webhook";
import { createDb } from "../../../db/client";
import { users } from "../../../db/schema";

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
	const secret = ctx.env.AUTH_SECRET;
	if (!secret) {
		return new Response("AUTH_SECRET manquant", { status: 500 });
	}
	try {
		const payload = await WebHook.getWebHookPayloadFromRequest(
			"login_success",
			ctx.request,
			secret,
		);
		const db = createDb(ctx.env);
		const userId = payload.data.userID;
		const now = new Date().toISOString();
		await db
			.insert(users)
			.values({
				id: userId,
				issuerRole: null,
				lastLoginAt: now,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: users.id,
				set: { lastLoginAt: now, updatedAt: now },
			});
		return new Response("ok");
	} catch {
		try {
			const payload = await WebHook.getWebHookPayloadFromRequest(
				"registration_success",
				ctx.request,
				secret,
			);
			const db = createDb(ctx.env);
			const now = new Date().toISOString();
			await db
				.insert(users)
				.values({
					id: payload.data.userID,
					lastLoginAt: now,
					updatedAt: now,
				})
				.onConflictDoUpdate({
					target: users.id,
					set: { lastLoginAt: now, updatedAt: now },
				});
			return new Response("ok");
		} catch {
			return new Response("unauthorized", { status: 401 });
		}
	}
};
