import { CircularProgress } from "@shpaw415/mui-lite/Progress";
import Typography from "@shpaw415/mui-lite/Typography";

export default function Loading() {
	return (
		<div className="app-loading flex min-h-dvh flex-col items-center justify-center gap-3">
			<CircularProgress color="primary" />
			<Typography variant="body2" color="secondary" className="app-loading-label">
				Chargement…
			</Typography>
		</div>
	);
}
