"use dynamic";

import { POST as sendAlert } from "@api/private/livreur/alert";
import { createLoader, createPageConfig } from "@next/ssr";
import { useLoader } from "@next/ssr/hooks";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useState } from "react";
import type { CtxData } from "../../action-utils/api-types";
import type { CourierAlertKind } from "../../db/schema";
import { useLivreurTracking } from "../../hooks/useLivreurTracking";
import { loadLivreurPage } from "../../lib/admin/load";
import { canEnterCourier } from "../../lib/auth/identity";
import { COURIER_ALERT_LABELS } from "../../lib/tracking/service";

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

const QUICK_ACTIONS: Array<{
	kind: CourierAlertKind;
	color?: "primary" | "secondary" | "error";
}> = [
	{ kind: "traffic", color: "secondary" },
	{ kind: "nobody_home", color: "secondary" },
	{ kind: "no_answer", color: "secondary" },
	{ kind: "wrong_address", color: "secondary" },
	{ kind: "arrived", color: "primary" },
	{ kind: "returning", color: "primary" },
	{ kind: "help", color: "error" },
];

export default function LivreurStatutPage() {
	const data = useLoader(loader_livreur);
	const tracking = useLivreurTracking();
	const allowed = data ? canEnterCourier(data.bootstrap.identity) : false;
	const [notice, setNotice] = useState<string | null>(null);
	const [busy, setBusy] = useState<CourierAlertKind | null>(null);

	async function notify(kind: CourierAlertKind) {
		setBusy(kind);
		setNotice(null);
		const result = await sendAlert(kind);
		setBusy(null);
		if (!result.ok) {
			setNotice(result.error);
			return;
		}
		setNotice(`Envoyé : ${COURIER_ALERT_LABELS[kind]}`);
	}

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

	return (
		<Stack spacing={2}>
			<Typography variant="body2" color="secondary">
				{data.bootstrap.active?.name ?? "Restaurant"}
			</Typography>
			<Paper elevation={1} className="p-4">
				<Stack spacing={1.5}>
					<Typography variant="subtitle1">Statut GPS</Typography>
					{tracking.error ? (
						<Alert severity="error">{tracking.error}</Alert>
					) : (
						<Alert severity={tracking.tracking ? "success" : "info"}>
							{tracking.status}
						</Alert>
					)}
					<Button
						variant="contained"
						color="primary"
						size="large"
						fullWidth
						onClick={tracking.toggle}
					>
						{tracking.tracking ? "Arrêter le GPS" : "Démarrer le GPS"}
					</Button>
					{tracking.coords ? (
						<Typography variant="caption" color="secondary">
							{tracking.coords.lat.toFixed(5)}, {tracking.coords.lng.toFixed(5)}
						</Typography>
					) : null}
				</Stack>
			</Paper>
			<Paper elevation={1} className="p-4">
				<Stack spacing={1.5}>
					<Typography variant="subtitle1">Actions rapides</Typography>
					<Typography variant="body2" color="secondary">
						Le restaurant est notifié tout de suite.
					</Typography>
					{notice ? <Alert severity="success">{notice}</Alert> : null}
					{QUICK_ACTIONS.map((action) => (
						<Button
							key={action.kind}
							variant={action.kind === "help" ? "contained" : "outlined"}
							color={action.color ?? "primary"}
							size="large"
							fullWidth
							disabled={busy !== null}
							onClick={() => void notify(action.kind)}
						>
							{COURIER_ALERT_LABELS[action.kind]}
						</Button>
					))}
				</Stack>
			</Paper>
		</Stack>
	);
}
