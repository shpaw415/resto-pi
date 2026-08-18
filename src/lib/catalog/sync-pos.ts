import { and, eq } from "drizzle-orm";
import type { CtxData } from "../../action-utils/api-types";
import { getDb, newId } from "../../db/client";
import { categories, productVariants, products } from "../../db/schema";
import type { PosMenuItem } from "../pos/posipapi";

function dollarsToCents(price: number): number {
	if (!Number.isFinite(price) || price < 0) {
		return 0;
	}
	return Math.round(price * 100);
}

export async function syncCatalogFromPos(
	ctx: EventContext<Env, never, CtxData>,
	restaurantId: string,
	items: PosMenuItem[],
) {
	const db = getDb(ctx);
	const now = new Date().toISOString();
	const groups = [...new Set(items.map((item) => item.group))];
	const existingCategories = await db
		.select()
		.from(categories)
		.where(eq(categories.restaurantId, restaurantId))
		.all();
	const categoryByName = new Map(
		existingCategories.map((row) => [row.name, row]),
	);
	const seenCategoryIds = new Set<string>();

	for (const [index, name] of groups.entries()) {
		const current = categoryByName.get(name);
		if (current) {
			seenCategoryIds.add(current.id);
			await db
				.update(categories)
				.set({ isActive: true, sortOrder: index, updatedAt: now })
				.where(eq(categories.id, current.id));
			continue;
		}
		const id = newId("cat");
		await db.insert(categories).values({
			id,
			restaurantId,
			name,
			sortOrder: index,
			isActive: true,
			updatedAt: now,
		});
		categoryByName.set(name, {
			id,
			restaurantId,
			name,
			sortOrder: index,
			isActive: true,
			createdAt: now,
			updatedAt: now,
		});
		seenCategoryIds.add(id);
	}

	const existingProducts = await db
		.select()
		.from(products)
		.where(eq(products.restaurantId, restaurantId))
		.all();
	const variants = await db.select().from(productVariants).all();
	const productBySku = new Map<string, (typeof existingProducts)[number]>();
	for (const product of existingProducts) {
		for (const variant of variants) {
			if (variant.productId === product.id && variant.sku) {
				productBySku.set(variant.sku, product);
			}
		}
	}

	const seenProductIds = new Set<string>();
	for (const item of items) {
		if (!item.name || item.name === "NULL") {
			continue;
		}
		const category = categoryByName.get(item.group);
		const active = item.availability === "Available";
		const description = item.itemType === "Option" ? "Option POS" : null;
		let product = productBySku.get(item.id);
		if (product) {
			await db
				.update(products)
				.set({
					name: item.name,
					categoryId: category?.id ?? null,
					description,
					isActive: active,
					updatedAt: now,
				})
				.where(eq(products.id, product.id));
		} else {
			const id = newId("prd");
			await db.insert(products).values({
				id,
				restaurantId,
				categoryId: category?.id ?? null,
				name: item.name,
				description,
				isActive: active,
				updatedAt: now,
			});
			product = {
				id,
				restaurantId,
				categoryId: category?.id ?? null,
				name: item.name,
				description,
				imageUrl: null,
				sortOrder: 0,
				isActive: active,
				createdAt: now,
				updatedAt: now,
			};
			productBySku.set(item.id, product);
		}
		seenProductIds.add(product.id);

		const existingVars = variants.filter((row) => row.productId === product.id);
		const wanted = item.prices.length
			? item.prices
			: [{ price: 0, service: "Takeout" }];
		const keep = new Set<string>();
		for (const price of wanted) {
			const variantName = price.service === "Delivery" ? "Livraison" : "Emporter";
			const match =
				existingVars.find((row) => row.name === variantName) ??
				existingVars.find((row) => row.sku === item.id);
			const priceCents = dollarsToCents(price.price);
			if (match) {
				keep.add(match.id);
				await db
					.update(productVariants)
					.set({
						name: variantName,
						priceCents,
						sku: item.id,
						isActive: active,
						updatedAt: now,
					})
					.where(eq(productVariants.id, match.id));
			} else {
				const id = newId("var");
				keep.add(id);
				await db.insert(productVariants).values({
					id,
					productId: product.id,
					name: variantName,
					priceCents,
					sku: item.id,
					isActive: active,
					updatedAt: now,
				});
			}
		}
		for (const row of existingVars) {
			if (!keep.has(row.id)) {
				await db
					.update(productVariants)
					.set({ isActive: false, updatedAt: now })
					.where(eq(productVariants.id, row.id));
			}
		}
	}

	for (const product of existingProducts) {
		if (!seenProductIds.has(product.id)) {
			await db
				.update(products)
				.set({ isActive: false, updatedAt: now })
				.where(
					and(
						eq(products.id, product.id),
						eq(products.restaurantId, restaurantId),
					),
				);
		}
	}
	for (const category of existingCategories) {
		if (!seenCategoryIds.has(category.id)) {
			await db
				.update(categories)
				.set({ isActive: false, updatedAt: now })
				.where(eq(categories.id, category.id));
		}
	}

	return {
		ok: true as const,
		items: items.length,
		categories: groups.length,
		products: seenProductIds.size,
	};
}
