import { DefaultTheme, type MuiTheme } from "@shpaw415/mui-lite/theme";

export type ColorMode = "light" | "dark";

export function createAppTheme(mode: ColorMode = "light"): MuiTheme {
	return {
		...DefaultTheme,
		theme: mode,
		locale: "frFR",
		"bg-main": {
			light: "#faf7f2",
			main: "#f6f1ea",
			dark: "#161311",
		},
		"bg-surface": {
			light: "#fffdf9",
			main: "#ffffff",
			dark: "#231e1b",
		},
		"bg-primary": {
			light: "#d97706",
			main: "#b45309",
			dark: "#f59e0b",
		},
		"bg-secondary": {
			light: "#5b8a72",
			main: "#3f6b56",
			dark: "#6f9f86",
		},
		"bg-success": {
			light: "#66bb6a",
			main: "#2e7d32",
			dark: "#43a047",
		},
		"bg-error": {
			light: "#ef5350",
			main: "#d32f2f",
			dark: "#e53935",
		},
		"bg-warning": {
			light: "#ffb74d",
			main: "#ed6c02",
			dark: "#fb8c00",
		},
		"text-primary": {
			light: "#d97706",
			main: "#b45309",
			dark: "#fbbf24",
		},
		"text-secondary": {
			light: "#7a7168",
			main: "#5c534b",
			dark: "#c4b8ad",
		},
		"text-main": {
			light: "#3d342c",
			main: "#241c16",
			dark: "#fff8f1",
		},
		"text-error": {
			light: "#e57373",
			main: "#d32f2f",
			dark: "#ef9a9a",
		},
		"text-success": {
			light: "#81c784",
			main: "#2e7d32",
			dark: "#a5d6a7",
		},
		"text-warning": {
			light: "#ffb74d",
			main: "#ed6c02",
			dark: "#ffcc80",
		},
		"text-info": {
			light: "#29b6f6",
			main: "#0288d1",
			dark: "#4fc3f7",
		},
	};
}

export const theme = createAppTheme("light");
