"use dynamic";

import { DELETE as archiveProduct, POST as saveCatalog } from "@api/private/admin/catalog";
import { createLoader, createPageConfig } from "@next/ssr";
import { useLoader } from "@next/ssr/hooks";
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
import { loadCatalogPage } from "../../lib/admin/load";
import { canManageCatalog } from "../../lib/auth/roles";
import { formatCad, parsePriceToCents } from "../../lib/money";

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
	const [categoryName, setCategoryName] = useState("");
	const [productName, setProductName] = useState("");
	const [price, setPrice] = useState("");
	const [error, setError] = useState<string | null>(null);

	async function addCategory() {
		if (!bootstrap?.active) return;
		const result = await saveCatalog("category", {
			restaurantId: bootstrap.active.id,
			name: categoryName,
		});
		if (!result.ok) {
			setError(result.error);
			return;
		}
		window.location.reload();
	}

	async function addProduct() {
		if (!bootstrap?.active) return;
		const cents = parsePriceToCents(price);
		if (cents == null) {
			setError("Prix invalide.");
			return;
		}
		const categoryId = data?.catalog?.categories[0]?.id ?? null;
		const result = await saveCatalog("product", {
			restaurantId: bootstrap.active.id,
			categoryId,
			name: productName,
			variants: [{ name: "Standard", priceCents: cents }],
		});
		if (!result.ok) {
			setError(result.error);
			return;
		}
		window.location.reload();
	}

	async function removeProduct(id: string) {
		if (!bootstrap?.active) return;
		await archiveProduct(bootstrap.active.id, id);
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
					{error ? <Typography color="error">{error}</Typography> : null}
					{canEdit ? (
						<Paper variant="outlined" className="p-4">
							<Stack spacing={2}>
								<Typography variant="subtitle1">Nouvelle catégorie</Typography>
								<TextField
									label="Nom"
									value={categoryName}
									onChange={(event) =>
										setCategoryName(
											(event.target as HTMLInputElement).value,
										)
									}
								/>
								<Button variant="outlined" onClick={() => void addCategory()}>
									Ajouter la catégorie
								</Button>
								<Typography variant="subtitle1">Nouveau produit</Typography>
								<TextField
									label="Nom"
									value={productName}
									onChange={(event) =>
										setProductName((event.target as HTMLInputElement).value)
									}
								/>
								<TextField
									label="Prix (CAD)"
									value={price}
									onChange={(event) =>
										setPrice((event.target as HTMLInputElement).value)
									}
								/>
								<Button
									variant="contained"
									color="primary"
									onClick={() => void addProduct()}
								>
									Ajouter le produit
								</Button>
							</Stack>
						</Paper>
					) : (
						<Typography color="secondary">
							Lecture seule — rôle admin requis pour modifier le catalogue.
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
									{!product.isActive ? (
										<Chip size="small" label="Archivé" />
									) : null}
								</Stack>
								<Stack spacing={0.5} className="mt-2">
									{product.variants.map((variant) => (
										<Typography key={variant.id} variant="body2">
											{variant.name} · {formatCad(variant.priceCents)}
										</Typography>
									))}
								</Stack>
								{canEdit && product.isActive ? (
									<Button
										size="small"
										color="secondary"
										onClick={() => void removeProduct(product.id)}
									>
										Archiver
									</Button>
								) : null}
							</Paper>
						))}
					</div>
				</Stack>
			) : null}
		</AdminPageFrame>
	);
}
