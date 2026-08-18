import { posipValidateOrder } from "../src/lib/pos/posipapi";

const apiKey = process.env.COLOSSAL_API_KEY?.trim();
const baseUrl = (
	process.env.COLOSSAL_BASE_URL ??
	"https://pouletfritideal03.colossalepos.com"
).replace(/\/+$/, "");
const locationId = process.env.COLOSSAL_LOCATION_ID?.trim();

if (!apiKey || !locationId) {
	console.error("COLOSSAL_API_KEY et COLOSSAL_LOCATION_ID requis.");
	process.exit(1);
}

const result = await posipValidateOrder(
	{
		baseUrl,
		storeId: locationId,
		apiKey,
		username: "",
		password: "",
		pullPath: "/api/ueat/fetchmenu",
		pushPath: "/api/ueat/sendorder",
		statusPath: "/api/ueat/ordervalidation",
	},
	{
		restaurantId: "script",
		type: "emporter",
		customerName: "Test RestoPi",
		items: [
			{
				name: "POUTINE PETITE",
				quantity: 1,
				unitPriceCents: 1000,
				variantId: "100",
			},
		],
	},
	`resto-pi-validate-${Date.now()}`,
);

console.log(JSON.stringify(result, null, 2));
if (!result.ok) {
	process.exit(1);
}
