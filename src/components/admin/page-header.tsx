import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";

export function AdminPageHeader({
	title,
	subtitle,
	action,
}: {
	title: string;
	subtitle?: string;
	action?: React.ReactNode;
}) {
	return (
		<Stack
			direction="row"
			justifyContent="space-between"
			alignItems="flex-start"
			flexWrap="wrap"
			useFlexGap
			spacing={2}
			className="mb-1"
		>
			<div>
				<Typography variant="h5" Element="h1">
					{title}
				</Typography>
				{subtitle ? (
					<Typography variant="body2" color="secondary" className="mt-1">
						{subtitle}
					</Typography>
				) : null}
			</div>
			{action}
		</Stack>
	);
}
