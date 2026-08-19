export type GeoPoint = { lat: number; lng: number };

export async function geocodeAddress(
	address: string,
): Promise<GeoPoint | null> {
	const query = address.trim();
	if (!query) {
		return null;
	}
	const url = new URL("https://nominatim.openstreetmap.org/search");
	url.searchParams.set("q", query);
	url.searchParams.set("format", "json");
	url.searchParams.set("limit", "1");
	url.searchParams.set("countrycodes", "ca");
	const response = await fetch(url, {
		headers: {
			accept: "application/json",
			"user-agent": "resto-pi/1.0 (restaurant-map)",
		},
	});
	if (!response.ok) {
		return null;
	}
	const payload = (await response.json()) as Array<{
		lat?: string;
		lon?: string;
	}>;
	const hit = payload[0];
	const lat = Number(hit?.lat);
	const lng = Number(hit?.lon);
	if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
		return null;
	}
	return { lat, lng };
}

export function withQuebecHint(address: string): string {
	const raw = address.trim();
	if (/qu[eé]bec|canada|g6b/i.test(raw)) {
		return raw;
	}
	return `${raw}, Québec, Canada`;
}
