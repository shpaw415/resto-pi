export function formatCad(cents: number): string {
	return new Intl.NumberFormat("fr-CA", {
		style: "currency",
		currency: "CAD",
	}).format(cents / 100);
}

export function parsePriceToCents(value: string): number | null {
	const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
	if (!normalized) {
		return null;
	}
	const amount = Number(normalized);
	if (!Number.isFinite(amount) || amount < 0) {
		return null;
	}
	return Math.round(amount * 100);
}
