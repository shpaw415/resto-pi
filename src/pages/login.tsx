import { useAuth, useAuthSession } from "@hooks/useAuth";
import FingerprintIcon from "@material-design-icons/svg/filled/fingerprint.svg";
import LockIcon from "@material-design-icons/svg/filled/lock.svg";
import Alert from "@shpaw415/mui-lite/Alert";
import Box from "@shpaw415/mui-lite/Box";
import Button from "@shpaw415/mui-lite/Button";
import Divider from "@shpaw415/mui-lite/Divider";
import Paper from "@shpaw415/mui-lite/Paper";
import { CircularProgress } from "@shpaw415/mui-lite/Progress";
import Typography from "@shpaw415/mui-lite/Typography";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { syncAccessTokenCookie } from "../lib/auth/access-token-cookie";
import { postAuthHomePath, resolveUserIdentity } from "../lib/auth/identity";
import { parseIssuerRole } from "../lib/auth/roles";

type ProviderId = "google" | "passkey" | "password";

function GoogleGlyph({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			width="20"
			height="20"
			viewBox="0 0 24 24"
			aria-hidden
		>
			<title>Google</title>
			<path
				fill="#4285F4"
				d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
			/>
			<path
				fill="#34A853"
				d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
			/>
			<path
				fill="#FBBC05"
				d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
			/>
			<path
				fill="#EA4335"
				d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
			/>
		</svg>
	);
}

export default function LoginPage() {
	const auth = useAuth();
	const session = useAuthSession();
	const [busy, setBusy] = useState<ProviderId | null>(null);
	const [error, setError] = useState<string | null>(null);

	const busySetter = useCallback((provider: ProviderId | null) => {
		setBusy(provider);
		if (provider === null) {
			setError(null);
		}
		setTimeout(() => {
			setBusy(null);
		}, 5000);
	}, []);

	useEffect(() => {
		const parsed = parseIssuerRole(session.data?.role);
		if (!parsed) {
			return;
		}
		if (parsed.permission === "courier") {
			window.location.assign("/livreur");
			return;
		}
		if (parsed.permission === "admin" || parsed.permission === "user") {
			window.location.assign("/admin");
		}
	}, [session.data?.role]);

	async function startProvider(provider: ProviderId) {
		if (!auth) {
			setError("Authentification indisponible.");
			return;
		}
		busySetter(provider);
		setError(null);
		try {
			if (provider === "passkey") {
				await auth.passkey.login();
				const token = (auth as { getToken?: () => string | null }).getToken?.();
				if (token) {
					syncAccessTokenCookie(token);
				}
				const identity = await resolveUserIdentity(auth);
				window.location.assign(postAuthHomePath(identity));
				return;
			}
			await auth.login({
				autoNavigate: true,
				provider,
				copyID: "fr_CA",
			});
		} catch (caught) {
			setError(
				caught instanceof Error
					? caught.message
					: "Impossible de démarrer l’authentification.",
			);
			busySetter(null);
		}
	}

	const providers: Array<{
		id: ProviderId;
		label: string;
		icon: ReactNode;
		variant: "contained" | "outlined";
		color?: "primary";
	}> = [
		{
			id: "google",
			label: "Continuer avec Google",
			icon: <GoogleGlyph />,
			variant: "outlined",
		},
		{
			id: "passkey",
			label: "Continuer avec une passkey",
			icon: (
				<FingerprintIcon className="h-5 w-5" style={{ fill: "currentColor" }} />
			),
			variant: "outlined",
		},
		{
			id: "password",
			label: "Continuer avec un e-mail",
			icon: <LockIcon className="h-5 w-5" style={{ fill: "currentColor" }} />,
			variant: "contained",
			color: "primary",
		},
	];

	return (
		<Box className="flex min-h-dvh w-full items-center justify-center px-4 py-10">
			<Paper className="w-full max-w-md pb-6" elevation={2}>
				<Box className="px-6 py-6 sm:px-8">
					<Typography
						variant="h5"
						Element="h1"
						align="center"
						sx={{ fontWeight: 500 }}
					>
						Resto Pi
					</Typography>
					<Typography
						Element="p"
						align="center"
						className="mt-2"
						sx={{ color: "rgb(var(--text-secondary))" }}
					>
						Connexion personnel restaurant
					</Typography>
				</Box>
				<div className="flex flex-col gap-3.5 px-6 sm:px-8">
					{error ? (
						<Alert severity="error" variant="outlined">
							{error}
						</Alert>
					) : null}
					{providers.map((provider, index) => (
						<div key={provider.id}>
							{index === providers.length - 1 ? (
								<div className="mb-3.5 mt-1">
									<Divider />
								</div>
							) : null}
							<Button
								variant={provider.variant}
								color={provider.color}
								fullWidth
								size="large"
								disabled={busy !== null}
								onClick={() => void startProvider(provider.id)}
								startIcon={busy === provider.id ? undefined : provider.icon}
							>
								{busy === provider.id ? (
									<CircularProgress size="20px" color="primary" />
								) : (
									provider.label
								)}
							</Button>
						</div>
					))}
				</div>
			</Paper>
		</Box>
	);
}
