"use dynamic";

import { useAuth } from "@hooks/useAuth";
import { createLoader, createPageConfig } from "@next/ssr";
import { useLoader } from "@next/ssr/hooks";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Switch from "@shpaw415/mui-lite/Switch";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";
import type { CtxData } from "../../action-utils/api-types";
import { useLivreurTracking } from "../../hooks/useLivreurTracking";
import { useOptionalRestoLive } from "../../hooks/useRestoLive";
import { loadLivreurPage } from "../../lib/admin/load";
import { logoutClient } from "../../lib/auth/access-token-cookie";
import { canEnterCourier } from "../../lib/auth/identity";
import {
	hydrateDebugMode,
	setDebugEnabled,
	subscribeDebugMode,
} from "../../lib/debug/logger";

export const ssr_configs = createPageConfig({
	callback() {
		return { ttl: 15 };
	},
});

export const loader_livreur_compte = createLoader({
	name: "livreur_compte",
	async callback(ctx) {
		return loadLivreurPage(
			ctx as unknown as EventContext<Env, never, CtxData>,
		);
	},
});

export default function LivreurComptePage() {
	const auth = useAuth();
	const tracking = useLivreurTracking();
	const live = useOptionalRestoLive();
	const data = useLoader(loader_livreur_compte);
	const [devMode, setDevMode] = useState(false);

	useEffect(() => {
		setDevMode(hydrateDebugMode());
		return subscribeDebugMode(setDevMode);
	}, []);
	if (!data) {
		return null;
	}
	if (!canEnterCourier(data.bootstrap.identity)) {
		return (
			<Paper elevation={1} className="p-5">
				<Typography>Accès livreur requis.</Typography>
			</Paper>
		);
	}

	const identity = data.bootstrap.identity;

	return (
		<Stack spacing={2}>
			<Paper elevation={1} className="p-5">
				<Stack spacing={1}>
					<Typography variant="h6" Element="h1">
						{identity.name || identity.email || "Livreur"}
					</Typography>
					<Typography variant="body2" color="secondary">
						{identity.role}
					</Typography>
					<Typography variant="body2">
						{data.bootstrap.active?.name ?? "Aucun restaurant"}
					</Typography>
					<Typography variant="caption" color="secondary">
						GPS : {tracking.tracking ? "actif" : "arrêté"}
					</Typography>
				</Stack>
			</Paper>
			<Button
				variant="contained"
				color="primary"
				size="large"
				fullWidth
				onClick={tracking.toggle}
			>
				{tracking.tracking ? "Arrêter le GPS" : "Démarrer le GPS"}
			</Button>
			<Paper elevation={1} className="p-4">
				<Switch
					label="Mode debug"
					checked={devMode}
					onChange={(event) =>
						setDebugEnabled((event.target as HTMLInputElement).checked)
					}
				/>
				<Typography variant="caption" color="secondary">
					Affiche les logs GPS / WebSocket sur Statut.
				</Typography>
			</Paper>
			<Button
				variant="outlined"
				color="secondary"
				size="large"
				fullWidth
				onClick={() => live?.punchOut()}
			>
				Pointer la sortie
			</Button>
			<Button
				variant="outlined"
				color="secondary"
				size="large"
				fullWidth
				onClick={() => {
					logoutClient(auth);
					window.location.assign("/login");
				}}
			>
				Déconnexion
			</Button>
		</Stack>
	);
}
