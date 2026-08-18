import {
	RouterHost,
	type router,
} from "frame-master-plugin-apply-react/router";
import { SSRPropsProvider } from "frame-master-plugin-cloudflare-pages-dynamic-ssr/client/context";
import type { PropsData } from "frame-master-plugin-cloudflare-pages-dynamic-ssr/provider/utils";
import {
	type JSX,
	StrictMode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { createClient, type PublicSession } from "./auth";
import { AuthCtx, AuthSessionCtx } from "./hooks/useAuth";
import { ColorModeProvider } from "./hooks/useColorMode";
import {
	bindAccessTokenCookieLifecycle,
	clearAccessTokenCookie,
	syncAccessTokenCookie,
} from "./lib/auth/access-token-cookie";
import {
	identityToPublicSession,
	resolveUserIdentity,
} from "./lib/auth/identity";

export default function ClientWrapper({ children }: { children: JSX.Element }) {
	const routeChangePromiseRef = useRef<
		ReturnType<typeof Promise.withResolvers<Array<PropsData> | null>>
	>(Promise.withResolvers<Array<PropsData> | null>());
	const resetRouteChangePromise = useCallback(
		(ref: typeof routeChangePromiseRef) => {
			ref.current.resolve?.(null);
			ref.current = Promise.withResolvers<Array<PropsData> | null>();
		},
		[],
	);
	const [pathname, setPathname] = useState(window.location.pathname);
	const [devKey, setDevKey] = useState(0);
	const matched = useRef<ReturnType<typeof router.match>>(null);

	return (
		<StrictMode>
			<ColorModeProvider>
				<SSRPropsProvider
					pathname={pathname}
					afterFetchCallback={() =>
						resetRouteChangePromise(routeChangePromiseRef)
					}
					devKey={devKey}
					fetchCallback={(_, dynamicEndpoints) => {
						const res = Boolean(
							matched.current?.name &&
								dynamicEndpoints.includes(matched.current.name),
						);
						if (!res) resetRouteChangePromise(routeChangePromiseRef);
						return res;
					}}
				>
					<AuthProvider>
						<RouterHost
							onRouteChange={async (match) => {
								matched.current = match;
								setPathname(match.pathname);
								if (process.env.NODE_ENV === "development") {
									setDevKey((prev) => prev + 1);
								}
								await routeChangePromiseRef.current.promise;
							}}
						>
							{children}
						</RouterHost>
					</AuthProvider>
				</SSRPropsProvider>
			</ColorModeProvider>
		</StrictMode>
	);
}

function AuthProvider({ children }: { children: JSX.Element }) {
	const auth = useRef(createClient());
	const [session, setSession] = useState<PublicSession | null>(null);

	useEffect(() => bindAccessTokenCookieLifecycle(auth.current), []);

	useEffect(() => {
		let cancelled = false;
		auth.current
			.init()
			.then(async (client) => {
				if (cancelled) {
					return;
				}
				const token = (
					client as { getToken?: () => string | null }
				).getToken?.();
				if (token) {
					syncAccessTokenCookie(token);
				}

				const identity = await resolveUserIdentity(client);
				if (cancelled) {
					return;
				}
				if (!identity.role && !identity.email && !identity.id) {
					clearAccessTokenCookie();
					setSession(null);
					return;
				}
				setSession(identityToPublicSession(identity));
			})
			.catch((err) => {
				console.error("Auth init failed", err);
				if (!cancelled) {
					clearAccessTokenCookie();
					setSession(null);
				}
			});
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<AuthCtx.Provider value={auth.current}>
			<AuthSessionCtx.Provider value={session}>
				{children}
			</AuthSessionCtx.Provider>
		</AuthCtx.Provider>
	);
}
