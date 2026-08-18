import { and, asc, eq } from "drizzle-orm";
import type { CtxData } from "../../action-utils/api-types";
import { getDb } from "../../db/client";
import {
	categories,
	productExtraValues,
	productExtras,
	productVariants,
	products,
} from "../../db/schema";

export async function listPublicCatalog(
	ctx: EventContext<Env, never, CtxData>,
	restaurantId: string,
) {
	const db = getDb(ctx);
	const [categoryRows, productRows] = await Promise.all([
		db
			.select()
			.from(categories)
			.where(
				and(
					eq(categories.restaurantId, restaurantId),
					eq(categories.isActive, true),
				),
			)
			.orderBy(asc(categories.sortOrder), asc(categories.name))
			.all(),
		db
			.select()
			.from(products)
			.where(
				and(
					eq(products.restaurantId, restaurantId),
					eq(products.isActive, true),
				),
			)
			.orderBy(asc(products.sortOrder), asc(products.name))
			.all(),
	]);
	const variants = await db
		.select()
		.from(productVariants)
		.where(eq(productVariants.isActive, true))
		.all();
	const extras = await db.select().from(productExtras).all();
	const extraValues = await db
		.select()
		.from(productExtraValues)
		.where(eq(productExtraValues.isActive, true))
		.all();

	return {
		categories: categoryRows.map((category) => ({
			id: category.id,
			name: category.name,
		})),
		products: productRows.map((product) => ({
			id: product.id,
			categoryId: product.categoryId,
			name: product.name,
			description: product.description,
			imageUrl: product.imageUrl,
			variants: variants
				.filter((row) => row.productId === product.id)
				.map((variant) => ({
					id: variant.id,
					name: variant.name,
					priceCents: variant.priceCents,
				})),
			extras: extras
				.filter((row) => row.productId === product.id)
				.map((extra) => ({
					id: extra.id,
					name: extra.name,
					required: extra.required,
					maxSelect: extra.maxSelect,
					values: extraValues
						.filter((value) => value.extraId === extra.id)
						.map((value) => ({
							id: value.id,
							name: value.name,
							priceCentsDelta: value.priceCentsDelta,
						})),
				})),
		})),
	};
}
