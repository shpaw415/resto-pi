import { useAuth, useAuthSession } from "@hooks/useAuth";
import { CircularProgress } from "@shpaw415/mui-lite/Progress";
import Typography from "@shpaw415/mui-lite/Typography";
import { navigate } from "frame-master-plugin-apply-react/utils";
import { useEffect } from "react";
import { parseIssuerRole } from "../lib/auth/roles";

export default function HomePage() {
	const auth = useAuth();
	const session = useAuthSession();

	const onRedirect = (client?: typeof auth) => {
		if (!auth?.isLoaded) {
			return;
		}
		const parsed = parseIssuerRole(session.data?.role);
		if (parsed?.permission === "courier") {
			navigate("/livreur");
			return;
		}
		if (
			parsed &&
			(parsed.permission === "admin" || parsed.permission === "user")
		) {
			navigate("/admin");
			return;
		}
		navigate("/login");
	};

	auth?.addInitializationListener("redirect", (client) => {
		onRedirect(client);
	});

	useEffect(() => {
		onRedirect(auth);
	}, [auth?.isLoaded, session.data?.role]);

	return (
		<div className="flex min-h-dvh flex-col items-center justify-center gap-3">
			<CircularProgress color="primary" />
			<Typography variant="body2" color="secondary">
				Redirection…
			</Typography>
		</div>
	);
}
