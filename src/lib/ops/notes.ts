import { and, eq } from "drizzle-orm";
import type { CtxData } from "../../action-utils/api-types";
import { getDb, newId } from "../../db/client";
import { clientNotes, users } from "../../db/schema";
import { normalizePhone } from "./phone";
import type { ClientNote } from "./types";

export type { ClientNote };

export async function getClientNote(
	ctx: EventContext<Env, never, CtxData>,
	restaurantId: string,
	rawPhone: string,
): Promise<ClientNote | null> {
	const phone = normalizePhone(rawPhone);
	if (!phone) {
		return null;
	}
	const db = getDb(ctx);
	const [row] = await db
		.select({
			phone: clientNotes.phone,
			note: clientNotes.note,
			updatedAt: clientNotes.updatedAt,
			updatedByName: users.name,
			updatedByEmail: users.email,
		})
		.from(clientNotes)
		.leftJoin(users, eq(users.id, clientNotes.updatedByUserId))
		.where(
			and(
				eq(clientNotes.restaurantId, restaurantId),
				eq(clientNotes.phone, phone),
			),
		)
		.limit(1)
		.all();
	if (!row) {
		return { phone, note: "", updatedAt: "", updatedByName: null };
	}
	return {
		phone: row.phone,
		note: row.note,
		updatedAt: row.updatedAt,
		updatedByName: row.updatedByName ?? row.updatedByEmail ?? null,
	};
}

export async function saveClientNote(
	ctx: EventContext<Env, never, CtxData>,
	input: {
		restaurantId: string;
		phone: string;
		note: string;
		userId: string;
	},
) {
	const phone = normalizePhone(input.phone);
	if (!phone) {
		return { ok: false as const, error: "Téléphone invalide." };
	}
	const note = input.note.trim();
	if (note.length > 4000) {
		return { ok: false as const, error: "Note trop longue." };
	}
	const db = getDb(ctx);
	const now = new Date().toISOString();
	const [existing] = await db
		.select({ id: clientNotes.id })
		.from(clientNotes)
		.where(
			and(
				eq(clientNotes.restaurantId, input.restaurantId),
				eq(clientNotes.phone, phone),
			),
		)
		.limit(1)
		.all();
	if (existing) {
		await db
			.update(clientNotes)
			.set({
				note,
				updatedByUserId: input.userId,
				updatedAt: now,
			})
			.where(eq(clientNotes.id, existing.id));
		return { ok: true as const, phone };
	}
	await db.insert(clientNotes).values({
		id: newId("nte"),
		restaurantId: input.restaurantId,
		phone,
		note,
		updatedByUserId: input.userId,
		updatedAt: now,
	});
	return { ok: true as const, phone };
}
