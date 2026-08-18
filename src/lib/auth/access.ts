import type { CtxData } from "../../action-utils/api-types";
import { RESTAURANT_COOKIE } from "../../common";
import { getDb } from "../../db/client";
import { restaurants, users } from "../../db/schema";
import type { UserIdentity } from "./identity";
import { canAccessRestaurant, type ParsedRole } from "./roles";

export function readCookie(request: Request, name: string): string | null {
	const header = request.headers.get("cookie");
	if (!header) {
		return null;
	}
	for (const part of header.split(";")) {
		const [rawKey, ...rest] = part.trim().split("=");
		if (rawKey === name) {
			return decodeURIComponent(rest.join("="));
		}
	}
	return null;
}

export async function resolveActiveRestaurant(
	ctx: EventContext<Env, never, CtxData>,
	parsed: ParsedRole | null,
) {
	const db = getDb(ctx);
	const all = await db.select().from(restaurants).all();
	if (!parsed) {
		return { restaurants: all, active: null as (typeof all)[number] | null };
	}
	const visible = parsed.isPlatformOwner
		? all
		: all.filter((row) => row.slug === parsed.tenant);
	const cookieSlug = readCookie(ctx.request, RESTAURANT_COOKIE);
	const active =
		visible.find((row) => row.slug === cookieSlug) ?? visible[0] ?? null;
	return { restaurants: visible, active };
}

export function assertRestaurantAccess(
	parsed: ParsedRole | null,
	slug: string,
): boolean {
	return canAccessRestaurant(parsed, slug);
}

export async function upsertUserFromIdentity(
	ctx: EventContext<Env, never, CtxData>,
	identity: UserIdentity,
) {
	if (!identity.id) {
		return;
	}
	const db = getDb(ctx);
	const now = new Date().toISOString();
	await db
		.insert(users)
		.values({
			id: identity.id,
			email: identity.email,
			name: identity.name,
			issuerRole: identity.role,
			lastLoginAt: now,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: users.id,
			set: {
				email: identity.email,
				name: identity.name,
				issuerRole: identity.role,
				lastLoginAt: now,
				updatedAt: now,
			},
		});
}
