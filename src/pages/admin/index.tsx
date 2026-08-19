"use dynamic";

import { createLoader, createPageConfig } from "@next/ssr";
import { useLoader } from "@next/ssr/hooks";
import Chip from "@shpaw415/mui-lite/Chip";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import type { CtxData } from "../../action-utils/api-types";
import { ColossalConnectionCard } from "../../components/admin/colossal-connection";
import { AdminPageHeader } from "../../components/admin/page-header";
import { AdminPageFrame } from "../../components/admin/page-frame";
import { RestaurantSwitch } from "../../components/admin/restaurant-switch";
import { loadDashboard } from "../../lib/admin/load";
import { canManagePos } from "../../lib/auth/roles";
import { formatCad } from "../../lib/money";
import { STATUS_LABELS } from "../../lib/orders/status";

export const ssr_configs = createPageConfig({
	callback() {
		return { ttl: 15 };
	},
});

export const loader_admin_home = createLoader({
	name: "admin_home",
	async callback(ctx) {
		return loadDashboard(ctx as unknown as EventContext<Env, never, CtxData>);
	},
});

export default function AdminHomePage() {
	const data = useLoader(loader_admin_home);
	const bootstrap = data?.bootstrap;

	return (
		<AdminPageFrame bootstrap={bootstrap}>
			{bootstrap ? (
				<Stack spacing={3}>
					<AdminPageHeader
						title="Tableau de bord"
						subtitle="Commandes du jour et connexion Colossal de l’établissement actif."
					/>
					<RestaurantSwitch bootstrap={bootstrap} />
					{data?.counts ? (
						<div className="grid grid-cols-2 gap-3 md:grid-cols-5">
							{(
								[
									"en_attente",
									"peut_preparer",
									"en_preparation",
									"pret",
									"termine",
								] as const
							).map((status) => (
								<Paper key={status} className="p-4" elevation={1}>
									<Typography variant="caption" color="secondary">
										{STATUS_LABELS[status]}
									</Typography>
									<Typography variant="h4" Element="p">
										{data.counts?.[status] ?? 0}
									</Typography>
								</Paper>
							))}
						</div>
					) : (
						<Typography color="secondary">
							Crée un restaurant puis importe des commandes (POS) ou utilise
							l’API.
						</Typography>
					)}
					{bootstrap.active ? (
						<ColossalConnectionCard
							restaurantId={bootstrap.active.id}
							restaurantName={bootstrap.active.name}
							connection={data?.connection ?? null}
							canEdit={canManagePos(bootstrap.identity.parsed)}
						/>
					) : null}
					<Stack spacing={1.5}>
						<Typography variant="h6" Element="h2">
							Dernières commandes
						</Typography>
						{(data?.recent ?? []).map((order) => (
							<Paper key={order.id} elevation={1} className="p-3">
								<Stack
									direction="row"
									justifyContent="space-between"
									alignItems="center"
									flexWrap="wrap"
									useFlexGap
									spacing={1}
								>
									<div>
										<Typography variant="subtitle2">
											{order.customerName || "Sans nom"} · {order.type}
										</Typography>
										<Typography variant="caption" color="secondary">
											{formatCad(order.totalCents)} · {order.source}
										</Typography>
									</div>
									<Chip
										label={STATUS_LABELS[order.status]}
										size="small"
										color="primary"
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
