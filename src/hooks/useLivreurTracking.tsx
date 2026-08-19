import { POST as sendPositionHttp } from "@api/private/livreur/position";
import { useOptionalRestoLive } from "./useRestoLive";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { debugLog } from "../lib/debug/logger";

type Coords = { lat: number; lng: number };

type LivreurTrackingValue = {
	tracking: boolean;
	coords: Coords | null;
	status: string;
	error: string | null;
	toggle: () => void;
};

const LivreurTrackingCtx = createContext<LivreurTrackingValue | null>(null);

function geoMessage(error: GeolocationPositionError) {
	if (error.code === error.PERMISSION_DENIED) {
		return "Permission GPS refusée.";
	}
	if (error.code === error.POSITION_UNAVAILABLE) {
		return "Position indisponible.";
	}
	if (error.code === error.TIMEOUT) {
		return "Délai GPS dépassé (précision haute). Nouvel essai…";
	}
	return error.message || "Erreur GPS.";
}

export function LivreurTrackingProvider({
	active = true,
	children,
}: {
	active?: boolean;
	children: ReactNode;
}) {
	const live = useOptionalRestoLive();
	const liveRef = useRef(live);
	liveRef.current = live;
	const [tracking, setTracking] = useState(false);
	const [coords, setCoords] = useState<Coords | null>(null);
	const coordsRef = useRef<Coords | null>(null);
	const [status, setStatus] = useState("GPS arrêté");
	const [error, setError] = useState<string | null>(null);

	async function publish(next: Coords) {
		coordsRef.current = next;
		if (liveRef.current?.sendPosition(next.lat, next.lng)) {
			debugLog("gps", `WS ${next.lat.toFixed(5)}, ${next.lng.toFixed(5)}`);
			setStatus(`Envoyée ${new Date().toLocaleTimeString("fr-CA")}`);
			return;
		}
		debugLog("gps", "WS fermé — fallback HTTP");
		const result = await sendPositionHttp(next);
		if (!result.ok) {
			debugLog("gps", `HTTP échec: ${result.error}`);
			setError(result.error);
			return;
		}
		setStatus(`Envoyée ${new Date().toLocaleTimeString("fr-CA")}`);
	}

	useEffect(() => {
		if (!active && tracking) {
			debugLog("gps", "inactif — arrêt");
			setTracking(false);
			setStatus("GPS arrêté");
		}
	}, [active, tracking]);

	useEffect(() => {
		if (active && live?.connected && !tracking) {
			debugLog("gps", "WS connecté — démarrage GPS");
			setTracking(true);
			setStatus("Recherche GPS…");
		}
	}, [active, live?.connected]);

	useEffect(() => {
		if (!tracking || !active) {
			return;
		}
		if (!navigator.geolocation) {
			debugLog("gps", "navigator.geolocation absent");
			setError("Géolocalisation indisponible.");
			setTracking(false);
			return;
		}

		let watch: number | null = null;
		let highAccuracy = true;

		function startWatch(accurate: boolean) {
			if (watch != null) {
				navigator.geolocation.clearWatch(watch);
			}
			debugLog(
				"gps",
				`watch start accuracy=${accurate} proto=${window.location.protocol}`,
			);
			watch = navigator.geolocation.watchPosition(
				(position) => {
					const next = {
						lat: position.coords.latitude,
						lng: position.coords.longitude,
					};
					debugLog(
						"gps",
						`fix ±${Math.round(position.coords.accuracy)}m`,
						next,
					);
					setCoords(next);
					setError(null);
					void publish(next);
				},
				(geoError) => {
					debugLog(
						"gps",
						`erreur ${geoError.code} ${geoError.message}`,
					);
					if (geoError.code === geoError.TIMEOUT && accurate) {
						highAccuracy = false;
						startWatch(false);
						setError(geoMessage(geoError));
						return;
					}
					if (coordsRef.current && geoError.code === geoError.TIMEOUT) {
						setError(null);
						return;
					}
					setError(geoMessage(geoError));
				},
				{
					enableHighAccuracy: accurate,
					maximumAge: 15_000,
					timeout: accurate ? 45_000 : 20_000,
				},
			);
		}

		startWatch(highAccuracy);
		const ping = window.setInterval(() => {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					void publish({
						lat: position.coords.latitude,
						lng: position.coords.longitude,
					});
				},
				(geoError) => {
					debugLog("gps", `ping ${geoError.code} ${geoError.message}`);
				},
				{
					enableHighAccuracy: highAccuracy,
					maximumAge: 15_000,
					timeout: 20_000,
				},
			);
		}, 8000);
		return () => {
			debugLog("gps", "watch stop");
			if (watch != null) {
				navigator.geolocation.clearWatch(watch);
			}
			window.clearInterval(ping);
		};
	}, [tracking, active]);

	const toggle = useCallback(() => {
		setTracking((current) => {
			const next = !current;
			debugLog("gps", next ? "toggle on" : "toggle off");
			setStatus(next ? "Recherche GPS…" : "GPS arrêté");
			if (!next) {
				setError(null);
			}
			return next;
		});
	}, []);

	const value = useMemo(
		() => ({ tracking, coords, status, error, toggle }),
		[tracking, coords, status, error, toggle],
	);

	return (
		<LivreurTrackingCtx.Provider value={value}>
			{children}
		</LivreurTrackingCtx.Provider>
	);
}

export function useLivreurTracking() {
	const ctx = useContext(LivreurTrackingCtx);
	if (!ctx) {
		throw new Error("useLivreurTracking hors LivreurTrackingProvider");
	}
	return ctx;
}
