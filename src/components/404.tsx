import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Typography from "@shpaw415/mui-lite/Typography";

export default function NotFound() {
	return (
		<div className="flex min-h-dvh items-center justify-center p-6">
			<Paper className="max-w-md p-8 text-center" elevation={1}>
				<Typography variant="h4" Element="h1" gutterBottom>
					Page introuvable
				</Typography>
				<Typography variant="body2" color="secondary" className="mb-4">
					Cette adresse n’existe pas.
				</Typography>
				<a href="/" className="no-underline">
					<Button variant="contained" color="primary">
						Retour
					</Button>
				</a>
			</Paper>
		</div>
	);
}
