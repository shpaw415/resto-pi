import type { CreateOrderInput } from "../orders/service";
import type { ExternalOrder } from "./types";
import { buildUeatSendOrderBody } from "./ueat-order";

export type PosIpApiConfig = {
	baseUrl: string;
	storeId: string;
	apiKey: string;
	username: string;
	password: string;
	pullPath: string;
	pushPath: string;
	statusPath: string;
};

export const DEFAULT_POSIP_PATHS = {
	pullPath: "/api/ueat/fetchmenu",
	pushPath: "/api/ueat/sendorder",
	statusPath: "/api/ueat/ordervalidation",
	healthPath: "/api/ueat/healthcheck",
} as const;

export function parsePosIpConfig(raw: string | null | undefined): PosIpApiConfig {
	let parsed: Record<string, unknown> = {};
	try {
		parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
	} catch {
		parsed = {};
	}
	const text = (key: string, fallback = "") => {
		const value = parsed[key];
		return typeof value === "string" ? value.trim() : fallback;
	};
	return {
		baseUrl: text("baseUrl"),
		storeId: text("locationId") || text("storeId"),
		apiKey: text("apiKey"),
		username: text("username"),
		password: text("password"),
		pullPath: text("pullPath", DEFAULT_POSIP_PATHS.pullPath),
		pushPath: text("pushPath", DEFAULT_POSIP_PATHS.pushPath),
		statusPath: text("statusPath", DEFAULT_POSIP_PATHS.statusPath),
	};
}

export function publicPosIpConfig(config: PosIpApiConfig) {
	return {
		baseUrl: config.baseUrl,
		storeId: config.storeId,
		username: config.username,
		pullPath: config.pullPath,
		pushPath: config.pushPath,
		statusPath: config.statusPath,
		hasApiKey: config.apiKey.length > 0,
		hasPassword: config.password.length > 0,
	};
}

export function mergePosIpConfig(
	current: PosIpApiConfig,
	patch: Partial<PosIpApiConfig>,
): PosIpApiConfig {
	return {
		baseUrl: patch.baseUrl?.trim() ?? current.baseUrl,
		storeId: patch.storeId?.trim() ?? current.storeId,
		apiKey:
			patch.apiKey && patch.apiKey.length > 0 ? patch.apiKey.trim() : current.apiKey,
		username: patch.username?.trim() ?? current.username,
		password:
			patch.password && patch.password.length > 0
				? patch.password
				: current.password,
		pullPath: patch.pullPath?.trim() || current.pullPath,
		pushPath: patch.pushPath?.trim() || current.pushPath,
		statusPath: patch.statusPath?.trim() || current.statusPath,
	};
}

function joinUrl(baseUrl: string, path: string, id?: string) {
	const trimmed = baseUrl.replace(/\/+$/, "");
	const resolved = path.replace("{id}", id ?? "");
	if (/^https?:\/\//i.test(resolved)) {
		return resolved;
	}
	return `${trimmed}${resolved.startsWith("/") ? resolved : `/${resolved}`}`;
}

function authHeaders(config: PosIpApiConfig): Headers {
	const headers = new Headers({
		accept: "application/json",
		"content-type": "application/json",
	});
	if (config.apiKey) {
		headers.set("authorization", `Bearer ${config.apiKey}`);
		headers.set("x-api-key", config.apiKey);
	}
	if (config.username || config.password) {
		headers.set(
			"authorization",
			`Basic ${btoa(`${config.username}:${config.password}`)}`,
		);
	}
	if (config.storeId) {
		headers.set("x-store-id", config.storeId);
	}
	return headers;
}

async function posipRequest(
	config: PosIpApiConfig,
	method: string,
	path: string,
	body?: unknown,
	id?: string,
): Promise<unknown> {
	if (!config.baseUrl) {
		throw new Error("URL POSIPAPI manquante.");
	}
	const url = new URL(joinUrl(config.baseUrl, path, id));
	if (
		config.storeId &&
		(path.includes("healthcheck") || path.includes("fetchmenu"))
	) {
		url.searchParams.set("locationId", config.storeId);
	}
	const response = await fetch(url, {
		method,
		headers: authHeaders(config),
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const text = await response.text();
	let data: unknown = null;
	if (text) {
		try {
			data = JSON.parse(text);
		} catch {
			data = text;
		}
	}
	if (typeof data === "string" && data.includes("Fatal error")) {
		throw new Error(`POSIPAPI PHP: ${data.replace(/<[^>]+>/g, " ").slice(0, 240)}`);
	}
	if (!response.ok) {
		const message =
			typeof data === "object" && data && "error" in data
				? String((data as { error: unknown }).error)
				: text.slice(0, 240) || response.statusText;
		throw new Error(`POSIPAPI ${response.status}: ${message}`);
	}
	return data;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}
	return value as Record<string, unknown>;
}

function pickString(record: Record<string, unknown>, ...keys: string[]) {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "string" && value.trim()) {
			return value.trim();
		}
		if (typeof value === "number") {
			return String(value);
		}
	}
	return "";
}

function pickNumber(record: Record<string, unknown>, ...keys: string[]) {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "number" && Number.isFinite(value)) {
			return value;
		}
		if (typeof value === "string" && value.trim()) {
			const parsed = Number(value.replace(",", "."));
			if (Number.isFinite(parsed)) {
				return parsed;
			}
		}
	}
	return 0;
}

function priceToCents(value: number): number {
	if (!Number.isFinite(value) || value <= 0) {
		return 0;
	}
	return value > 500 ? Math.round(value) : Math.round(value * 100);
}

export function mapPosIpOrders(
	payload: unknown,
	restaurantId: string,
): ExternalOrder[] {
	const root = asRecord(payload);
	const list = Array.isArray(payload)
		? payload
		: Array.isArray(root?.orders)
			? root.orders
			: Array.isArray(root?.data)
				? root.data
				: Array.isArray(root?.Items)
					? root.Items
					: [];
	const orders: ExternalOrder[] = [];
	for (const entry of list) {
		const row = asRecord(entry);
		if (!row) continue;
		const customer = asRecord(row.customer) ?? asRecord(row.Customer) ?? {};
		const externalPosId = pickString(
			row,
			"id",
			"externalPosId",
			"orderId",
			"OrderId",
			"invoiceId",
			"InvoiceId",
			"numero",
		);
		if (!externalPosId) continue;
		const typeRaw = pickString(row, "type", "Type", "fulfillment", "channel");
		const type =
			/livr|deliv/i.test(typeRaw) || pickString(row, "address", "Address")
				? "livraison"
				: "emporter";
		const rawItems = Array.isArray(row.items)
			? row.items
			: Array.isArray(row.Items)
				? row.Items
				: Array.isArray(row.lines)
					? row.lines
					: [];
		const items = rawItems.flatMap((item) => {
			const line = asRecord(item);
			if (!line) return [];
			const name = pickString(line, "name", "Name", "description", "sku") || "Article";
			const quantity = Math.max(
				1,
				Math.round(pickNumber(line, "quantity", "qty", "Qty", "Quantity") || 1),
			);
			const unitPriceCents = priceToCents(
				pickNumber(line, "unitPriceCents", "priceCents", "price", "Price", "Amount"),
			);
			return [{ name, quantity, unitPriceCents }];
		});
		if (!items.length) {
			items.push({ name: "Commande POS", quantity: 1, unitPriceCents: 0 });
		}
		orders.push({
			restaurantId,
			type,
			source: "pos",
			externalPosId,
			customerName:
				pickString(row, "customerName", "CustomerName", "name") ||
				pickString(customer, "name", "Name", "fullName"),
			customerPhone:
				pickString(row, "customerPhone", "phone", "Phone") ||
				pickString(customer, "phone", "Phone", "tel"),
			customerAddress:
				pickString(row, "customerAddress", "address", "Address") ||
				pickString(customer, "address", "Address"),
			notes: pickString(row, "notes", "Notes", "comment", "Comment"),
			items,
		});
	}
	return orders;
}

export type PosMenuItem = {
	id: string;
	name: string;
	availability: string;
	group: string;
	itemType: string;
	prices: Array<{ price: number; service: string }>;
};

export function parseFetchMenu(payload: unknown): PosMenuItem[] {
	const root = asRecord(payload);
	const list = Array.isArray(payload)
		? payload
		: Array.isArray(root?.items)
			? root.items
			: [];
	const items: PosMenuItem[] = [];
	for (const entry of list) {
		const row = asRecord(entry);
		if (!row) continue;
		const id = pickString(row, "id");
		if (!id) continue;
		const pricesRaw = Array.isArray(row.prices) ? row.prices : [];
		items.push({
			id,
			name: pickString(row, "name") || id,
			availability: pickString(row, "availability") || "Available",
			group: pickString(row, "group").trim() || "Divers",
			itemType: pickString(row, "itemType") || "Item",
			prices: pricesRaw.flatMap((price) => {
				const rec = asRecord(price);
				if (!rec) return [];
				return [
					{
						price: pickNumber(rec, "price"),
						service: pickString(rec, "service") || "Takeout",
					},
				];
			}),
		});
	}
	return items;
}

export async function posipFetchMenu(
	config: PosIpApiConfig,
): Promise<PosMenuItem[]> {
	const payload = await posipRequest(
		config,
		"GET",
		DEFAULT_POSIP_PATHS.pullPath,
	);
	return parseFetchMenu(payload);
}

export async function posipPullOrders(
	config: PosIpApiConfig,
	restaurantId: string,
): Promise<ExternalOrder[]> {
	const payload = await posipRequest(config, "GET", config.pullPath, undefined);
	return mapPosIpOrders(payload, restaurantId);
}

export async function posipValidateOrder(
	config: PosIpApiConfig,
	order: CreateOrderInput,
	orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
	if (!config.storeId) {
		return { ok: false, error: "locationId manquant." };
	}
	const body = buildUeatSendOrderBody(config.storeId, order, { orderId });
	const payload = await posipRequest(
		config,
		"POST",
		"/api/ueat/ordervalidation",
		body,
	);
	const record = asRecord(payload) ?? {};
	if (record.isSuccessful === true) {
		return { ok: true };
	}
	return {
		ok: false,
		error: pickString(record, "errorMessage", "error") || "Validation refusée.",
	};
}

export async function posipPushOrder(
	config: PosIpApiConfig,
	order: CreateOrderInput,
	orderId = `rp-${Date.now()}`,
): Promise<{ externalId: string }> {
	if (!config.storeId) {
		throw new Error("locationId manquant.");
	}
	const body = buildUeatSendOrderBody(config.storeId, order, { orderId });
	const payload = await posipRequest(config, "POST", config.pushPath, body);
	const record = asRecord(payload) ?? {};
	if (record.isSuccessful === false) {
		throw new Error(
			pickString(record, "errorMessage", "error") || "sendorder refusé.",
		);
	}
	const externalId =
		pickString(record, "id", "externalId", "orderId", "OrderId") || orderId;
	return { externalId };
}

export async function posipSyncStatus(
	config: PosIpApiConfig,
	externalId: string,
	status: string,
): Promise<void> {
	await posipRequest(
		config,
		"POST",
		config.statusPath,
		{ storeId: config.storeId || undefined, status },
		externalId,
	);
}

export async function posipPing(config: PosIpApiConfig): Promise<string> {
	const payload = await posipRequest(
		config,
		"GET",
		DEFAULT_POSIP_PATHS.healthPath,
	);
	const record = asRecord(payload) ?? {};
	const status = pickString(record, "status");
	if (status && status !== "Ok") {
		throw new Error(`healthcheck: ${status}`);
	}
	return `Connexion POSIPAPI OK (${status || "ok"}).`;
}
