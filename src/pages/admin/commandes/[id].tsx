"use dynamic";

import { createLoader, createPageConfig } from "@next/ssr";
import { useLoader } from "@next/ssr/hooks";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { navigate } from "frame-master-plugin-apply-react/utils";
import type { CtxData } from "../../../action-utils/api-types";
import { AdminPageFrame } from "../../../components/admin/page-frame";
import { ClientNoteCard } from "../../../components/ops/client-note-card";
import { loadAdminBootstrap } from "../../../lib/admin/load";
import { formatCad } from "../../../lib/money";
import { getOrderById } from "../../../lib/orders/service";
import { STATUS_LABELS } from "../../../lib/orders/status";

export const ssr_configs = createPageConfig({
	callback() {
		return { ttl: 10 };
	},
});

export const loader_order_detail = createLoader({
	name: "order_detail",
	async callback(ctx) {
		const bootstrap = await loadAdminBootstrap(
			ctx as unknown as EventContext<Env, never, CtxData>,
		);
		const id = Array.isArray(ctx.params.id)
			? ctx.params.id[0]
			: ctx.params.id;
		if (!bootstrap.active || !id) {
			return { bootstrap, order: null };
		}
		const order = await getOrderById(
			ctx as unknown as EventContext<Env, never, CtxData>,
			id,
			bootstrap.active.id,
		);
		return { bootstrap, order };
	},
});

export default function OrderDetailPage() {
	const data = useLoader(loader_order_detail);
	const order =
		data?.order && !("ok" in data.order && data.order.ok === false)
			? data.order
			: null;

	return (
		<AdminPageFrame bootstrap={data?.bootstrap}>
			<Stack spacing={2}>
				<Button variant="text" onClick={() => navigate("/admin/commandes")}>
					← Commandes
				</Button>
				{order && "id" in order ? (
					<>
						<Typography variant="h5" Element="h1">
							{order.customerName || "Commande"}
						</Typography>
						<Typography color="secondary">
							{STATUS_LABELS[order.status]} · {order.type} ·{" "}
							{formatCad(order.totalCents)}
						</Typography>
						{order.customerAddress ? (
							<Typography variant="body2">{order.customerAddress}</Typography>
						) : null}
						{order.customerPhone ? (
							<ClientNoteCard
								phone={order.customerPhone}
								restaurantId={data?.bootstrap.active?.id}
							/>
						) : (
							<ClientNoteCard restaurantId={data?.bootstrap.active?.id} />
						)}
						<Stack spacing={1}>
							{order.items.map((item) => (
								<Paper key={item.id} variant="outlined" className="p-3">
									<Typography>
										{item.quantity} × {item.nameSnapshot}
									</Typography>
									<Typography variant="caption" color="secondary">
										{formatCad(item.unitPriceCents)}
									</Typography>
								</Paper>
							))}
						</Stack>
						<Typography variant="subtitle2">Historique</Typography>
						{(order.events ?? []).map((event) => (
							<Typography key={event.id} variant="body2" color="secondary">
								{event.fromStatus
									? `${STATUS_LABELS[event.fromStatus]} → `
									: ""}
								{STATUS_LABELS[event.toStatus]} · {event.actorLabel}
							</Typography>
						))}
					</>
				) : (
					<Typography>Commande introuvable.</Typography>
				)}
			</Stack>
		</AdminPageFrame>
	);
}
