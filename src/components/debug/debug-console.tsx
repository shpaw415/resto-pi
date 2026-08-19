import Paper from "@shpaw415/mui-lite/Paper";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";
import { subscribeDebug, type DebugLine } from "../../lib/debug/logger";

export function DebugConsole() {
	const [lines, setLines] = useState<DebugLine[]>([]);

	useEffect(() => subscribeDebug(setLines), []);

	if (lines.length === 0) {
		return null;
	}

	return (
		<Paper variant="outlined" className="max-h-48 overflow-y-auto p-3">
			<Typography variant="caption" color="secondary">
				Debug
			</Typography>
			{lines.map((line, index) => (
				<Typography
					key={`${line.at}-${index}`}
					variant="caption"
					className="block font-mono"
				>
					{line.at} [{line.scope}] {line.message}
				</Typography>
			))}
		</Paper>
	);
}
