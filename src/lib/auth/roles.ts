import type { RolePermission } from "../../db/schema";
import { rolePermissions } from "../../db/schema";

export type ParsedRole = {
	raw: string;
	tenant: string;
	permission: RolePermission;
	isPlatformOwner: boolean;
};

const PERMISSIONS = new Set<string>(rolePermissions);

export function parseIssuerRole(
	role: string | null | undefined,
): ParsedRole | null {
	if (!role) {
		return null;
	}
	const trimmed = role.trim();
	const sep = trimmed.lastIndexOf(":");
	if (sep <= 0 || sep === trimmed.length - 1) {
		return null;
	}
	const tenant = trimmed.slice(0, sep).trim();
	const permission = trimmed.slice(sep + 1).trim();
	if (!tenant || !PERMISSIONS.has(permission)) {
		return null;
	}
	return {
		raw: trimmed,
		tenant,
		permission: permission as RolePermission,
		isPlatformOwner: tenant === "admin" && permission === "admin",
	};
}

export function canAccessAdmin(parsed: ParsedRole | null): boolean {
	if (!parsed) {
		return false;
	}
	return parsed.permission === "admin" || parsed.permission === "user";
}

export function canManageCatalog(parsed: ParsedRole | null): boolean {
	if (!parsed) {
		return false;
	}
	return parsed.isPlatformOwner || parsed.permission === "admin";
}

export function canManageRestaurants(parsed: ParsedRole | null): boolean {
	return Boolean(parsed?.isPlatformOwner);
}

export function canManageApiKeys(parsed: ParsedRole | null): boolean {
	return canManageCatalog(parsed);
}

export function canManagePos(parsed: ParsedRole | null): boolean {
	return canManageCatalog(parsed);
}

export function canChangeOrderStatus(parsed: ParsedRole | null): boolean {
	return canAccessAdmin(parsed);
}

export function canAccessRestaurant(
	parsed: ParsedRole | null,
	slug: string,
): boolean {
	if (!parsed) {
		return false;
	}
	if (parsed.isPlatformOwner) {
		return true;
	}
	return parsed.tenant === slug;
}

export function permissionLabel(permission: RolePermission): string {
	if (permission === "admin") {
		return "Administration";
	}
	if (permission === "user") {
		return "Cuisine / caisse";
	}
	return "Livraison";
}
