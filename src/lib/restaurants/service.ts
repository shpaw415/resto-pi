import { asc, eq } from "drizzle-orm";
import type { CtxData } from "../../action-utils/api-types";
import { getDb, newId } from "../../db/client";
import { restaurants } from "../../db/schema";
import type { ParsedRole } from "../auth/roles";
import { canEditRestaurant, canManageRestaurants } from "../auth/roles";
import { geocodeAddress, withQuebecHint } from "../geo/nominatim";

export type SaveRestaurantInput = {
	id?: string;
	slug: string;
	name: string;
	address?: string;
	phone?: string;
	lat?: number | null;
	lng?: number | null;
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
	if (!input.id && !canManageRestaurants(parsed)) {
		return { ok: false as const, error: "Accès refusé." };
	}
	const requestedSlug = slugify(input.slug || input.name);
	if (!requestedSlug || !input.name.trim()) {
		return { ok: false as const, error: "Nom et identifiant requis." };
	}
	const db = getDb(ctx);
	const now = new Date().toISOString();
	let lat = input.lat ?? null;
	let lng = input.lng ?? null;
	const address = input.address?.trim() || null;
	if ((lat == null || lng == null) && address) {
		const geo = await geocodeAddress(withQuebecHint(address));
		if (geo) {
			lat = geo.lat;
			lng = geo.lng;
		}
	}
	if (input.id) {
		const [existing] = await db
			.select()
			.from(restaurants)
			.where(eq(restaurants.id, input.id))
			.limit(1)
			.all();
		if (!existing) {
			return { ok: false as const, error: "Restaurant introuvable." };
		}
		if (!canEditRestaurant(parsed, existing.slug)) {
			return { ok: false as const, error: "Accès refusé." };
		}
		const slug = canManageRestaurants(parsed) ? requestedSlug : existing.slug;
		await db
			.update(restaurants)
			.set({
				slug,
				name: input.name.trim(),
				address,
				phone: input.phone?.trim() || null,
				lat: lat ?? existing.lat,
				lng: lng ?? existing.lng,
				isActive: input.isActive ?? existing.isActive,
				updatedAt: now,
			})
			.where(eq(restaurants.id, input.id));
		return { ok: true as const, id: input.id, slug };
	}
	const id = newId("rst");
	await db.insert(restaurants).values({
		id,
		slug: requestedSlug,
		name: input.name.trim(),
		address,
		phone: input.phone?.trim() || null,
		lat,
		lng,
		isActive: input.isActive ?? true,
		updatedAt: now,
	});
	return { ok: true as const, id, slug: requestedSlug };
}
