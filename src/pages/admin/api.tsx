"use dynamic";

import {
	DELETE as revokeKey,
	POST as createKey,
} from "@api/private/admin/api-keys";
import { createLoader, createPageConfig } from "@next/ssr";
import { useLoader } from "@next/ssr/hooks";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import { useState } from "react";
import type { CtxData } from "../../action-utils/api-types";
import { AdminPageFrame } from "../../components/admin/page-frame";
import { RestaurantSwitch } from "../../components/admin/restaurant-switch";
import { loadApiPage } from "../../lib/admin/load";
import { canManageApiKeys } from "../../lib/auth/roles";
import type { ApiKeyScope } from "../../db/schema";

export const ssr_configs = createPageConfig({
	callback() {
		return { ttl: 15 };
	},
});

export const loader_api_keys = createLoader({
	name: "api_keys",
	async callback(ctx) {
		return loadApiPage(ctx as unknown as EventContext<Env, never, CtxData>);
	},
});

const ALL_SCOPES: ApiKeyScope[] = [
	"catalog:read",
	"orders:read",
	"orders:write",
	"tracking:read",
];

export default function ApiSettingsPage() {
	const data = useLoader(loader_api_keys);
	const bootstrap = data?.bootstrap;
	const canEdit = canManageApiKeys(bootstrap?.identity.parsed ?? null);
	const [name, setName] = useState("Site commande");
	const [secret, setSecret] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function create() {
		if (!bootstrap?.active) return;
		const result = await createKey({
			restaurantId: bootstrap.active.id,
			name,
			scopes: ALL_SCOPES,
		});
		if (!result.ok || !("key" in result)) {
			setError("error" in result ? result.error : "Erreur");
			return;
		}
		setSecret(result.key.secret);
	}

	async function revoke(id: string) {
		if (!bootstrap?.active) return;
		await revokeKey(bootstrap.active.id, id);
		window.location.reload();
	}

	const origin =
		typeof window !== "undefined" ? window.location.origin : "https://…";

	return (
		<AdminPageFrame bootstrap={bootstrap}>
			{bootstrap ? (
				<Stack spacing={3}>
					<RestaurantSwitch bootstrap={bootstrap} />
					<Typography variant="h5" Element="h1">
						Clés API
					</Typography>
					<Typography variant="body2" color="secondary">
						Pour un futur site de commande. Authorization: Bearer rp_live_…
					</Typography>
					{secret ? (
						<Alert severity="success">
							Copie cette clé maintenant, elle ne sera plus affichée :{" "}
							<code>{secret}</code>
						</Alert>
					) : null}
					{error ? <Typography color="error">{error}</Typography> : null}
					{canEdit ? (
						<Paper variant="outlined" className="p-4">
							<Stack spacing={2}>
								<TextField
									label="Nom"
									value={name}
									onChange={(event) =>
										setName((event.target as HTMLInputElement).value)
									}
								/>
								<Button
									variant="contained"
									color="primary"
									onClick={() => void create()}
								>
									Créer une clé
								</Button>
							</Stack>
						</Paper>
					) : null}
					<Paper variant="outlined" className="p-4">
						<Typography variant="subtitle2">Exemple</Typography>
						<pre className="mt-2 overflow-auto text-xs">
							{`curl ${origin}/api/v1/products \\
  -H "Authorization: Bearer rp_live_…"`}
						</pre>
					</Paper>
					<Stack spacing={1.5}>
						{(Array.isArray(data?.keys) ? data.keys : []).map((key) => (
							<Paper key={key.id} variant="outlined" className="p-3">
								<Stack
									direction="row"
									justifyContent="space-between"
									alignItems="center"
									flexWrap="wrap"
									useFlexGap
								>
									<div>
										<Typography variant="subtitle2">{key.name}</Typography>
										<Typography variant="caption" color="secondary">
											{key.prefix}…{" "}
											{key.revokedAt ? "révoquée" : "active"}
										</Typography>
										<div className="mt-1 flex flex-wrap gap-1">
											{key.scopes.map((scope) => (
												<Chip key={scope} size="small" label={scope} />
											))}
										</div>
									</div>
									{canEdit && !key.revokedAt ? (
										<Button
											size="small"
											color="secondary"
											onClick={() => void revoke(key.id)}
										>
											Révoquer
										</Button>
									) : null}
								</Stack>
							</Paper>
						))}
					</Stack>
				</Stack>
			) : null}
		</AdminPageFrame>
	);
}
