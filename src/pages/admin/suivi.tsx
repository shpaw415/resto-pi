"use dynamic";

import { GET as loadTracking } from "@api/private/admin/tracking";
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
import { loadSuiviPage } from "../../lib/admin/load";
import type { CourierLivePosition } from "../../lib/tracking/service";

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
	const [couriers, setCouriers] = useState<CourierLivePosition[]>(
		initial?.couriers ?? [],
	);
	const [center, setCenter] = useState(
		initial?.center ?? { lat: 45.5017, lng: -73.5673, name: "Restaurant" },
	);

	useEffect(() => {
		setCouriers(initial?.couriers ?? []);
		if (initial?.center) {
			setCenter(initial.center);
		}
	}, [initial?.couriers, initial?.center]);

	useEffect(() => {
		const restaurantId = initial?.bootstrap.active?.id;
		if (!restaurantId) {
			return;
		}
		const timer = window.setInterval(() => {
			void loadTracking(restaurantId).then((result) => {
				if (result && "ok" in result && result.ok) {
					setCouriers(result.couriers);
					setCenter(result.center);
				}
			});
		}, 5000);
		return () => window.clearInterval(timer);
	}, [initial?.bootstrap.active?.id]);

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
						Carte OSM, rafraîchie toutes les 5 secondes.
					</Typography>
					<OsmMap center={center} markers={markers} />
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
