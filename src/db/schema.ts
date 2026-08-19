import { sql } from "drizzle-orm";
import {
	integer,
	real,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const orderTypes = ["livraison", "emporter"] as const;
export const orderSources = ["api", "pos", "manual"] as const;
export const orderStatuses = [
	"en_attente",
	"peut_preparer",
	"en_preparation",
	"pret",
	"termine",
	"assigne",
	"en_livraison",
	"livre",
] as const;
export const kitchenStatuses = [
	"en_attente",
	"peut_preparer",
	"en_preparation",
	"pret",
	"termine",
] as const;
export const posAdapters = ["mock", "colossal"] as const;
export const apiKeyScopeValues = [
	"catalog:read",
	"orders:read",
	"orders:write",
	"tracking:read",
] as const;
export const rolePermissions = ["admin", "user", "courier"] as const;
export const courierAlertKinds = [
	"traffic",
	"nobody_home",
	"no_answer",
	"wrong_address",
	"arrived",
	"returning",
	"help",
] as const;

export type OrderType = (typeof orderTypes)[number];
export type OrderSource = (typeof orderSources)[number];
export type OrderStatus = (typeof orderStatuses)[number];
export type KitchenStatus = (typeof kitchenStatuses)[number];
export type PosAdapterId = (typeof posAdapters)[number];
export type ApiKeyScope = (typeof apiKeyScopeValues)[number];
export type RolePermission = (typeof rolePermissions)[number];
export type CourierAlertKind = (typeof courierAlertKinds)[number];

const timestampColumns = {
	createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const users = sqliteTable("users", {
	id: text("id").primaryKey(),
	email: text("email"),
	name: text("name"),
	issuerRole: text("issuer_role"),
	lastLoginAt: text("last_login_at"),
	...timestampColumns,
});

export const restaurants = sqliteTable(
	"restaurants",
	{
		id: text("id").primaryKey(),
		slug: text("slug").notNull(),
		name: text("name").notNull(),
		address: text("address"),
		phone: text("phone"),
		lat: real("lat"),
		lng: real("lng"),
		timezone: text("timezone").notNull().default("America/Toronto"),
		isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
		...timestampColumns,
	},
	(table) => ({
		slugIdx: uniqueIndex("restaurants_slug_idx").on(table.slug),
	}),
);

export const categories = sqliteTable("categories", {
	id: text("id").primaryKey(),
	restaurantId: text("restaurant_id")
		.notNull()
		.references(() => restaurants.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	sortOrder: integer("sort_order").notNull().default(0),
	isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	...timestampColumns,
});

export const products = sqliteTable("products", {
	id: text("id").primaryKey(),
	restaurantId: text("restaurant_id")
		.notNull()
		.references(() => restaurants.id, { onDelete: "cascade" }),
	categoryId: text("category_id").references(() => categories.id, {
		onDelete: "set null",
	}),
	name: text("name").notNull(),
	description: text("description"),
	imageUrl: text("image_url"),
	sortOrder: integer("sort_order").notNull().default(0),
	isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	...timestampColumns,
});

export const productVariants = sqliteTable("product_variants", {
	id: text("id").primaryKey(),
	productId: text("product_id")
		.notNull()
		.references(() => products.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	priceCents: integer("price_cents").notNull(),
	sku: text("sku"),
	isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	...timestampColumns,
});

export const productExtras = sqliteTable("product_extras", {
	id: text("id").primaryKey(),
	productId: text("product_id")
		.notNull()
		.references(() => products.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	required: integer("required", { mode: "boolean" }).notNull().default(false),
	maxSelect: integer("max_select").notNull().default(1),
	...timestampColumns,
});

export const productExtraValues = sqliteTable("product_extra_values", {
	id: text("id").primaryKey(),
	extraId: text("extra_id")
		.notNull()
		.references(() => productExtras.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	priceCentsDelta: integer("price_cents_delta").notNull().default(0),
	isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	...timestampColumns,
});

export const orders = sqliteTable("orders", {
	id: text("id").primaryKey(),
	restaurantId: text("restaurant_id")
		.notNull()
		.references(() => restaurants.id, { onDelete: "restrict" }),
	type: text("type", { enum: orderTypes }).notNull(),
	status: text("status", { enum: orderStatuses })
		.notNull()
		.default("en_attente"),
	source: text("source", { enum: orderSources }).notNull().default("api"),
	externalPosId: text("external_pos_id"),
	customerName: text("customer_name"),
	customerPhone: text("customer_phone"),
	customerAddress: text("customer_address"),
	notes: text("notes"),
	subtotalCents: integer("subtotal_cents").notNull().default(0),
	totalCents: integer("total_cents").notNull().default(0),
	createdByUserId: text("created_by_user_id").references(() => users.id, {
		onDelete: "set null",
	}),
	...timestampColumns,
});

export const orderItems = sqliteTable("order_items", {
	id: text("id").primaryKey(),
	orderId: text("order_id")
		.notNull()
		.references(() => orders.id, { onDelete: "cascade" }),
	productId: text("product_id").references(() => products.id, {
		onDelete: "set null",
	}),
	variantId: text("variant_id").references(() => productVariants.id, {
		onDelete: "set null",
	}),
	nameSnapshot: text("name_snapshot").notNull(),
	quantity: integer("quantity").notNull().default(1),
	unitPriceCents: integer("unit_price_cents").notNull(),
});

export const orderItemExtras = sqliteTable("order_item_extras", {
	id: text("id").primaryKey(),
	orderItemId: text("order_item_id")
		.notNull()
		.references(() => orderItems.id, { onDelete: "cascade" }),
	extraValueId: text("extra_value_id").references(() => productExtraValues.id, {
		onDelete: "set null",
	}),
	nameSnapshot: text("name_snapshot").notNull(),
	priceCentsDelta: integer("price_cents_delta").notNull().default(0),
});

export const orderStatusEvents = sqliteTable("order_status_events", {
	id: text("id").primaryKey(),
	orderId: text("order_id")
		.notNull()
		.references(() => orders.id, { onDelete: "cascade" }),
	fromStatus: text("from_status", { enum: orderStatuses }),
	toStatus: text("to_status", { enum: orderStatuses }).notNull(),
	actorUserId: text("actor_user_id").references(() => users.id, {
		onDelete: "set null",
	}),
	actorLabel: text("actor_label"),
	createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const apiKeys = sqliteTable("api_keys", {
	id: text("id").primaryKey(),
	restaurantId: text("restaurant_id")
		.notNull()
		.references(() => restaurants.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	prefix: text("prefix").notNull(),
	keyHash: text("key_hash").notNull(),
	scopes: text("scopes").notNull().default("[]"),
	revokedAt: text("revoked_at"),
	lastUsedAt: text("last_used_at"),
	createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const posConnections = sqliteTable("pos_connections", {
	id: text("id").primaryKey(),
	restaurantId: text("restaurant_id")
		.notNull()
		.references(() => restaurants.id, { onDelete: "cascade" }),
	adapter: text("adapter", { enum: posAdapters }).notNull().default("mock"),
	configJson: text("config_json").notNull().default("{}"),
	isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	...timestampColumns,
});

export const deliveries = sqliteTable("deliveries", {
	id: text("id").primaryKey(),
	orderId: text("order_id")
		.notNull()
		.references(() => orders.id, { onDelete: "cascade" }),
	restaurantId: text("restaurant_id")
		.notNull()
		.references(() => restaurants.id, { onDelete: "cascade" }),
	courierUserId: text("courier_user_id").references(() => users.id, {
		onDelete: "set null",
	}),
	status: text("status").notNull().default("pending"),
	...timestampColumns,
});

export const courierAlerts = sqliteTable("courier_alerts", {
	id: text("id").primaryKey(),
	restaurantId: text("restaurant_id")
		.notNull()
		.references(() => restaurants.id, { onDelete: "cascade" }),
	courierUserId: text("courier_user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	kind: text("kind", { enum: courierAlertKinds }).notNull(),
	createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
	archivedAt: text("archived_at"),
});

export const staffCourierMessages = sqliteTable("staff_courier_messages", {
	id: text("id").primaryKey(),
	restaurantId: text("restaurant_id")
		.notNull()
		.references(() => restaurants.id, { onDelete: "cascade" }),
	courierUserId: text("courier_user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	authorUserId: text("author_user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	authorKind: text("author_kind").notNull(),
	body: text("body").notNull(),
	createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const clientNotes = sqliteTable(
	"client_notes",
	{
		id: text("id").primaryKey(),
		restaurantId: text("restaurant_id")
			.notNull()
			.references(() => restaurants.id, { onDelete: "cascade" }),
		phone: text("phone").notNull(),
		note: text("note").notNull().default(""),
		updatedByUserId: text("updated_by_user_id").references(() => users.id, {
			onDelete: "set null",
		}),
		...timestampColumns,
	},
	(table) => ({
		phoneIdx: uniqueIndex("client_notes_resto_phone_idx").on(
			table.restaurantId,
			table.phone,
		),
	}),
);

export const courierPositions = sqliteTable("courier_positions", {
	id: text("id").primaryKey(),
	restaurantId: text("restaurant_id")
		.notNull()
		.references(() => restaurants.id, { onDelete: "cascade" }),
	courierUserId: text("courier_user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	lat: real("lat").notNull(),
	lng: real("lng").notNull(),
	recordedAt: text("recorded_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
