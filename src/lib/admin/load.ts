import type { CtxData } from "../../action-utils/api-types";
import {
	resolveActiveRestaurant,
	upsertUserFromIdentity,
} from "../auth/access";
import {
	canEnterAdmin,
	type UserIdentity,
} from "../auth/identity";
import { listCatalog } from "../catalog/admin";
import { countByStatus, listOrders } from "../orders/service";
import { listApiKeys } from "../api-keys/service";
import { connectionPublicView, getPosConnection } from "../pos/registry";
import {
	getRestaurantMapCenter,
	listLatestCourierPositions,
	listRecentCourierAlerts,
} from "../tracking/service";

export type AdminBootstrap = {
	identity: UserIdentity;
	isAdmin: boolean;
	restaurants: Array<{
		id: string;
		slug: string;
		name: string;
		address: string | null;
		phone: string | null;
		lat: number | null;
		lng: number | null;
		isActive: boolean;
	}>;
	active: {
		id: string;
		slug: string;
		name: string;
		address: string | null;
		phone: string | null;
		lat: number | null;
		lng: number | null;
		isActive: boolean;
	} | null;
};

export async function loadAdminBootstrap(
	ctx: EventContext<Env, never, CtxData>,
): Promise<AdminBootstrap> {
	const identity = ctx.data.identity;
	if (!identity) {
		return {
			identity: {
				id: null,
				email: null,
				name: null,
				role: null,
				parsed: null,
			},
			isAdmin: false,
			restaurants: [],
			active: null,
		};
	}
	await upsertUserFromIdentity(ctx, identity);
	const { restaurants: rows, active } = await resolveActiveRestaurant(
		ctx,
		identity.parsed,
	);
	return {
		identity,
		isAdmin: canEnterAdmin(identity),
		restaurants: rows.map((row) => ({
			id: row.id,
			slug: row.slug,
			name: row.name,
			address: row.address,
			phone: row.phone,
			lat: row.lat,
			lng: row.lng,
			isActive: row.isActive,
		})),
		active: active
			? {
					id: active.id,
					slug: active.slug,
					name: active.name,
					address: active.address,
					phone: active.phone,
					lat: active.lat,
					lng: active.lng,
					isActive: active.isActive,
				}
			: null,
	};
}

export async function loadDashboard(
	ctx: EventContext<Env, never, CtxData>,
) {
	const bootstrap = await loadAdminBootstrap(ctx);
	if (!bootstrap.active) {
		return { bootstrap, counts: null, recent: [], connection: null };
	}
	const recent = await listOrders(ctx, bootstrap.active.id);
	const connection = await getPosConnection(ctx, bootstrap.active.id);
	return {
		bootstrap,
		counts: countByStatus(recent),
		recent: recent.slice(0, 8),
		connection: connectionPublicView(connection),
	};
}

export async function loadCatalogPage(
	ctx: EventContext<Env, never, CtxData>,
) {
	const bootstrap = await loadAdminBootstrap(ctx);
	if (!bootstrap.active) {
		return { bootstrap, catalog: null };
	}
	return {
		bootstrap,
		catalog: await listCatalog(ctx, bootstrap.active.id),
	};
}

export async function loadOrdersPage(
	ctx: EventContext<Env, never, CtxData>,
) {
	const bootstrap = await loadAdminBootstrap(ctx);
	if (!bootstrap.active) {
		return { bootstrap, orders: [] };
	}
	return {
		bootstrap,
		orders: await listOrders(ctx, bootstrap.active.id),
	};
}

export async function loadApiPage(ctx: EventContext<Env, never, CtxData>) {
	const bootstrap = await loadAdminBootstrap(ctx);
	if (!bootstrap.active) {
		return { bootstrap, keys: [] };
	}
	return {
		bootstrap,
		keys: await listApiKeys(ctx, bootstrap.active.id),
	};
}

export async function loadSuiviPage(ctx: EventContext<Env, never, CtxData>) {
	const bootstrap = await loadAdminBootstrap(ctx);
	if (!bootstrap.active) {
		return {
			bootstrap,
			couriers: [],
			alerts: [],
			center: { lat: 45.5756, lng: -70.882, name: "Lac-Mégantic" },
		};
	}
	const [couriers, center, alerts] = await Promise.all([
		listLatestCourierPositions(ctx, bootstrap.active.id),
		getRestaurantMapCenter(ctx, bootstrap.active.id),
		listRecentCourierAlerts(ctx, bootstrap.active.id),
	]);
	return { bootstrap, couriers, center, alerts };
}

export async function loadLivreurPage(ctx: EventContext<Env, never, CtxData>) {
	const bootstrap = await loadAdminBootstrap(ctx);
	const center = bootstrap.active
		? await getRestaurantMapCenter(ctx, bootstrap.active.id)
		: { lat: 45.5756, lng: -70.882, name: "Restaurant" };
	const courses = bootstrap.active
		? (await listOrders(ctx, bootstrap.active.id)).filter(
				(order) =>
					order.type === "livraison" &&
					order.status !== "termine" &&
					order.status !== "livre",
			)
		: [];
	return { bootstrap, center, courses };
}

export async function loadPosPage(ctx: EventContext<Env, never, CtxData>) {
	const bootstrap = await loadAdminBootstrap(ctx);
	if (!bootstrap.active) {
		return { bootstrap, connection: null };
	}
	const connection = await getPosConnection(ctx, bootstrap.active.id);
	return {
		bootstrap,
		connection: connectionPublicView(connection),
	};
}
