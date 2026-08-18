"use dynamic";

import { POST as sendPosition } from "@api/private/livreur/position";
import { createLoader, createPageConfig } from "@next/ssr";
import { useLoader } from "@next/ssr/hooks";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";
import type { CtxData } from "../../action-utils/api-types";
import { OsmMap } from "../../components/map/osm-map";
import { loadLivreurPage } from "../../lib/admin/load";
import { canEnterCourier } from "../../lib/auth/identity";

export const ssr_configs = createPageConfig({
	callback() {
		return { ttl: 10 };
	},
});

export const loader_livreur = createLoader({
	name: "livreur",
	async callback(ctx) {
		return loadLivreurPage(
			ctx as unknown as EventContext<Env, never, CtxData>,
		);
	},
});

export default function LivreurPage() {
	const data = useLoader(loader_livreur);
	const allowed = data ? canEnterCourier(data.bootstrap.identity) : false;
	const [tracking, setTracking] = useState(false);
	const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
		null,
	);
	const [status, setStatus] = useState("GPS arrêté");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!tracking) {
			return;
		}
		if (!navigator.geolocation) {
			setError("Géolocalisation indisponible sur cet appareil.");
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
					setStatus(`Position envoyée ${new Date().toLocaleTimeString("fr-CA")}`);
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

	if (!data) {
		return null;
	}
	if (!allowed) {
		return (
			<Paper className="p-6">
				<Typography variant="h6">Accès livreur requis</Typography>
				<Typography color="secondary">
					Rôle OpenAuthster <code>{`{slug}:courier`}</code>.
				</Typography>
			</Paper>
		);
	}

	const center = coords ?? data.center;

	return (
		<Stack spacing={2}>
			<Typography variant="h5" Element="h1">
				Suivi en direct
			</Typography>
			<Typography variant="body2" color="secondary">
				{data.bootstrap.active?.name ?? "Restaurant"} — ta position est
				envoyée toutes les quelques secondes.
			</Typography>
			{error ? <Alert severity="error">{error}</Alert> : null}
			<Alert severity={tracking ? "success" : "info"}>{status}</Alert>
			<Button
				variant="contained"
				color="primary"
				onClick={() => {
					setTracking((current) => !current);
					setStatus((current) =>
						current.startsWith("Position") || current === "GPS arrêté"
							? tracking
								? "GPS arrêté"
								: "Recherche GPS…"
							: current,
					);
				}}
			>
				{tracking ? "Arrêter le suivi" : "Démarrer le suivi"}
			</Button>
			<OsmMap
				center={center}
				markers={
					coords
						? [
								{
									id: "self",
									lat: coords.lat,
									lng: coords.lng,
									label: "Moi",
									kind: "self",
								},
							]
						: [
								{
									id: "resto",
									lat: data.center.lat,
									lng: data.center.lng,
									label: data.center.name,
									kind: "restaurant",
								},
							]
				}
			/>
			{coords ? (
				<Typography variant="caption" color="secondary">
					{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
				</Typography>
			) : null}
		</Stack>
	);
}
