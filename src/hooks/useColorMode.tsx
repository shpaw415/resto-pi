import { ThemeProvider } from "@shpaw415/mui-lite/theme";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useLayoutEffect,
	useMemo,
	useState,
} from "react";
import { type ColorMode, createAppTheme } from "../lib/theme";

export const COLOR_MODE_STORAGE_KEY = "resto-pi-color-mode";

type ColorModeContextValue = {
	mode: ColorMode;
	setMode: (mode: ColorMode) => void;
	toggleMode: () => void;
	isDark: boolean;
};

const ColorModeContext = createContext<ColorModeContextValue | null>(null);

function readStoredMode(): ColorMode {
	if (typeof window === "undefined") {
		return "light";
	}
	try {
		const stored = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);
		if (stored === "dark" || stored === "light") {
			return stored;
		}
	} catch {
		// ignore
	}
	if (
		window.matchMedia &&
		window.matchMedia("(prefers-color-scheme: dark)").matches
	) {
		return "dark";
	}
	return "light";
}

function getInitialMode(): ColorMode {
	if (typeof document !== "undefined") {
		const fromDom = document.documentElement.dataset.theme;
		if (fromDom === "dark" || fromDom === "light") {
			return fromDom;
		}
	}
	if (typeof window !== "undefined") {
		return readStoredMode();
	}
	return "light";
}

function applyDocumentMode(mode: ColorMode) {
	if (typeof document === "undefined") {
		return;
	}
	const root = document.documentElement;
	root.dataset.theme = mode;
	root.style.colorScheme = mode;
}

export const colorModeBootstrapScript = `(function(){try{var k=${JSON.stringify(COLOR_MODE_STORAGE_KEY)};var m=localStorage.getItem(k);if(m!=="dark"&&m!=="light"){m=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}var d=document.documentElement;d.dataset.theme=m;d.style.colorScheme=m;}catch(e){}})();`;

export function ColorModeProvider({ children }: { children: ReactNode }) {
	const [mode, setModeState] = useState<ColorMode>(getInitialMode);

	useLayoutEffect(() => {
		applyDocumentMode(mode);
		document.documentElement.classList.add("theme-ready");
	}, [mode]);

	const setMode = useCallback((next: ColorMode) => {
		setModeState(next);
		applyDocumentMode(next);
		try {
			window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, next);
		} catch {
			// ignore
		}
	}, []);

	const toggleMode = useCallback(() => {
		setMode(mode === "dark" ? "light" : "dark");
	}, [mode, setMode]);

	const appTheme = useMemo(() => createAppTheme(mode), [mode]);

	const value = useMemo(
		() => ({
			mode,
			setMode,
			toggleMode,
			isDark: mode === "dark",
		}),
		[mode, setMode, toggleMode],
	);

	return (
		<ColorModeContext.Provider value={value}>
			<ThemeProvider theme={appTheme} WrapperElement="div">
				{children}
			</ThemeProvider>
		</ColorModeContext.Provider>
	);
}

export function useColorMode(): ColorModeContextValue {
	const ctx = useContext(ColorModeContext);
	if (!ctx) {
		throw new Error("useColorMode must be used within ColorModeProvider.");
	}
	return ctx;
}
