import { and, desc, eq } from "drizzle-orm";
import type { CtxData } from "../../action-utils/api-types";
import { getDb, newId } from "../../db/client";
import { restaurants, staffCourierMessages, users } from "../../db/schema";
import { parseIssuerRole } from "../auth/roles";
import type { ChatAuthorKind, ChatCourier, ChatMessage } from "./types";

export type { ChatAuthorKind, ChatCourier, ChatMessage };

export async function listRestaurantCouriers(
	ctx: EventContext<Env, never, CtxData>,
	restaurantId: string,
): Promise<ChatCourier[]> {
	const db = getDb(ctx);
	const [resto] = await db
		.select()
		.from(restaurants)
		.where(eq(restaurants.id, restaurantId))
		.limit(1)
		.all();
	if (!resto) {
		return [];
	}
	const people = await db.select().from(users).all();
	return people
		.filter((user) => {
			const parsed = parseIssuerRole(user.issuerRole);
			if (!parsed || parsed.permission !== "courier") {
				return false;
			}
			return parsed.tenant === resto.slug || parsed.isPlatformOwner;
		})
		.map((user) => ({
			id: user.id,
			name: user.name,
			email: user.email,
		}));
}

export async function listMessages(
	ctx: EventContext<Env, never, CtxData>,
	restaurantId: string,
	courierUserId: string,
	limit = 80,
): Promise<ChatMessage[]> {
	if (!courierUserId) {
		return [];
	}
	const db = getDb(ctx);
	const rows = await db
		.select({
			id: staffCourierMessages.id,
			courierUserId: staffCourierMessages.courierUserId,
			authorUserId: staffCourierMessages.authorUserId,
			authorKind: staffCourierMessages.authorKind,
			body: staffCourierMessages.body,
			createdAt: staffCourierMessages.createdAt,
			authorName: users.name,
			authorEmail: users.email,
		})
		.from(staffCourierMessages)
		.leftJoin(users, eq(users.id, staffCourierMessages.authorUserId))
		.where(
			and(
				eq(staffCourierMessages.restaurantId, restaurantId),
				eq(staffCourierMessages.courierUserId, courierUserId),
			),
		)
		.orderBy(desc(staffCourierMessages.createdAt))
		.all();
	return rows
		.slice(0, limit)
		.reverse()
		.map((row) => ({
			id: row.id,
			courierUserId: row.courierUserId,
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
		courierUserId: string;
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
	if (!input.courierUserId) {
		return { ok: false as const, error: "Livreur requis." };
	}
	const db = getDb(ctx);
	const id = newId("msg");
	const createdAt = new Date().toISOString();
	await db.insert(staffCourierMessages).values({
		id,
		restaurantId: input.restaurantId,
		courierUserId: input.courierUserId,
		authorUserId: input.authorUserId,
		authorKind: input.authorKind,
		body,
		createdAt,
	});
	return { ok: true as const, id, createdAt };
}
