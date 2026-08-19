import { useAuth } from "@hooks/useAuth";
import LocalShippingIcon from "@material-design-icons/svg/filled/local_shipping.svg";
import MyLocationIcon from "@material-design-icons/svg/filled/my_location.svg";
import PersonIcon from "@material-design-icons/svg/filled/person.svg";
import AppBar from "@shpaw415/mui-lite/AppBar";
import BottomNavigation, {
	BottomNavigationAction,
} from "@shpaw415/mui-lite/BottomNavigation";
import Paper from "@shpaw415/mui-lite/Paper";
import Toolbar from "@shpaw415/mui-lite/Toolbar";
import Typography from "@shpaw415/mui-lite/Typography";
import { navigate } from "frame-master-plugin-apply-react/utils";
import { useEffect, useState } from "react";
import { LivreurTrackingProvider } from "../../hooks/useLivreurTracking";

const tabs = [
	{ value: "/livreur", label: "Statut", icon: <MyLocationIcon /> },
	{ value: "/livreur/courses", label: "Courses", icon: <LocalShippingIcon /> },
	{ value: "/livreur/compte", label: "Compte", icon: <PersonIcon /> },
];

function currentTab(pathname: string) {
	if (pathname.startsWith("/livreur/courses")) {
		return "/livreur/courses";
	}
	if (pathname.startsWith("/livreur/compte")) {
		return "/livreur/compte";
	}
	return "/livreur";
}

export default function LivreurLayout({
	children,
}: {
	children: React.JSX.Element;
}) {
	const auth = useAuth();
	const [tab, setTab] = useState("/livreur");

	useEffect(() => {
		setTab(currentTab(window.location.pathname));
	}, []);

	const title =
		tabs.find((item) => item.value === tab)?.label ?? "Livreur";

	return (
		<LivreurTrackingProvider>
			<div className="livreur-shell flex min-h-dvh flex-col">
				<AppBar color="primary" position="sticky" elevation={0}>
					<Toolbar sx={{ minHeight: 56 }}>
						<div className="min-w-0 flex-1">
							<Typography variant="h6" Element="p">
								{title}
							</Typography>
							<Typography variant="caption" sx={{ color: "rgba(255,255,255,0.8)" }}>
								{auth?.userMeta?.identifier ?? "Livreur"}
							</Typography>
						</div>
					</Toolbar>
				</AppBar>
				<main className="min-w-0 flex-1 overflow-x-clip px-3 pb-3 pt-3">
					{children}
				</main>
				<Paper
					elevation={3}
					square
					className="livreur-bottom-nav"
					sx={{
						position: "fixed",
						left: 0,
						right: 0,
						bottom: 0,
						zIndex: 20,
						paddingBottom: "env(safe-area-inset-bottom)",
					}}
				>
					<BottomNavigation
						showLabels
						value={tab}
						onChange={(_event, value) => {
							const next = String(value);
							setTab(next);
							navigate(next);
						}}
					>
						{tabs.map((item) => (
							<BottomNavigationAction
								key={item.value}
								value={item.value}
								label={item.label}
								icon={item.icon}
							/>
						))}
					</BottomNavigation>
				</Paper>
			</div>
		</LivreurTrackingProvider>
	);
}
