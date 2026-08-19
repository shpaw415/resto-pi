"use dynamic";

import { createLoader, createPageConfig } from "@next/ssr";
import { useLoader } from "@next/ssr/hooks";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import type { CtxData } from "../../action-utils/api-types";
import { ClientNoteCard } from "../../components/ops/client-note-card";
import { StaffCourierChat } from "../../components/ops/staff-courier-chat";
import { loadLivreurPage } from "../../lib/admin/load";
import { canEnterCourier } from "../../lib/auth/identity";

export const ssr_configs = createPageConfig({
	callback() {
		return { ttl: 10 };
	},
});

export const loader_livreur_messages = createLoader({
	name: "livreur_messages",
	async callback(ctx) {
		return loadLivreurPage(
			ctx as unknown as EventContext<Env, never, CtxData>,
		);
	},
});

export default function LivreurMessagesPage() {
	const data = useLoader(loader_livreur_messages);
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

	const restaurantId = data.bootstrap.active?.id;

	return (
		<Stack spacing={2}>
			<StaffCourierChat restaurantId={restaurantId} selfKind="courier" />
			<ClientNoteCard restaurantId={restaurantId} />
		</Stack>
	);
}
