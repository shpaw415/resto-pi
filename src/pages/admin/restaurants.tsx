"use dynamic";

import { GET as geocodeAddress } from "@api/private/admin/geocode";
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
import { AdminPageHeader } from "../../components/admin/page-header";
import { AdminPageFrame } from "../../components/admin/page-frame";
import type { AdminBootstrap } from "../../lib/admin/load";
import { loadAdminBootstrap } from "../../lib/admin/load";
import { canEditRestaurant, canManageRestaurants } from "../../lib/auth/roles";
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

type RestaurantRow = AdminBootstrap["restaurants"][number];

const emptyForm = {
	id: "",
	name: "",
	slug: "",
	address: "",
	phone: "",
	lat: "",
	lng: "",
	isActive: true,
};

export default function RestaurantsPage() {
	const data = useLoader(loader_restaurants);
	const bootstrap = data?.bootstrap;
	const canCreate = canManageRestaurants(bootstrap?.identity.parsed ?? null);
	const [form, setForm] = useState(emptyForm);
	const [error, setError] = useState<string | null>(null);
	const [geoLabel, setGeoLabel] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [geoBusy, setGeoBusy] = useState(false);
	const editing = Boolean(form.id);

	function setField(key: keyof typeof emptyForm, value: string | boolean) {
		setForm((current) => ({ ...current, [key]: value }));
	}

	function startEdit(row: RestaurantRow) {
		setError(null);
		setGeoLabel(null);
		setForm({
			id: row.id,
			name: row.name,
			slug: row.slug,
			address: row.address ?? "",
			phone: row.phone ?? "",
			lat: row.lat == null ? "" : String(row.lat),
			lng: row.lng == null ? "" : String(row.lng),
			isActive: row.isActive,
		});
	}

	async function submit() {
		setBusy(true);
		setError(null);
		const lat = form.lat.trim() === "" ? null : Number(form.lat);
		const lng = form.lng.trim() === "" ? null : Number(form.lng);
		if (
			(lat != null && !Number.isFinite(lat)) ||
			(lng != null && !Number.isFinite(lng))
		) {
			setBusy(false);
			setError("Latitude / longitude invalides.");
			return;
		}
		const result = await saveRestaurant({
			id: form.id || undefined,
			name: form.name,
			slug: form.slug || slugify(form.name),
			address: form.address,
			phone: form.phone,
			lat,
			lng,
			isActive: form.isActive,
		});
		setBusy(false);
		if (!result.ok) {
			setError(result.error);
			return;
		}
		window.location.reload();
	}

	async function convertAddress() {
		setGeoBusy(true);
		setError(null);
		setGeoLabel(null);
		const result = await geocodeAddress(form.address);
		setGeoBusy(false);
		if (!result.ok) {
			setError(result.error);
			return;
		}
		setField("lat", String(result.lat));
		setField("lng", String(result.lng));
		setGeoLabel(result.label);
	}

	return (
		<AdminPageFrame bootstrap={bootstrap}>
			{bootstrap ? (
				<Stack spacing={3}>
					<AdminPageHeader
						title="Restaurants"
						subtitle="Modifie un établissement existant. Le slug sert de préfixe de rôle OpenAuthster."
					/>
					{error ? <Typography color="error">{error}</Typography> : null}
					{canCreate || editing ? (
						<Paper elevation={1} className="p-5">
							<Stack spacing={2}>
								<Typography variant="subtitle1">
									{editing ? "Modifier l’établissement" : "Nouvel établissement"}
								</Typography>
								<TextField
									label="Nom"
									value={form.name}
									onChange={(event) => {
										const value = (event.target as HTMLInputElement).value;
										setField("name", value);
										if (!editing && !form.slug) {
											setField("slug", slugify(value));
										}
									}}
								/>
								<TextField
									label="Identifiant (slug / préfixe rôle)"
									value={form.slug}
									disabled={editing && !canCreate}
									onChange={(event) =>
										setField(
											"slug",
											slugify((event.target as HTMLInputElement).value),
										)
									}
								/>
								<TextField
									label="Adresse"
									value={form.address}
									onChange={(event) =>
										setField("address", (event.target as HTMLInputElement).value)
									}
								/>
								<TextField
									label="Téléphone"
									value={form.phone}
									onChange={(event) =>
										setField("phone", (event.target as HTMLInputElement).value)
									}
								/>
								<Button
									variant="outlined"
									disabled={geoBusy || !form.address.trim()}
									onClick={() => void convertAddress()}
								>
									{geoBusy
										? "Conversion…"
										: "Convertir l’adresse en lat / lng"}
								</Button>
								{geoLabel ? (
									<Typography variant="caption" color="secondary">
										Correspondance OSM : {geoLabel}
									</Typography>
								) : null}
								<div className="grid gap-3 sm:grid-cols-2">
									<TextField
										label="Latitude (carte)"
										value={form.lat}
										onChange={(event) =>
											setField("lat", (event.target as HTMLInputElement).value)
										}
									/>
									<TextField
										label="Longitude (carte)"
										value={form.lng}
										onChange={(event) =>
											setField("lng", (event.target as HTMLInputElement).value)
										}
									/>
								</div>
								<Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
									<Button
										variant="contained"
										color="primary"
										disabled={busy}
										onClick={() => void submit()}
									>
										{editing ? "Enregistrer" : "Créer"}
									</Button>
									{editing ? (
										<Button
											variant="text"
											onClick={() => {
												setForm(emptyForm);
												setError(null);
												setGeoLabel(null);
											}}
										>
											Annuler
										</Button>
									) : null}
								</Stack>
							</Stack>
						</Paper>
					) : (
						<Typography color="secondary">
							Seul un admin d’établissement peut modifier sa fiche.
						</Typography>
					)}
					<Stack spacing={1.5}>
						{bootstrap.restaurants.map((row) => {
							const editable = canEditRestaurant(
								bootstrap.identity.parsed,
								row.slug,
							);
							return (
								<Paper key={row.id} elevation={1} className="p-4">
									<Stack
										direction="row"
										justifyContent="space-between"
										alignItems="flex-start"
										flexWrap="wrap"
										useFlexGap
										spacing={2}
									>
										<div>
											<Typography variant="subtitle1">{row.name}</Typography>
											<Typography variant="body2" color="secondary">
												{row.slug}:admin · {row.slug}:user · {row.slug}:courier
											</Typography>
											{row.address ? (
												<Typography variant="body2">{row.address}</Typography>
											) : null}
											<Typography variant="caption" color="secondary">
												{row.lat != null && row.lng != null
													? `${row.lat.toFixed(5)}, ${row.lng.toFixed(5)}`
													: "Pas de coordonnées carte"}
											</Typography>
											{row.phone ? (
												<Typography variant="caption" color="secondary">
													{row.phone}
												</Typography>
											) : null}
										</div>
										<Stack direction="row" spacing={1} alignItems="center">
											<Chip
												size="small"
												label={row.isActive ? "Actif" : "Inactif"}
												color={row.isActive ? "primary" : "secondary"}
											/>
											{editable ? (
												<Button
													size="small"
													variant="outlined"
													onClick={() => startEdit(row)}
												>
													Modifier
												</Button>
											) : null}
										</Stack>
									</Stack>
								</Paper>
							);
						})}
					</Stack>
				</Stack>
			) : null}
		</AdminPageFrame>
	);
}
