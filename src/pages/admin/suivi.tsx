"use dynamic";

import { POST as archiveAlertsHttp } from "@api/private/admin/alerts";
import { POST as removeCourierHttp } from "@api/private/admin/duty";
import { useRestoLive } from "../../hooks/useRestoLive";
import { createLoader, createPageConfig } from "@next/ssr";
import { useLoader } from "@next/ssr/hooks";
import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Dialog, {
	DialogActions,
	DialogContent,
	DialogTitle,
} from "@shpaw415/mui-lite/Dialog";
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
	const live = useRestoLive();
	const [alerts, setAlerts] = useState(initial?.alerts ?? []);
	const [confirmArchive, setConfirmArchive] = useState(false);
	const [archiving, setArchiving] = useState(false);
	const [focus, setFocus] = useState<{
		id: string;
		lat: number;
		lng: number;
		at?: number;
		zoom?: number;
	} | null>(null);
	const couriers: CourierLivePosition[] =
		live.couriers.length > 0 ? live.couriers : (initial?.couriers ?? []);
	const center = initial?.center ?? {
		lat: 45.5756,
		lng: -70.882,
		name: "Restaurant",
	};

	useEffect(() => {
		if (live.connected) {
			setAlerts(live.alerts);
		} else if (initial?.alerts) {
			setAlerts(initial.alerts);
		}
	}, [live.connected, live.alerts, initial?.alerts]);

	async function archiveAlerts() {
		setArchiving(true);
		if (live.archiveAlerts()) {
			setAlerts([]);
			setConfirmArchive(false);
			setArchiving(false);
			return;
		}
		const restaurantId = initial?.bootstrap.active?.id;
		if (!restaurantId) {
			setArchiving(false);
			return;
		}
		const result = await archiveAlertsHttp(restaurantId);
		setArchiving(false);
		if (result.ok) {
			setAlerts([]);
			setConfirmArchive(false);
		}
	}

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
						Carte OSM — positions via WebSocket
						{live.connected ? "." : " (connexion…)"}
					</Typography>
					<OsmMap
						center={center}
						markers={markers}
						viewKey={initial.bootstrap.active?.id}
						focus={focus}
					/>
					<Button
						variant="outlined"
						onClick={() =>
							setFocus({
								id: "resto",
								lat: center.lat,
								lng: center.lng,
								at: Date.now(),
								zoom: 13,
							})
						}
					>
						Centrer sur le resto
					</Button>
					<Typography variant="h6" Element="h2">
						Livreurs
					</Typography>
					{couriers.length === 0 ? (
						<Typography variant="body2" color="secondary">
							Aucun livreur actif sur la carte.
						</Typography>
					) : (
						<Stack spacing={1}>
							{couriers.map((courier) => (
								<Paper key={`map-${courier.courierUserId}`} variant="outlined" className="p-3">
									<Stack
										direction="row"
										justifyContent="space-between"
										alignItems="center"
										spacing={1}
									>
										<div>
											<Typography variant="subtitle2">
												{courier.name || courier.email || "Livreur"}
											</Typography>
											<Typography variant="caption" color="secondary">
												{ageLabel(courier.recordedAt)}
											</Typography>
										</div>
										<Button
											size="small"
											variant="contained"
											onClick={() =>
												setFocus({
													id: courier.courierUserId,
													lat: courier.lat,
													lng: courier.lng,
													at: Date.now(),
												})
											}
										>
											Localiser
										</Button>
									</Stack>
								</Paper>
							))}
						</Stack>
					)}
					<StaffCourierChat
						restaurantId={initial.bootstrap.active?.id}
						selfKind="staff"
					/>
					<ClientNoteCard restaurantId={initial.bootstrap.active?.id} />
					<Stack
						direction="row"
						justifyContent="space-between"
						alignItems="center"
					>
						<Typography variant="h6" Element="h2">
							Alertes livreur
						</Typography>
						<Button
							variant="outlined"
							disabled={alerts.length === 0}
							onClick={() => setConfirmArchive(true)}
						>
							Archiver alertes
						</Button>
					</Stack>
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
										spacing={1}
									>
										<div>
											<Typography variant="subtitle2">
												{courier.name || courier.email || courier.courierUserId}
											</Typography>
											<Typography variant="caption" color="secondary">
												{courier.lat.toFixed(5)}, {courier.lng.toFixed(5)}
											</Typography>
										</div>
										<Stack direction="row" spacing={1} alignItems="center">
											<Chip
												size="small"
												color="primary"
												label={ageLabel(courier.recordedAt)}
											/>
											<Button
												size="small"
												variant="outlined"
												onClick={() => {
													if (live.removeCourier(courier.courierUserId)) {
														return;
													}
													const restaurantId = initial?.bootstrap.active?.id;
													if (restaurantId) {
														void removeCourierHttp(
															restaurantId,
															courier.courierUserId,
														);
													}
												}}
											>
												Retirer
											</Button>
										</Stack>
									</Stack>
								</Paper>
							))
						)}
					</Stack>
				</Stack>
			) : null}
			<Dialog
				open={confirmArchive}
				onClose={() => setConfirmArchive(false)}
			>
				<DialogTitle>Archiver les alertes ?</DialogTitle>
				<DialogContent>
					<Typography>
						Les alertes visibles seront retirées du suivi. Cette action ne
						supprime pas l’historique.
					</Typography>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setConfirmArchive(false)}>Annuler</Button>
					<Button
						variant="contained"
						color="primary"
						disabled={archiving}
						onClick={() => void archiveAlerts()}
					>
						Archiver
					</Button>
				</DialogActions>
			</Dialog>
		</AdminPageFrame>
	);
}
