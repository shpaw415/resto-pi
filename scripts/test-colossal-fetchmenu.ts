const apiKey = process.env.COLOSSAL_API_KEY?.trim();
const baseUrl = (
	process.env.COLOSSAL_BASE_URL ??
	"https://pouletfritideal03.colossalepos.com"
).replace(/\/+$/, "");
const locationId = process.env.COLOSSAL_LOCATION_ID?.trim();

if (!apiKey) {
	console.error("COLOSSAL_API_KEY manquante.");
	process.exit(1);
}
if (!locationId) {
	console.error("COLOSSAL_LOCATION_ID manquante.");
	process.exit(1);
}

const url = new URL("/api/ueat/fetchmenu", baseUrl);
url.searchParams.set("locationId", locationId);

const response = await fetch(url, {
	method: "GET",
	headers: {
		accept: "application/json",
		authorization: `Bearer ${apiKey}`,
	},
});

const text = await response.text();
let body: unknown = text;
try {
	body = text ? JSON.parse(text) : null;
} catch {
	body = text;
}

console.log(`GET ${url.pathname}${url.search}`);
console.log(`status ${response.status} ${response.statusText}`);
console.log(
	typeof body === "string" ? body : JSON.stringify(body, null, 2),
);

if (!response.ok) {
	process.exit(1);
}
