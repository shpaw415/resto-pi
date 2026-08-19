import { desc, eq } from "drizzle-orm";
import type { CtxData } from "../../action-utils/api-types";
import { getDb, newId } from "../../db/client";
import { staffCourierMessages, users } from "../../db/schema";
import type { ChatAuthorKind, ChatMessage } from "./types";

export type { ChatAuthorKind, ChatMessage };

export async function listMessages(
	ctx: EventContext<Env, never, CtxData>,
	restaurantId: string,
	limit = 80,
): Promise<ChatMessage[]> {
	const db = getDb(ctx);
	const rows = await db
		.select({
			id: staffCourierMessages.id,
			authorUserId: staffCourierMessages.authorUserId,
			authorKind: staffCourierMessages.authorKind,
			body: staffCourierMessages.body,
			createdAt: staffCourierMessages.createdAt,
			authorName: users.name,
			authorEmail: users.email,
		})
		.from(staffCourierMessages)
		.leftJoin(users, eq(users.id, staffCourierMessages.authorUserId))
		.where(eq(staffCourierMessages.restaurantId, restaurantId))
		.orderBy(desc(staffCourierMessages.createdAt))
		.all();
	return rows
		.slice(0, limit)
		.reverse()
		.map((row) => ({
			id: row.id,
			authorUserId: row.authorUserId,
			authorKind: row.authorKind === "courier" ? "courier" : "staff",
			authorName: row.authorName ?? row.authorEmail ?? null,
			body: row.body,
			createdAt: row.createdAt,
		}));
}

export async function postMessage(
	ctx: EventContext<Env, never, CtxData>,
	input: {
		restaurantId: string;
		authorUserId: string;
		authorKind: ChatAuthorKind;
		body: string;
	},
) {
	const body = input.body.trim();
	if (!body) {
		return { ok: false as const, error: "Message vide." };
	}
	if (body.length > 1000) {
		return { ok: false as const, error: "Message trop long." };
	}
	const db = getDb(ctx);
	const id = newId("msg");
	const createdAt = new Date().toISOString();
	await db.insert(staffCourierMessages).values({
		id,
		restaurantId: input.restaurantId,
		authorUserId: input.authorUserId,
		authorKind: input.authorKind,
		body,
		createdAt,
	});
	return { ok: true as const, id, createdAt };
}
