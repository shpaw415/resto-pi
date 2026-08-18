import type { ClientType } from "../../auth";

export const ACCESS_TOKEN_COOKIE = "access_token";

const LISTENER_KEY = "resto-pi-access-token-cookie";

export type AccessTokenCookieOptions = {
	secure: boolean;
	maxAgeSeconds?: number;
};

export function buildAccessTokenCookieValue(
	token: string,
	options: AccessTokenCookieOptions,
): string {
	const parts = [`${ACCESS_TOKEN_COOKIE}=${token}`, "path=/", "SameSite=Lax"];
	if (options.secure) {
		parts.push("Secure");
	}
	if (
		typeof options.maxAgeSeconds === "number" &&
		Number.isFinite(options.maxAgeSeconds) &&
		options.maxAgeSeconds >= 0
	) {
		parts.push(`Max-Age=${Math.floor(options.maxAgeSeconds)}`);
	}
	return parts.join("; ");
}

export function buildClearAccessTokenCookieValue(
	options: Pick<AccessTokenCookieOptions, "secure">,
): string {
	return buildAccessTokenCookieValue("", {
		secure: options.secure,
		maxAgeSeconds: 0,
	});
}

function isBrowser(): boolean {
	return typeof document !== "undefined" && typeof window !== "undefined";
}

function isSecureContext(): boolean {
	return isBrowser() && window.location.protocol === "https:";
}

export function maxAgeFromStoredExpiry(
	expiresAtMs: string | number | null | undefined,
	nowMs: number = Date.now(),
): number | undefined {
	if (expiresAtMs == null || expiresAtMs === "") {
		return undefined;
	}
	const exp =
		typeof expiresAtMs === "number" ? expiresAtMs : Number(expiresAtMs);
	if (!Number.isFinite(exp)) {
		return undefined;
	}
	const seconds = Math.floor((exp - nowMs) / 1000);
	return seconds > 0 ? seconds : 0;
}

export function syncAccessTokenCookie(token: string | null | undefined): void {
	if (!isBrowser()) {
		return;
	}
	if (!token) {
		clearAccessTokenCookie();
		return;
	}

	let maxAgeSeconds: number | undefined;
	try {
		maxAgeSeconds = maxAgeFromStoredExpiry(
			localStorage.getItem("oa_expires_at"),
		);
	} catch {
		maxAgeSeconds = undefined;
	}

	document.cookie = buildAccessTokenCookieValue(token, {
		secure: isSecureContext(),
		maxAgeSeconds,
	});
}

export function clearAccessTokenCookie(): void {
	if (!isBrowser()) {
		return;
	}
	document.cookie = buildClearAccessTokenCookieValue({
		secure: isSecureContext(),
	});
}

function readClientToken(client: ClientType): string | null {
	try {
		const token = (client as { getToken?: () => string | null }).getToken?.();
		return typeof token === "string" && token.length > 0 ? token : null;
	} catch {
		return null;
	}
}

export function bindAccessTokenCookieLifecycle(client: ClientType): () => void {
	const syncFromClient = () => {
		const token = readClientToken(client);
		if (token) {
			syncAccessTokenCookie(token);
		} else {
			clearAccessTokenCookie();
		}
	};

	syncFromClient();

	const maybeAddListener = (
		client as {
			addInitializationListener?: (
				key: string,
				cb: (c: ClientType) => void,
			) => void;
		}
	).addInitializationListener;
	const maybeRemoveListener = (
		client as {
			removeInitializationListener?: (key: string) => void;
		}
	).removeInitializationListener;

	if (typeof maybeAddListener === "function") {
		maybeAddListener.call(client, LISTENER_KEY, () => {
			syncFromClient();
		});
	}

	const clientAny = client as ClientType & {
		triggerRefresh?: () => Promise<boolean>;
		logout?: () => unknown;
		__restoCookieBound?: boolean;
	};

	if (!clientAny.__restoCookieBound) {
		clientAny.__restoCookieBound = true;

		if (typeof clientAny.triggerRefresh === "function") {
			const originalRefresh = clientAny.triggerRefresh.bind(client);
			clientAny.triggerRefresh = async () => {
				const ok = await originalRefresh();
				syncFromClient();
				return ok;
			};
		}

		if (typeof clientAny.logout === "function") {
			const originalLogout = clientAny.logout.bind(client);
			clientAny.logout = () => {
				const result = originalLogout();
				clearAccessTokenCookie();
				return result;
			};
		}
	}

	return () => {
		if (typeof maybeRemoveListener === "function") {
			maybeRemoveListener.call(client, LISTENER_KEY);
		}
	};
}

export function logoutClient(client: ClientType | null | undefined): void {
	clearAccessTokenCookie();
	try {
		client?.logout?.();
	} finally {
		clearAccessTokenCookie();
	}
}
