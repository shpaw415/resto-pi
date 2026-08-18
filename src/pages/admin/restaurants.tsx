"use dynamic";

import { POST as saveRestaurant } from "@api/private/admin/restaurants";
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
import { loadAdminBootstrap } from "../../lib/admin/load";
import { canManageRestaurants } from "../../lib/auth/roles";
import { slugify } from "../../lib/restaurants/service";

export const ssr_configs = createPageConfig({
	callback() {
		return { ttl: 20 };
	},
});

export const loader_restaurants = createLoader({
	name: "restaurants",
	async callback(ctx) {
		return {
			bootstrap: await loadAdminBootstrap(
				ctx as unknown as EventContext<Env, never, CtxData>,
			),
		};
	},
});

export default function RestaurantsPage() {
	const data = useLoader(loader_restaurants);
	const bootstrap = data?.bootstrap;
	const canEdit = canManageRestaurants(bootstrap?.identity.parsed ?? null);
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [address, setAddress] = useState("");
	const [error, setError] = useState<string | null>(null);

	async function create() {
		const result = await saveRestaurant({
			name,
			slug: slug || slugify(name),
			address,
		});
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
					<Typography variant="h5" Element="h1">
						Restaurants
					</Typography>
					<Typography variant="body2" color="secondary">
						Après création, assigne le rôle{" "}
						<code>{`{slug}:admin`}</code> ou <code>{`{slug}:user`}</code> dans
						OpenAuthster WebUI.
					</Typography>
					{error ? <Typography color="error">{error}</Typography> : null}
					{canEdit ? (
						<Paper variant="outlined" className="p-4">
							<Stack spacing={2}>
								<TextField
									label="Nom"
									value={name}
									onChange={(event) => {
										const value = (event.target as HTMLInputElement).value;
										setName(value);
										if (!slug) setSlug(slugify(value));
									}}
								/>
								<TextField
									label="Identifiant (slug / préfixe rôle)"
									value={slug}
									onChange={(event) =>
										setSlug(slugify((event.target as HTMLInputElement).value))
									}
								/>
								<TextField
									label="Adresse"
									value={address}
									onChange={(event) =>
										setAddress((event.target as HTMLInputElement).value)
									}
								/>
								<Button
									variant="contained"
									color="primary"
									onClick={() => void create()}
								>
									Créer
								</Button>
							</Stack>
						</Paper>
					) : (
						<Typography color="secondary">
							Seul <code>admin:admin</code> peut créer des restaurants.
						</Typography>
					)}
					<Stack spacing={1.5}>
						{bootstrap.restaurants.map((row) => (
							<Paper key={row.id} variant="outlined" className="p-4">
								<Stack
									direction="row"
									justifyContent="space-between"
									alignItems="center"
								>
									<div>
										<Typography variant="subtitle1">{row.name}</Typography>
										<Typography variant="body2" color="secondary">
											rôle WebUI : {row.slug}:admin / {row.slug}:user
										</Typography>
										{row.address ? (
											<Typography variant="caption">{row.address}</Typography>
										) : null}
									</div>
									<Chip
										size="small"
										label={row.isActive ? "Actif" : "Inactif"}
										color={row.isActive ? "primary" : "secondary"}
									/>
								</Stack>
							</Paper>
						))}
					</Stack>
				</Stack>
			) : null}
		</AdminPageFrame>
	);
}
