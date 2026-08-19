export function normalizePhone(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		return "";
	}
	const hasPlus = trimmed.startsWith("+");
	const digits = trimmed.replace(/\D/g, "");
	if (!digits) {
		return "";
	}
	return hasPlus ? `+${digits}` : digits;
}
