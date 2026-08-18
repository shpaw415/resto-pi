import { asc, eq } from "drizzle-orm";
import type { CtxData } from "../../action-utils/api-types";
import { getDb, newId } from "../../db/client";
import { restaurants } from "../../db/schema";
import type { ParsedRole } from "../auth/roles";
import { canManageRestaurants } from "../auth/roles";

export type SaveRestaurantInput = {
	id?: string;
	slug: string;
	name: string;
	address?: string;
	phone?: string;
	isActive?: boolean;
};

export function slugify(value: string): string {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);
}

export async function listRestaurants(
	ctx: EventContext<Env, never, CtxData>,
	parsed: ParsedRole | null,
) {
	const db = getDb(ctx);
	const rows = await db
		.select()
		.from(restaurants)
		.orderBy(asc(restaurants.name))
		.all();
	if (!parsed || parsed.isPlatformOwner) {
		return rows;
	}
	return rows.filter((row) => row.slug === parsed.tenant);
}

export async function saveRestaurant(
	ctx: EventContext<Env, never, CtxData>,
	parsed: ParsedRole | null,
	input: SaveRestaurantInput,
) {
	if (!canManageRestaurants(parsed)) {
		return { ok: false as const, error: "Accès refusé." };
	}
	const slug = slugify(input.slug || input.name);
	if (!slug || !input.name.trim()) {
		return { ok: false as const, error: "Nom et identifiant requis." };
	}
	const db = getDb(ctx);
	const now = new Date().toISOString();
	if (input.id) {
		await db
			.update(restaurants)
			.set({
				slug,
				name: input.name.trim(),
				address: input.address?.trim() || null,
				phone: input.phone?.trim() || null,
				isActive: input.isActive ?? true,
				updatedAt: now,
			})
			.where(eq(restaurants.id, input.id));
		return { ok: true as const, id: input.id, slug };
	}
	const id = newId("rst");
	await db.insert(restaurants).values({
		id,
		slug,
		name: input.name.trim(),
		address: input.address?.trim() || null,
		phone: input.phone?.trim() || null,
		isActive: input.isActive ?? true,
		updatedAt: now,
	});
	return { ok: true as const, id, slug };
}
