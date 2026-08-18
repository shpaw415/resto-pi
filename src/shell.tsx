import CssBaseline from "@shpaw415/mui-lite/CssBaseline";
import type { JSX } from "react";
import { APP_DATA } from "./common";
import {
	ColorModeProvider,
	colorModeBootstrapScript,
} from "./hooks/useColorMode";

export default function RenderShell({
	children,
	headers,
}: {
	children: React.ReactNode;
	headers?: JSX.Element[];
}) {
	return (
		<html lang="fr" suppressHydrationWarning>
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<script
					// biome-ignore lint/security/noDangerouslySetInnerHtml: FOUC-prevention bootstrap
					dangerouslySetInnerHTML={{ __html: colorModeBootstrapScript }}
				/>
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link
					rel="preconnect"
					href="https://fonts.gstatic.com"
					crossOrigin="anonymous"
				/>
				<link
					rel="stylesheet"
					href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap"
				/>
				<link rel="icon" href="/static/favicon.ico" />
				<link rel="stylesheet" href="/static/style.css" />
				{headers}
				<title>{APP_DATA.projectName}</title>
			</head>
			<body id="root">
				<ColorModeProvider>
					<CssBaseline />
					{children}
				</ColorModeProvider>
			</body>
		</html>
	);
}
