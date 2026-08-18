import Select from "@shpaw415/mui-lite/Select";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { RESTAURANT_COOKIE } from "../../common";
import type { AdminBootstrap } from "../../lib/admin/load";

function option(value: string, label: string) {
	return (
		<span key={value} {...{ value }}>
			{label}
		</span>
	);
}

export function RestaurantSwitch({
	bootstrap,
}: {
	bootstrap: AdminBootstrap;
}) {
	if (!bootstrap.active) {
		return (
			<Typography variant="body2" color="secondary">
				Aucun restaurant. Crée-en un ou assigne un rôle{" "}
				<code>slug:admin</code> dans la WebUI.
			</Typography>
		);
	}

	if (bootstrap.restaurants.length <= 1) {
		return (
			<Typography variant="subtitle1" Element="p">
				{bootstrap.active.name}
			</Typography>
		);
	}

	return (
		<Stack spacing={1} className="max-w-sm">
			<Typography variant="caption" color="secondary">
				Restaurant actif
			</Typography>
			<Select
				name="restaurant"
				label="Restaurant"
				value={bootstrap.active.slug}
				onSelect={(value) => {
					const slug = String(value);
					if (!slug) {
						return;
					}
					document.cookie = `${RESTAURANT_COOKIE}=${encodeURIComponent(slug)}; path=/; samesite=lax`;
					window.location.reload();
				}}
			>
				{bootstrap.restaurants.map((row) => option(row.slug, row.name))}
			</Select>
		</Stack>
	);
}
