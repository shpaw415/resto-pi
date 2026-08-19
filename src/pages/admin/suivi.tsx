"use dynamic";

import { GET as loadTracking } from "@api/private/admin/tracking";
import { RestoLiveProvider, useRestoLive } from "../../hooks/useRestoLive";
import { createLoader, createPageConfig } from "@next/ssr";
import { useLoader } from "@next/ssr/hooks";
import Chip from "@shpaw415/mui-lite/Chip";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";
import type { CtxData } from "../../action-utils/api-types";
import { AdminPageFrame } from "../../components/admin/page-frame";
import { RestaurantSwitch } from "../../components/admin/restaurant-switch";
import { OsmMap, type MapMarker } from "../../components/map/osm-map";
import { ClientNoteCard } from "../../components/ops/client-note-card";
import { StaffCourierChat } from "../../components/ops/staff-courier-chat";
import { loadSuiviPage } from "../../lib/admin/load";
import type {
	CourierAlert,
	CourierLivePosition,
} from "../../lib/tracking/service";

export const ssr_configs = createPageConfig({
	callback() {
		return { ttl: 5 };
	},
});

export const loader_suivi = createLoader({
	name: "suivi",
	async callback(ctx) {
		return loadSuiviPage(ctx as unknown as EventContext<Env, never, CtxData>);
	},
});

function samePoint(
	a: { lat: number; lng: number },
	b: { lat: number; lng: number },
) {
	return Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6;
}

function ageLabel(iso: string): string {
	const delta = Date.now() - new Date(iso).getTime();
	if (!Number.isFinite(delta) || delta < 0) {
		return "à l’instant";
	}
	const seconds = Math.round(delta / 1000);
	if (seconds < 60) {
		return `il y a ${seconds}s`;
	}
	return `il y a ${Math.round(seconds / 60)} min`;
}

export default function SuiviPage() {
	const initial = useLoader(loader_suivi);
	const restaurantId = initial?.bootstrap.active?.id;
	return (
		<RestoLiveProvider restaurantId={restaurantId}>
			<SuiviBody />
		</RestoLiveProvider>
	);
}

function SuiviBody() {
	const initial = useLoader(loader_suivi);
	const live = useRestoLive();
	const [couriers, setCouriers] = useState<CourierLivePosition[]>(
		live.couriers.length > 0 ? live.couriers : (initial?.couriers ?? []),
	);
	const [alerts, setAlerts] = useState<CourierAlert[]>(initial?.alerts ?? []);
	const [center, setCenter] = useState(
		initial?.center ?? { lat: 45.5756, lng: -70.882, name: "Restaurant" },
	);

	useEffect(() => {
		if (live.connected) {
			setCouriers(live.couriers);
		}
	}, [live.connected, live.couriers]);

	useEffect(() => {
		if (!live.connected) {
			setCouriers(initial?.couriers ?? []);
		}
		setAlerts(initial?.alerts ?? []);
		if (initial?.center) {
			setCenter(initial.center);
		}
	}, [initial?.couriers, initial?.alerts, initial?.center, live.connected]);

	useEffect(() => {
		const restaurantId = initial?.bootstrap.active?.id;
		if (!restaurantId) {
			return;
		}
		const timer = window.setInterval(() => {
			void loadTracking(restaurantId).then((result) => {
				if (!result || !("ok" in result) || !result.ok) {
					return;
				}
				if (!live.connected) {
					setCouriers(result.couriers);
				}
				setCenter((current) =>
					samePoint(current, result.center) && current.name === result.center.name
						? current
						: result.center,
				);
				setAlerts(result.alerts);
			});
		}, 5000);
		return () => window.clearInterval(timer);
	}, [initial?.bootstrap.active?.id, live.connected]);

	const markers: MapMarker[] = [
		{
			id: "resto",
			lat: center.lat,
			lng: center.lng,
			label: center.name,
			kind: "restaurant",
		},
		...couriers.map((courier) => ({
			id: courier.courierUserId,
			lat: courier.lat,
			lng: courier.lng,
			label: courier.name || courier.email || "Livreur",
			kind: "courier" as const,
		})),
	];

	return (
		<AdminPageFrame bootstrap={initial?.bootstrap}>
			{initial?.bootstrap ? (
				<Stack spacing={2}>
					<RestaurantSwitch bootstrap={initial.bootstrap} />
					<Typography variant="h5" Element="h1">
						Livreurs en direct
					</Typography>
					<Typography variant="body2" color="secondary">
						Carte OSM
						{live.connected
							? " — positions en direct (WebSocket)."
							: " — secours HTTP 5s."}
					</Typography>
					<OsmMap
						center={center}
						markers={markers}
						viewKey={initial.bootstrap.active?.id}
					/>
					<StaffCourierChat
						restaurantId={initial.bootstrap.active?.id}
						selfKind="staff"
					/>
					<ClientNoteCard restaurantId={initial.bootstrap.active?.id} />
					<Typography variant="h6" Element="h2">
						Alertes livreur
					</Typography>
					{alerts.length === 0 ? (
						<Typography variant="body2" color="secondary">
							Aucune alerte récente.
						</Typography>
					) : (
						alerts.map((alert) => (
							<Paper key={alert.id} elevation={1} className="p-3">
								<Stack
									direction="row"
									justifyContent="space-between"
									alignItems="center"
									spacing={1}
								>
									<div>
										<Typography variant="subtitle2">{alert.label}</Typography>
										<Typography variant="caption" color="secondary">
											{alert.courierName || "Livreur"}
										</Typography>
									</div>
									<Chip
										size="small"
										color={alert.kind === "help" ? "error" : "secondary"}
										label={ageLabel(alert.createdAt)}
									/>
								</Stack>
							</Paper>
						))
					)}
					<Typography variant="h6" Element="h2">
						Positions
					</Typography>
					<Stack spacing={1}>
						{couriers.length === 0 ? (
							<Paper variant="outlined" className="p-4">
								<Typography color="secondary">
									Aucun livreur n’envoie sa position. Le rôle{" "}
									<code>{`{slug}:courier`}</code> doit ouvrir /livreur.
								</Typography>
							</Paper>
						) : (
							couriers.map((courier) => (
								<Paper key={courier.courierUserId} variant="outlined" className="p-3">
									<Stack
										direction="row"
										justifyContent="space-between"
										alignItems="center"
									>
										<div>
											<Typography variant="subtitle2">
												{courier.name || courier.email || courier.courierUserId}
											</Typography>
											<Typography variant="caption" color="secondary">
												{courier.lat.toFixed(5)}, {courier.lng.toFixed(5)}
											</Typography>
										</div>
										<Chip
											size="small"
											color="primary"
											label={ageLabel(courier.recordedAt)}
										/>
									</Stack>
								</Paper>
							))
						)}
					</Stack>
				</Stack>
			) : null}
		</AdminPageFrame>
	);
}
