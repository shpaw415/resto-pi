import { and, asc, eq } from "drizzle-orm";
import type { CtxData } from "../../action-utils/api-types";
import { getDb, newId } from "../../db/client";
import {
	categories,
	productExtraValues,
	productExtras,
	productVariants,
	products,
} from "../../db/schema";

export async function listCatalog(
	ctx: EventContext<Env, never, CtxData>,
	restaurantId: string,
) {
	const db = getDb(ctx);
	const [categoryRows, productRows, variantRows, extraRows, extraValueRows] =
		await Promise.all([
			db
				.select()
				.from(categories)
				.where(eq(categories.restaurantId, restaurantId))
				.orderBy(asc(categories.sortOrder), asc(categories.name))
				.all(),
			db
				.select()
				.from(products)
				.where(eq(products.restaurantId, restaurantId))
				.orderBy(asc(products.sortOrder), asc(products.name))
				.all(),
			db.select().from(productVariants).all(),
			db.select().from(productExtras).all(),
			db.select().from(productExtraValues).all(),
		]);

	const productIds = new Set(productRows.map((row) => row.id));
	const extrasByProduct = extraRows.filter((row) => productIds.has(row.productId));
	const extraIds = new Set(extrasByProduct.map((row) => row.id));

	return {
		categories: categoryRows,
		products: productRows.map((product) => ({
			...product,
			variants: variantRows.filter((row) => row.productId === product.id),
			extras: extrasByProduct
				.filter((row) => row.productId === product.id)
				.map((extra) => ({
					...extra,
					values: extraValueRows.filter((row) => row.extraId === extra.id),
				})),
		})),
		extraValues: extraValueRows.filter((row) => extraIds.has(row.extraId)),
	};
}

export async function saveCategory(
	ctx: EventContext<Env, never, CtxData>,
	input: {
		id?: string;
		restaurantId: string;
		name: string;
		sortOrder?: number;
		isActive?: boolean;
	},
) {
	const name = input.name.trim();
	if (!name) {
		return { ok: false as const, error: "Nom requis." };
	}
	const db = getDb(ctx);
	const now = new Date().toISOString();
	if (input.id) {
		await db
			.update(categories)
			.set({
				name,
				sortOrder: input.sortOrder ?? 0,
				isActive: input.isActive ?? true,
				updatedAt: now,
			})
			.where(
				and(
					eq(categories.id, input.id),
					eq(categories.restaurantId, input.restaurantId),
				),
			);
		return { ok: true as const, id: input.id };
	}
	const id = newId("cat");
	await db.insert(categories).values({
		id,
		restaurantId: input.restaurantId,
		name,
		sortOrder: input.sortOrder ?? 0,
		isActive: input.isActive ?? true,
		updatedAt: now,
	});
	return { ok: true as const, id };
}

export async function saveProduct(
	ctx: EventContext<Env, never, CtxData>,
	input: {
		id?: string;
		restaurantId: string;
		categoryId?: string | null;
		name: string;
		description?: string;
		imageUrl?: string;
		isActive?: boolean;
		variants: Array<{
			id?: string;
			name: string;
			priceCents: number;
			sku?: string;
			isActive?: boolean;
		}>;
	},
) {
	const name = input.name.trim();
	if (!name) {
		return { ok: false as const, error: "Nom requis." };
	}
	if (!input.variants.length) {
		return { ok: false as const, error: "Au moins une variante / prix." };
	}
	const db = getDb(ctx);
	const now = new Date().toISOString();
	const productId = input.id ?? newId("prd");
	if (input.id) {
		await db
			.update(products)
			.set({
				categoryId: input.categoryId || null,
				name,
				description: input.description?.trim() || null,
				imageUrl: input.imageUrl?.trim() || null,
				isActive: input.isActive ?? true,
				updatedAt: now,
			})
			.where(
				and(
					eq(products.id, productId),
					eq(products.restaurantId, input.restaurantId),
				),
			);
	} else {
		await db.insert(products).values({
			id: productId,
			restaurantId: input.restaurantId,
			categoryId: input.categoryId || null,
			name,
			description: input.description?.trim() || null,
			imageUrl: input.imageUrl?.trim() || null,
			isActive: input.isActive ?? true,
			updatedAt: now,
		});
	}

	const existing = await db
		.select()
		.from(productVariants)
		.where(eq(productVariants.productId, productId))
		.all();
	const keep = new Set<string>();
	for (const variant of input.variants) {
		const variantId = variant.id ?? newId("var");
		keep.add(variantId);
		if (variant.id) {
			await db
				.update(productVariants)
				.set({
					name: variant.name.trim() || "Standard",
					priceCents: variant.priceCents,
					sku: variant.sku?.trim() || null,
					isActive: variant.isActive ?? true,
					updatedAt: now,
				})
				.where(eq(productVariants.id, variant.id));
		} else {
			await db.insert(productVariants).values({
				id: variantId,
				productId,
				name: variant.name.trim() || "Standard",
				priceCents: variant.priceCents,
				sku: variant.sku?.trim() || null,
				isActive: variant.isActive ?? true,
				updatedAt: now,
			});
		}
	}
	for (const row of existing) {
		if (!keep.has(row.id)) {
			await db
				.update(productVariants)
				.set({ isActive: false, updatedAt: now })
				.where(eq(productVariants.id, row.id));
		}
	}
	return { ok: true as const, id: productId };
}

export async function archiveProduct(
	ctx: EventContext<Env, never, CtxData>,
	id: string,
	restaurantId: string,
) {
	const db = getDb(ctx);
	await db
		.update(products)
		.set({ isActive: false, updatedAt: new Date().toISOString() })
		.where(and(eq(products.id, id), eq(products.restaurantId, restaurantId)));
	return { ok: true as const };
}
