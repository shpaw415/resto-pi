"use dynamic";

import { createLoader, createPageConfig } from "@next/ssr";
import { useLoader } from "@next/ssr/hooks";
import type { CtxData } from "../../action-utils/api-types";
import { AdminPageFrame } from "../../components/admin/page-frame";
import { DispatchBoard } from "../../components/dispatch/dispatch-board";
import { loadAdminBootstrap } from "../../lib/admin/load";

export const ssr_configs = createPageConfig({
	callback() {
		return { ttl: 10 };
	},
});

export const loader_dispatch = createLoader({
	name: "dispatch",
	async callback(ctx) {
		return {
			bootstrap: await loadAdminBootstrap(
				ctx as unknown as EventContext<Env, never, CtxData>,
			),
		};
	},
});

export default function DispatchPage() {
	const data = useLoader(loader_dispatch);
	return (
		<AdminPageFrame bootstrap={data?.bootstrap}>
			<DispatchBoard restaurantId={data?.bootstrap.active?.id} />
		</AdminPageFrame>
	);
}
