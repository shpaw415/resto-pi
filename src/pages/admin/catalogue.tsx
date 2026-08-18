"use dynamic";

import { POST as posAction } from "@api/private/admin/pos";
import { createLoader, createPageConfig } from "@next/ssr";
import { useLoader } from "@next/ssr/hooks";
import Button from "@shpaw415/mui-lite/Button";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useMemo, useState } from "react";
import type { CtxData } from "../../action-utils/api-types";
import {
	type CatalogTableRow,
	CatalogTable,
} from "../../components/admin/catalog-table";
import { AdminPageFrame } from "../../components/admin/page-frame";
import { RestaurantSwitch } from "../../components/admin/restaurant-switch";
import { loadCatalogPage } from "../../lib/admin/load";
import { canManageCatalog } from "../../lib/auth/roles";

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

	const categoryNames = useMemo(
		() =>
			(data?.catalog?.categories ?? [])
				.map((category) => category.name)
				.filter(Boolean),
		[data?.catalog?.categories],
	);

	const rows = useMemo<CatalogTableRow[]>(() => {
		const categories = new Map(
			(data?.catalog?.categories ?? []).map((category) => [
				category.id,
				category.name,
			]),
		);
		return (data?.catalog?.products ?? []).map((product) => {
			const delivery = product.variants.find(
				(variant) => variant.name === "Livraison",
			);
			const takeout = product.variants.find(
				(variant) => variant.name === "Emporter",
			);
			return {
				id: product.id,
				name: product.name,
				category: (product.categoryId && categories.get(product.categoryId)) || "—",
				kind: product.description === "Option POS" ? "option" : "item",
				sku: product.variants.find((variant) => variant.sku)?.sku ?? "",
				deliveryCents: delivery?.priceCents ?? null,
				takeoutCents: takeout?.priceCents ?? product.variants[0]?.priceCents ?? null,
				isActive: product.isActive,
			};
		});
	}, [data?.catalog]);

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
					<Stack
						direction="row"
						justifyContent="space-between"
						alignItems="center"
						flexWrap="wrap"
						useFlexGap
						spacing={1}
					>
						<div>
							<Typography variant="h5" Element="h1">
								Catalogue
							</Typography>
							<Typography variant="body2" color="secondary">
								Source de vérité : menu Colossal. Filtre, trie et paginé.
							</Typography>
						</div>
						{canEdit ? (
							<Button
								variant="contained"
								color="primary"
								disabled={busy}
								onClick={() => void syncMenu()}
							>
								Synchroniser depuis le POS
							</Button>
						) : null}
					</Stack>
					{error ? <Typography color="error">{error}</Typography> : null}
					<CatalogTable rows={rows} categories={categoryNames} />
				</Stack>
			) : null}
		</AdminPageFrame>
	);
}
