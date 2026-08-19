"use dynamic";

import { createLoader, createPageConfig } from "@next/ssr";
import { useLoader } from "@next/ssr/hooks";
import Chip from "@shpaw415/mui-lite/Chip";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import type { CtxData } from "../../action-utils/api-types";
import { ClientNoteCard } from "../../components/ops/client-note-card";
import { loadLivreurPage } from "../../lib/admin/load";
import { canEnterCourier } from "../../lib/auth/identity";
import { formatCad } from "../../lib/money";
import { STATUS_LABELS } from "../../lib/orders/status";

export const ssr_configs = createPageConfig({
	callback() {
		return { ttl: 10 };
	},
});

export const loader_livreur_courses = createLoader({
	name: "livreur_courses",
	async callback(ctx) {
		return loadLivreurPage(
			ctx as unknown as EventContext<Env, never, CtxData>,
		);
	},
});

export default function LivreurCoursesPage() {
	const data = useLoader(loader_livreur_courses);
	if (!data) {
		return null;
	}
	if (!canEnterCourier(data.bootstrap.identity)) {
		return (
			<Paper elevation={1} className="p-5">
				<Typography>Accès livreur requis.</Typography>
			</Paper>
		);
	}

	const courses = data.courses ?? [];
	const restaurantId = data.bootstrap.active?.id;

	return (
		<Stack spacing={1.5}>
			<Typography variant="body2" color="secondary">
				Livraisons ouvertes — {data.bootstrap.active?.name ?? "restaurant"}
			</Typography>
			{courses.length === 0 ? (
				<Paper elevation={1} className="p-5">
					<Typography color="secondary">
						Aucune course en cours.
					</Typography>
				</Paper>
			) : (
				courses.map((order) => (
					<Paper key={order.id} elevation={1} className="p-4">
						<Stack spacing={0.75}>
							<Stack
								direction="row"
								justifyContent="space-between"
								alignItems="center"
							>
								<Typography variant="subtitle1">
									{order.customerName || "Sans nom"}
								</Typography>
								<Chip
									size="small"
									color="primary"
									label={STATUS_LABELS[order.status]}
								/>
							</Stack>
							{order.customerAddress ? (
								<Typography variant="body2">{order.customerAddress}</Typography>
							) : null}
							{order.customerPhone ? (
								<>
									<a href={`tel:${order.customerPhone}`} className="text-inherit">
										<Typography variant="body2" color="primary">
											{order.customerPhone}
										</Typography>
									</a>
									<ClientNoteCard
										phone={order.customerPhone}
										restaurantId={restaurantId}
										compact
									/>
								</>
							) : null}
							<Typography variant="caption" color="secondary">
								{formatCad(order.totalCents)} · {order.items.length} article
								{order.items.length > 1 ? "s" : ""}
							</Typography>
						</Stack>
					</Paper>
				))
			)}
		</Stack>
	);
}
