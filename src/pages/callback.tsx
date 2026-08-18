import { useAuth } from "@hooks/useAuth";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import { CircularProgress } from "@shpaw415/mui-lite/Progress";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { navigate } from "frame-master-plugin-apply-react/utils";
import { useEffect, useState } from "react";
import { syncAccessTokenCookie } from "../lib/auth/access-token-cookie";
import { postAuthHomePath, resolveUserIdentity } from "../lib/auth/identity";

export default function AuthCallbackPage() {
	const auth = useAuth();
	const [error, setError] = useState<string | null>(null);
	const [done, setDone] = useState(false);

	useEffect(() => {
		if (!auth || done) {
			return;
		}
		let cancelled = false;
		async function complete() {
			try {
				await auth!.callback();
				if (cancelled) {
					return;
				}
				const token = (auth as { getToken?: () => string | null }).getToken?.();
				if (token) {
					syncAccessTokenCookie(token);
				}
				const identity = await resolveUserIdentity(auth!);
				if (cancelled) {
					return;
				}
				setDone(true);
				navigate(postAuthHomePath(identity));
			} catch (caught) {
				if (cancelled) {
					return;
				}
				setError(
					caught instanceof Error
						? caught.message
						: "Impossible de terminer la connexion.",
				);
			}
		}
		void complete();
		return () => {
			cancelled = true;
		};
	}, [auth, done]);

	if (error) {
		return (
			<Paper elevation={1} className="mx-auto mt-10 max-w-md p-6 text-center">
				<Typography variant="h6" Element="h1" gutterBottom>
					Connexion impossible
				</Typography>
				<Typography variant="body2" color="secondary" className="mb-4">
					{error}
				</Typography>
				<Stack direction="row" spacing={1} justifyContent="center">
					<Button
						variant="contained"
						color="primary"
						onClick={() => navigate("/login")}
					>
						Retour à la connexion
					</Button>
				</Stack>
			</Paper>
		);
	}

	return (
		<Paper elevation={1} className="mx-auto mt-10 max-w-md p-8 text-center">
			<div className="mb-4 flex justify-center">
				<CircularProgress color="primary" />
			</div>
			<Typography variant="h6" Element="h1" gutterBottom>
				Connexion en cours…
			</Typography>
		</Paper>
	);
}
