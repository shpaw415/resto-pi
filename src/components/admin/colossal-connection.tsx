import { POST as posAction, PUT as savePos } from "@api/private/admin/pos";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_POSIP_PATHS } from "../../lib/pos/posipapi";

export type PublicPosConnection = {
	adapter: "mock" | "colossal";
	config: {
		baseUrl: string;
		storeId: string;
		hasApiKey: boolean;
	};
};

function endpointList(baseUrl: string) {
	const root = (baseUrl || "https://{tenant}.colossalepos.com").replace(
		/\/+$/,
		"",
	);
	return [
		{ name: "Santé", path: DEFAULT_POSIP_PATHS.healthPath },
		{ name: "Menu", path: DEFAULT_POSIP_PATHS.pullPath },
		{ name: "Pré-validation", path: DEFAULT_POSIP_PATHS.statusPath },
		{ name: "Envoi commande", path: DEFAULT_POSIP_PATHS.pushPath },
	].map((row) => ({
		...row,
		url: `${root}${row.path}`,
	}));
}

export function ColossalConnectionCard({
	restaurantId,
	restaurantName,
	connection,
	canEdit,
}: {
	restaurantId: string;
	restaurantName: string;
	connection: PublicPosConnection | null;
	canEdit: boolean;
}) {
	const [baseUrl, setBaseUrl] = useState(connection?.config.baseUrl ?? "");
	const [locationId, setLocationId] = useState(
		connection?.config.storeId ?? "",
	);
	const [apiKey, setApiKey] = useState("");
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		setBaseUrl(connection?.config.baseUrl ?? "");
		setLocationId(connection?.config.storeId ?? "");
	}, [connection?.config.baseUrl, connection?.config.storeId]);

	const endpoints = useMemo(() => endpointList(baseUrl), [baseUrl]);
	const ready = Boolean(
		connection?.config.baseUrl &&
			connection.config.storeId &&
			connection.config.hasApiKey,
	);

	async function save() {
		setBusy(true);
		setError(null);
		const result = await savePos(restaurantId, {
			adapter: "colossal",
			config: { baseUrl, storeId: locationId, apiKey },
		});
		setBusy(false);
		if (!result || !("ok" in result) || !result.ok) {
			setError("Enregistrement impossible.");
			return;
		}
		setMessage("Connexion Colossal enregistrée pour cet établissement.");
		setApiKey("");
	}

	async function syncMenu() {
		setBusy(true);
		setError(null);
		const result = await posAction(restaurantId, "sync-menu");
		setBusy(false);
		if (!result.ok) {
			setError(result.error);
			return;
		}
		setMessage(
			"message" in result && result.message
				? String(result.message)
				: "Menu importé.",
		);
		window.setTimeout(() => window.location.reload(), 500);
	}

	async function ping() {
		setBusy(true);
		setError(null);
		const result = await posAction(restaurantId, "ping");
		setBusy(false);
		if (!result.ok) {
			setError(result.error);
			return;
		}
		setMessage(
			"message" in result && result.message
				? String(result.message)
				: "Healthcheck OK.",
		);
	}

	return (
		<Paper variant="outlined" className="p-4">
			<Stack spacing={2}>
				<Stack
					direction="row"
					justifyContent="space-between"
					alignItems="center"
					flexWrap="wrap"
					useFlexGap
					spacing={1}
				>
					<div>
						<Typography variant="h6" Element="h2">
							Colossal POS
						</Typography>
						<Typography variant="body2" color="secondary">
							{restaurantName} — endpoints UEAT / clé API (par établissement)
						</Typography>
					</div>
					<Chip
						size="small"
						color={ready ? "primary" : "secondary"}
						label={ready ? "Configurée" : "Incomplète"}
					/>
				</Stack>
				{message ? <Alert severity="success">{message}</Alert> : null}
				{error ? <Alert severity="error">{error}</Alert> : null}
				<div className="grid gap-2">
					{endpoints.map((row) => (
						<Typography key={row.path} variant="body2">
							<span className="theme-muted">{row.name}</span>{" "}
							<code className="break-all text-xs">{row.url}</code>
						</Typography>
					))}
				</div>
				{canEdit ? (
					<>
						<TextField
							name="colossal-base"
							label="URL établissement"
							value={baseUrl}
							placeholder="https://resto.colossalepos.com"
							onChange={(event) =>
								setBaseUrl((event.target as HTMLInputElement).value)
							}
						/>
						<TextField
							name="colossal-location"
							label="locationId"
							value={locationId}
							placeholder="20737"
							onChange={(event) =>
								setLocationId((event.target as HTMLInputElement).value)
							}
						/>
						<TextField
							name="colossal-key"
							label={
								connection?.config.hasApiKey
									? "Clé API (vide = conserver)"
									: "Clé API (Bearer)"
							}
							type="password"
							value={apiKey}
							onChange={(event) =>
								setApiKey((event.target as HTMLInputElement).value)
							}
						/>
						<Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
							<Button
								variant="contained"
								color="primary"
								disabled={busy}
								onClick={() => void save()}
							>
								Enregistrer
							</Button>
							<Button
								variant="outlined"
								disabled={busy}
								onClick={() => void ping()}
							>
								Tester healthcheck
							</Button>
							<Button
								variant="outlined"
								disabled={busy}
								onClick={() => void syncMenu()}
							>
								Importer le menu POS
							</Button>
						</Stack>
					</>
				) : (
					<Typography variant="body2" color="secondary">
						Rôle admin requis pour modifier la clé.
					</Typography>
				)}
			</Stack>
		</Paper>
	);
}
