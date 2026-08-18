import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { navigate } from "frame-master-plugin-apply-react/utils";

export function AdminAccessDenied() {
	return (
		<Paper elevation={1} className="p-8 text-center sm:p-10">
			<Typography variant="overline" color="secondary">
				Accès restreint
			</Typography>
			<Typography variant="h5" Element="h1" className="mt-2" gutterBottom>
				Rôle restaurant requis
			</Typography>
			<Typography
				variant="body2"
				color="secondary"
				className="mx-auto max-w-md"
			>
				Assigne un rôle dans OpenAuthster WebUI (
				<code>admin:admin</code>, <code>slug:admin</code> ou{" "}
				<code>slug:user</code>) puis reconnecte-toi.
			</Typography>
			<Stack
				direction="row"
				spacing={1.5}
				justifyContent="center"
				className="mt-6"
				flexWrap="wrap"
				useFlexGap
			>
				<Button
					variant="contained"
					color="primary"
					onClick={() => navigate("/login")}
				>
					Connexion
				</Button>
			</Stack>
		</Paper>
	);
}

export function AdminLoadingState() {
	return (
		<Paper elevation={0} variant="outlined" className="p-10 text-center">
			<Typography variant="body2" color="secondary">
				Chargement…
			</Typography>
		</Paper>
	);
}
