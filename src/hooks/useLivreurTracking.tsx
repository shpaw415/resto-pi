import { POST as sendPosition } from "@api/private/livreur/position";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

type Coords = { lat: number; lng: number };

type LivreurTrackingValue = {
	tracking: boolean;
	coords: Coords | null;
	status: string;
	error: string | null;
	toggle: () => void;
};

const LivreurTrackingCtx = createContext<LivreurTrackingValue | null>(null);

export function LivreurTrackingProvider({ children }: { children: ReactNode }) {
	const [tracking, setTracking] = useState(false);
	const [coords, setCoords] = useState<Coords | null>(null);
	const [status, setStatus] = useState("GPS arrêté");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!tracking) {
			return;
		}
		if (!navigator.geolocation) {
			setError("Géolocalisation indisponible.");
			setTracking(false);
			return;
		}
		const watch = navigator.geolocation.watchPosition(
			(position) => {
				const next = {
					lat: position.coords.latitude,
					lng: position.coords.longitude,
				};
				setCoords(next);
				setError(null);
				void sendPosition(next).then((result) => {
					if (!result.ok) {
						setError(result.error);
						return;
					}
					setStatus(
						`Envoyée ${new Date().toLocaleTimeString("fr-CA")}`,
					);
				});
			},
			(geoError) => {
				setError(geoError.message);
			},
			{ enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
		);
		const ping = window.setInterval(() => {
			navigator.geolocation.getCurrentPosition((position) => {
				void sendPosition({
					lat: position.coords.latitude,
					lng: position.coords.longitude,
				});
			});
		}, 8000);
		return () => {
			navigator.geolocation.clearWatch(watch);
			window.clearInterval(ping);
		};
	}, [tracking]);

	const toggle = useCallback(() => {
		setTracking((current) => {
			const next = !current;
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
