"use dynamic";

import { POST as posAction, PUT as savePos } from "@api/private/admin/pos";
import { createLoader, createPageConfig } from "@next/ssr";
import { useLoader } from "@next/ssr/hooks";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useState } from "react";
import type { CtxData } from "../../action-utils/api-types";
import { ColossalConnectionCard } from "../../components/admin/colossal-connection";
import { AdminPageFrame } from "../../components/admin/page-frame";
import { RestaurantSwitch } from "../../components/admin/restaurant-switch";
import { loadPosPage } from "../../lib/admin/load";
import { canManagePos } from "../../lib/auth/roles";

export const ssr_configs = createPageConfig({
	callback() {
		return { ttl: 10 };
	},
});

export const loader_pos = createLoader({
	name: "pos",
	async callback(ctx) {
		return loadPosPage(ctx as unknown as EventContext<Env, never, CtxData>);
	},
});

export default function PosPage() {
	const data = useLoader(loader_pos);
	const bootstrap = data?.bootstrap;
	const connection = data?.connection;
	const canEdit = canManagePos(bootstrap?.identity.parsed ?? null);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function run(action: "import" | "seed" | "ping") {
		if (action !== "seed" && !bootstrap?.active) return;
		setError(null);
		const result = await posAction(bootstrap?.active?.id ?? null, action);
		if (!result.ok) {
			setError(result.error);
			return;
		}
		if ("message" in result && result.message) {
			setMessage(String(result.message));
			return;
		}
		const created =
			"created" in result && result.created ? result.created.length : 0;
		const skipped = "skipped" in result ? Number(result.skipped ?? 0) : 0;
		setMessage(`${created} nouvelle(s), ${skipped} déjà importée(s).`);
		window.setTimeout(() => window.location.reload(), 700);
	}

	async function choose(adapter: "mock" | "colossal") {
		if (!bootstrap?.active) return;
		await savePos(bootstrap.active.id, adapter);
		window.location.reload();
	}

	return (
		<AdminPageFrame bootstrap={bootstrap}>
			{bootstrap ? (
				<Stack spacing={3}>
					<RestaurantSwitch bootstrap={bootstrap} />
					<Typography variant="h5" Element="h1">
						Connexion POS
					</Typography>
					<Typography variant="body2" color="secondary">
						Clé et URL Colossal se règlent aussi sur le tableau de bord, par
						établissement.
					</Typography>
					{message ? <Alert severity="success">{message}</Alert> : null}
					{error ? <Alert severity="error">{error}</Alert> : null}
					<Paper variant="outlined" className="p-4">
						<Typography variant="subtitle1">
							Adaptateur :{" "}
							{connection?.adapter === "colossal"
								? "Colossal / POSIPAPI"
								: "Mock"}
						</Typography>
						{canEdit ? (
							<Stack
								direction="row"
								spacing={1}
								className="mt-3"
								flexWrap="wrap"
								useFlexGap
							>
								{bootstrap.active ? (
									<>
										<Button
											variant="outlined"
											onClick={() => void choose("mock")}
										>
											Utiliser mock
										</Button>
										<Button
											variant="outlined"
											onClick={() => void choose("colossal")}
										>
											Utiliser Colossal
										</Button>
										<Button
											variant="contained"
											color="primary"
											onClick={() => void run("import")}
										>
											Importer depuis le POS
										</Button>
										<Button
											variant="outlined"
											onClick={() => void run("ping")}
										>
											Tester POSIPAPI
										</Button>
									</>
								) : null}
								<Button variant="outlined" onClick={() => void run("seed")}>
									Données de démo
								</Button>
							</Stack>
						) : (
							<Typography color="secondary" className="mt-2">
								Rôle admin requis.
							</Typography>
						)}
					</Paper>
					{bootstrap.active ? (
						<ColossalConnectionCard
							restaurantId={bootstrap.active.id}
							restaurantName={bootstrap.active.name}
							connection={connection ?? null}
							canEdit={canEdit}
						/>
					) : null}
				</Stack>
			) : null}
		</AdminPageFrame>
	);
}
