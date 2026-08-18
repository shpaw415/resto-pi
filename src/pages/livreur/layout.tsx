import { useAuth } from "@hooks/useAuth";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Typography from "@shpaw415/mui-lite/Typography";
import { logoutClient } from "../../lib/auth/access-token-cookie";

export default function LivreurLayout({
	children,
}: {
	children: React.JSX.Element;
}) {
	const auth = useAuth();

	return (
		<div className="flex min-h-dvh flex-col">
			<Paper
				elevation={1}
				square
				className="sticky top-0 z-20 border-x-0 border-t-0"
			>
				<div className="flex min-h-14 items-center justify-between px-4">
					<div>
						<Typography variant="subtitle1">Livreur</Typography>
						<Typography variant="caption" color="secondary">
							Resto Pi — suivi GPS
						</Typography>
					</div>
					<Button
						size="small"
						variant="text"
						color="secondary"
						onClick={() => {
							logoutClient(auth);
							window.location.assign("/login");
						}}
					>
						Déconnexion
					</Button>
				</div>
			</Paper>
			<div className="flex-1 p-4">{children}</div>
		</div>
	);
}
