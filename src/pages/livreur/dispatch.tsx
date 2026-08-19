"use dynamic";

import { createLoader, createPageConfig } from "@next/ssr";
import { useLoader } from "@next/ssr/hooks";
import Paper from "@shpaw415/mui-lite/Paper";
import Typography from "@shpaw415/mui-lite/Typography";
import type { CtxData } from "../../action-utils/api-types";
import { DispatchBoard } from "../../components/dispatch/dispatch-board";
import { loadLivreurPage } from "../../lib/admin/load";
import { canEnterCourier } from "../../lib/auth/identity";

export const ssr_configs = createPageConfig({
	callback() {
		return { ttl: 10 };
	},
});

export const loader_livreur_dispatch = createLoader({
	name: "livreur_dispatch",
	async callback(ctx) {
		return loadLivreurPage(
			ctx as unknown as EventContext<Env, never, CtxData>,
		);
	},
});

export default function LivreurDispatchPage() {
	const data = useLoader(loader_livreur_dispatch);
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
	return <DispatchBoard restaurantId={data.bootstrap.active?.id} />;
}
