"use dynamic";

import { POST as transitionOrder } from "@api/private/admin/orders";
import { createLoader, createPageConfig } from "@next/ssr";
import { useLoader } from "@next/ssr/hooks";
import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { navigate } from "frame-master-plugin-apply-react/utils";
import { useState } from "react";
import type { CtxData } from "../../../action-utils/api-types";
import { AdminPageFrame } from "../../../components/admin/page-frame";
import { RestaurantSwitch } from "../../../components/admin/restaurant-switch";
import { loadOrdersPage } from "../../../lib/admin/load";
import { formatCad } from "../../../lib/money";
import {
	KITCHEN_COLUMNS,
	nextKitchenStatus,
	prevKitchenStatus,
	STATUS_LABELS,
} from "../../../lib/orders/status";

export const ssr_configs = createPageConfig({
	callback() {
		return { ttl: 10 };
	},
});

export const loader_orders_board = createLoader({
	name: "orders_board",
	async callback(ctx) {
		return loadOrdersPage(
			ctx as unknown as EventContext<Env, never, CtxData>,
		);
	},
});

export default function OrdersBoardPage() {
	const data = useLoader(loader_orders_board);
	const bootstrap = data?.bootstrap;
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function move(orderId: string, direction: "next" | "prev") {
		if (!bootstrap?.active) {
			return;
		}
		setBusy(orderId);
		setError(null);
		const result = await transitionOrder(
			bootstrap.active.id,
			orderId,
			direction,
		);
		setBusy(null);
		if (!result || !("ok" in result) || !result.ok) {
			setError(
				result && "error" in result
					? String(result.error)
					: "Transition impossible",
			);
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
						Commandes
					</Typography>
					{error ? (
						<Typography color="error">{error}</Typography>
					) : null}
					<div className="grid grid-cols-1 gap-3 md:grid-cols-5">
						{KITCHEN_COLUMNS.map((status) => {
							const column = (data?.orders ?? []).filter(
								(order) => order.status === status,
							);
							return (
								<Paper key={status} variant="outlined" className="p-3">
									<Typography variant="subtitle2" className="mb-2">
										{STATUS_LABELS[status]} ({column.length})
									</Typography>
									<Stack spacing={1.5}>
										{column.map((order) => (
											<Paper key={order.id} className="p-3" elevation={1}>
												<Typography variant="subtitle2">
													{order.customerName || "Sans nom"}
												</Typography>
												<Typography variant="caption" color="secondary">
													{formatCad(order.totalCents)} · {order.type}
												</Typography>
												<div className="mt-2 flex flex-wrap gap-1">
													<Chip
														size="small"
														label={order.source}
														variant="outlined"
													/>
												</div>
												<Stack direction="row" spacing={1} className="mt-2">
													{prevKitchenStatus(order.status) ? (
														<Button
															size="small"
															variant="outlined"
															disabled={busy === order.id}
															onClick={() => void move(order.id, "prev")}
														>
															Retour
														</Button>
													) : null}
													{nextKitchenStatus(order.status) ? (
														<Button
															size="small"
															variant="contained"
															color="primary"
															disabled={busy === order.id}
															onClick={() => void move(order.id, "next")}
														>
															Suivant
														</Button>
													) : null}
												</Stack>
												<Button
													size="small"
													variant="text"
													onClick={() =>
														navigate(`/admin/commandes/${order.id}`)
													}
												>
													Détail
												</Button>
											</Paper>
										))}
									</Stack>
								</Paper>
							);
						})}
					</div>
				</Stack>
			) : null}
		</AdminPageFrame>
	);
}
