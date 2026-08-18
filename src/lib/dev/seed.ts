import type { CtxData } from "../../action-utils/api-types";
import { getDb, newId } from "../../db/client";
import {
	categories,
	productVariants,
	products,
	restaurants,
} from "../../db/schema";
import { createOrder } from "../orders/service";

export async function seedDemoData(
	ctx: EventContext<Env, never, CtxData>,
) {
	const db = getDb(ctx);
	const existing = await db.select().from(restaurants).all();
	if (existing.length > 0) {
		return { ok: true as const, seeded: false, message: "Données déjà présentes." };
	}

	const pizza = {
		id: newId("rst"),
		slug: "pizzeria-centrale",
		name: "Pizzeria Centrale",
		address: "120 rue Saint-Denis, Montréal",
		phone: "514-555-0188",
	};
	const sushi = {
		id: newId("rst"),
		slug: "sushi-quartier",
		name: "Sushi Quartier",
		address: "45 av. du Parc, Montréal",
		phone: "514-555-0199",
	};

	for (const resto of [pizza, sushi]) {
		await db.insert(restaurants).values({
			...resto,
			timezone: "America/Toronto",
			isActive: true,
		});
	}

	const pizzaCat = newId("cat");
	await db.insert(categories).values({
		id: pizzaCat,
		restaurantId: pizza.id,
		name: "Pizzas",
		sortOrder: 0,
	});
	const pizzaProduct = newId("prd");
	await db.insert(products).values({
		id: pizzaProduct,
		restaurantId: pizza.id,
		categoryId: pizzaCat,
		name: "Margherita",
		description: "Tomate, mozzarella, basilic",
		isActive: true,
	});
	const pizzaVar = newId("var");
	await db.insert(productVariants).values({
		id: pizzaVar,
		productId: pizzaProduct,
		name: "12 po",
		priceCents: 1895,
	});

	const sushiCat = newId("cat");
	await db.insert(categories).values({
		id: sushiCat,
		restaurantId: sushi.id,
		name: "Combinaisons",
		sortOrder: 0,
	});
	const sushiProduct = newId("prd");
	await db.insert(products).values({
		id: sushiProduct,
		restaurantId: sushi.id,
		categoryId: sushiCat,
		name: "Combo saumon",
		description: "12 mcx saumon",
		isActive: true,
	});
	const sushiVar = newId("var");
	await db.insert(productVariants).values({
		id: sushiVar,
		productId: sushiProduct,
		name: "Standard",
		priceCents: 2295,
	});

	await createOrder(ctx, {
		restaurantId: pizza.id,
		type: "livraison",
		source: "pos",
		customerName: "Marie Tremblay",
		customerPhone: "514-555-0111",
		customerAddress: "88 rue Ontario E",
		items: [
			{
				productId: pizzaProduct,
				variantId: pizzaVar,
				name: "Margherita — 12 po",
				quantity: 2,
				unitPriceCents: 1895,
			},
		],
	});
	await createOrder(ctx, {
		restaurantId: pizza.id,
		type: "emporter",
		source: "api",
		customerName: "Alex Roy",
		items: [
			{
				productId: pizzaProduct,
				variantId: pizzaVar,
				name: "Margherita — 12 po",
				quantity: 1,
				unitPriceCents: 1895,
			},
		],
	});

	return {
		ok: true as const,
		seeded: true,
		message: "Deux restaurants, catalogue et commandes de démo créés.",
		slugs: [pizza.slug, sushi.slug],
	};
}
