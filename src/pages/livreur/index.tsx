"use dynamic";

import { createLoader, createPageConfig } from "@next/ssr";
import { useLoader } from "@next/ssr/hooks";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import type { CtxData } from "../../action-utils/api-types";
import { OsmMap } from "../../components/map/osm-map";
import { useLivreurTracking } from "../../hooks/useLivreurTracking";
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

export default function LivreurCartePage() {
	const data = useLoader(loader_livreur);
	const tracking = useLivreurTracking();
	const allowed = data ? canEnterCourier(data.bootstrap.identity) : false;

	if (!data) {
		return null;
	}
	if (!allowed) {
		return (
			<Paper elevation={1} className="p-5">
				<Typography variant="h6">Accès livreur requis</Typography>
				<Typography color="secondary">
					Rôle OpenAuthster <code>{"{tenant}:courier"}</code>.
				</Typography>
			</Paper>
		);
	}

	const center = tracking.coords ?? data.center;

	return (
		<Stack spacing={1.5} className="pb-2">
			<Typography variant="body2" color="secondary">
				{data.bootstrap.active?.name ?? "Restaurant"}
			</Typography>
			{tracking.error ? (
				<Alert severity="error">{tracking.error}</Alert>
			) : (
				<Alert severity={tracking.tracking ? "success" : "info"}>
					{tracking.status}
				</Alert>
			)}
			<OsmMap
				center={center}
				markers={
					tracking.coords
						? [
								{
									id: "self",
									lat: tracking.coords.lat,
									lng: tracking.coords.lng,
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
			<div className="flex justify-center pt-1">
				<Button
					variant="contained"
					color="primary"
					size="large"
					fullWidth
					onClick={tracking.toggle}
				>
					{tracking.tracking ? "Arrêter le GPS" : "Démarrer le GPS"}
				</Button>
			</div>
			{tracking.coords ? (
				<Typography variant="caption" color="secondary" align="center">
					{tracking.coords.lat.toFixed(5)}, {tracking.coords.lng.toFixed(5)}
				</Typography>
			) : null}
		</Stack>
	);
}
