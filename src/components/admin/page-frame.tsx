import type { AdminBootstrap } from "../../lib/admin/load";
import { AdminAccessDenied, AdminLoadingState } from "./access-denied";

export function AdminPageFrame({
	bootstrap,
	children,
}: {
	bootstrap?: AdminBootstrap | null;
	children: React.ReactNode;
}) {
	if (!bootstrap) {
		return <AdminLoadingState />;
	}
	if (!bootstrap.isAdmin) {
		return <AdminAccessDenied />;
	}
	return <>{children}</>;
}
