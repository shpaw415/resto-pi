"use dynamic";

import { POST as posAction } from "@api/private/admin/pos";
import { createLoader, createPageConfig } from "@next/ssr";
import { useLoader } from "@next/ssr/hooks";
import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useState } from "react";
import type { CtxData } from "../../action-utils/api-types";
import { AdminPageFrame } from "../../components/admin/page-frame";
import { RestaurantSwitch } from "../../components/admin/restaurant-switch";
import { loadCatalogPage } from "../../lib/admin/load";
import { canManageCatalog } from "../../lib/auth/roles";
import { formatCad } from "../../lib/money";

export const ssr_configs = createPageConfig({
	callback() {
		return { ttl: 15 };
	},
});

export const loader_catalog = createLoader({
	name: "catalog",
	async callback(ctx) {
		return loadCatalogPage(
			ctx as unknown as EventContext<Env, never, CtxData>,
		);
	},
});

export default function CatalogPage() {
	const data = useLoader(loader_catalog);
	const bootstrap = data?.bootstrap;
	const canEdit = canManageCatalog(bootstrap?.identity.parsed ?? null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	async function syncMenu() {
		if (!bootstrap?.active) return;
		setBusy(true);
		setError(null);
		const result = await posAction(bootstrap.active.id, "sync-menu");
		setBusy(false);
		if (!result.ok) {
			setError(result.error);
			return;
		}
		window.location.reload();
	}

	return (
		<AdminPageFrame bootstrap={bootstrap}>
			{bootstrap ? (
				<Stack spacing={3}>
					<RestaurantSwitch bootstrap={bootstrap} />
					<Typography variant="h5" Element="h1">
						Catalogue
					</Typography>
					<Typography variant="body2" color="secondary">
						Source de vérité : menu Colossal (`fetchmenu`). Les articles absents
						du POS sont archivés à la sync.
					</Typography>
					{error ? <Typography color="error">{error}</Typography> : null}
					{canEdit ? (
						<Button
							variant="contained"
							color="primary"
							disabled={busy}
							onClick={() => void syncMenu()}
						>
							Synchroniser depuis le POS
						</Button>
					) : (
						<Typography color="secondary">
							Lecture seule — rôle admin requis pour synchroniser.
						</Typography>
					)}
					<div className="grid gap-3 md:grid-cols-2">
						{(data?.catalog?.products ?? []).map((product) => (
							<Paper key={product.id} variant="outlined" className="p-4">
								<Stack
									direction="row"
									justifyContent="space-between"
									alignItems="flex-start"
								>
									<div>
										<Typography variant="subtitle1">{product.name}</Typography>
										<Typography variant="body2" color="secondary">
											{product.description}
										</Typography>
									</div>
									<Stack direction="row" spacing={0.5}>
										{product.variants.some((variant) => variant.sku) ? (
											<Chip size="small" label="POS" color="primary" />
										) : null}
										{product.description === "Option POS" ? (
											<Chip size="small" label="Option" />
										) : null}
										{!product.isActive ? (
											<Chip size="small" label="Archivé" />
										) : null}
									</Stack>
								</Stack>
								<Stack spacing={0.5} className="mt-2">
									{product.variants.map((variant) => (
										<Typography key={variant.id} variant="body2">
											{variant.name} · {formatCad(variant.priceCents)}
										</Typography>
									))}
								</Stack>
								{product.variants[0]?.sku ? (
									<Typography variant="caption" color="secondary">
										id POS {product.variants[0].sku}
									</Typography>
								) : null}
							</Paper>
						))}
					</div>
				</Stack>
			) : null}
		</AdminPageFrame>
	);
}
