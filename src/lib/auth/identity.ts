import type { ClientType, PublicSession } from "../../auth";
import { parseIssuerRole, type ParsedRole } from "./roles";

export type UserIdentity = {
	id: string | null;
	email: string | null;
	name: string | null;
	role: string | null;
	parsed: ParsedRole | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== "object") {
		return null;
	}
	return value as Record<string, unknown>;
}

function pickString(...values: unknown[]): string | null {
	for (const value of values) {
		if (typeof value === "string" && value.trim().length > 0) {
			return value.trim();
		}
	}
	return null;
}

export async function resolveUserIdentity(
	auth: ClientType,
): Promise<UserIdentity> {
	const sessionResult = await auth.getUserSession("public").catch(() => null);
	const meta = await auth.getMetaData().catch(() => null);

	const sessionPayload =
		sessionResult && !(sessionResult instanceof Error)
			? asRecord(sessionResult)
			: null;

	const publicSession = asRecord(
		sessionPayload && "public" in sessionPayload
			? sessionPayload.public
			: sessionResult && !(sessionResult instanceof Error)
				? sessionResult
				: null,
	);

	const sessionUserInfo = asRecord(sessionPayload?.userInfo);
	const jwtUserInfo = asRecord(
		(auth as { userInfo?: unknown }).userInfo ?? meta?.data,
	);
	const metaData = asRecord(meta?.data);
	const userMeta = asRecord((auth as { userMeta?: unknown }).userMeta);

	const email = pickString(
		publicSession?.email,
		sessionUserInfo?.email,
		jwtUserInfo?.email,
		metaData?.email,
		meta?.identifier,
	);
	const name = pickString(
		publicSession?.name,
		sessionUserInfo?.name,
		jwtUserInfo?.name,
		metaData?.name,
	);

	const role = pickString(
		sessionUserInfo?.role,
		userMeta?.role,
		meta?.role,
		jwtUserInfo?.role,
		metaData?.role,
	);

	return {
		id:
			pickString(
				sessionPayload?.user_id,
				meta?.id,
				userMeta?.id,
				publicSession?.id,
			) ?? null,
		email,
		name,
		role,
		parsed: parseIssuerRole(role),
	};
}

export function identityToPublicSession(
	identity: UserIdentity,
	extra?: PublicSession,
): PublicSession {
	return {
		...extra,
		email: identity.email ?? extra?.email,
		name: identity.name ?? extra?.name,
		role: identity.role ?? extra?.role,
	};
}

export function postAuthHomePath(identity: UserIdentity): string {
	if (canEnterCourier(identity) && !canEnterAdmin(identity)) {
		return "/livreur";
	}
	if (canEnterAdmin(identity)) {
		return "/admin";
	}
	if (canEnterCourier(identity)) {
		return "/livreur";
	}
	return "/login";
}

export function canEnterAdmin(identity: UserIdentity): boolean {
	const parsed = identity.parsed;
	if (!parsed) {
		return false;
	}
	return parsed.permission === "admin" || parsed.permission === "user";
}

export function canEnterCourier(identity: UserIdentity): boolean {
	const parsed = identity.parsed;
	if (!parsed) {
		return false;
	}
	return parsed.permission === "courier" || parsed.isPlatformOwner;
}
