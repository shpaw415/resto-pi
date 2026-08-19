import { GET as loadDuty, POST as setDuty } from "@api/private/livreur/duty";
import { useAuth } from "@hooks/useAuth";
import ChatIcon from "@material-design-icons/svg/filled/chat.svg";
import LocalShippingIcon from "@material-design-icons/svg/filled/local_shipping.svg";
import MyLocationIcon from "@material-design-icons/svg/filled/my_location.svg";
import PersonIcon from "@material-design-icons/svg/filled/person.svg";
import AppBar from "@shpaw415/mui-lite/AppBar";
import BottomNavigation, {
	BottomNavigationAction,
} from "@shpaw415/mui-lite/BottomNavigation";
import Button from "@shpaw415/mui-lite/Button";
import Dialog, {
	DialogActions,
	DialogContent,
	DialogTitle,
} from "@shpaw415/mui-lite/Dialog";
import Paper from "@shpaw415/mui-lite/Paper";
import Toolbar from "@shpaw415/mui-lite/Toolbar";
import Typography from "@shpaw415/mui-lite/Typography";
import { navigate } from "frame-master-plugin-apply-react/utils";
import { useEffect, useState } from "react";
import { LivreurTrackingProvider } from "../../hooks/useLivreurTracking";
import { RestoLiveProvider, useOptionalRestoLive } from "../../hooks/useRestoLive";

const tabs = [
	{ value: "/livreur", label: "Statut", icon: <MyLocationIcon /> },
	{ value: "/livreur/courses", label: "Courses", icon: <LocalShippingIcon /> },
	{ value: "/livreur/messages", label: "Messages", icon: <ChatIcon /> },
	{ value: "/livreur/compte", label: "Compte", icon: <PersonIcon /> },
];

function currentTab(pathname: string) {
	if (pathname.startsWith("/livreur/courses")) {
		return "/livreur/courses";
	}
	if (pathname.startsWith("/livreur/messages")) {
		return "/livreur/messages";
	}
	if (pathname.startsWith("/livreur/compte")) {
		return "/livreur/compte";
	}
	return "/livreur";
}

function LivreurDutyGate({
	punchedIn,
	onPunchIn,
	onPunchOut,
	children,
}: {
	punchedIn: boolean;
	onPunchIn: () => void;
	onPunchOut: () => void;
	children: React.JSX.Element;
}) {
	const live = useOptionalRestoLive();
	return (
		<>
			{children}
			<Dialog open={!punchedIn} disableBackDrop>
				<DialogTitle>Vous devez être actif pour continuer</DialogTitle>
				<DialogContent>
					<Typography>
						Pointe ton arrivée pour rejoindre le suivi et recevoir les courses.
					</Typography>
				</DialogContent>
				<DialogActions>
					<Button
						variant="contained"
						color="primary"
						onClick={() => void onPunchIn()}
					>
						Je suis actif
					</Button>
				</DialogActions>
			</Dialog>
			{punchedIn ? (
				<div className="fixed right-3 top-16 z-30">
					<Button
						size="small"
						variant="outlined"
						onClick={() => {
							live?.punchOut();
							void onPunchOut();
						}}
					>
						Pointer la sortie
					</Button>
				</div>
			) : null}
		</>
	);
}

export default function LivreurLayout({
	children,
}: {
	children: React.JSX.Element;
}) {
	const auth = useAuth();
	const [tab, setTab] = useState("/livreur");
	const [punchedIn, setPunchedIn] = useState(false);

	useEffect(() => {
		setTab(currentTab(window.location.pathname));
	}, []);

	useEffect(() => {
		void loadDuty().then((result) => {
			if (result.ok) {
				setPunchedIn(result.punchedIn);
			}
		});
	}, []);

	async function punchIn() {
		const result = await setDuty(true);
		if (result.ok) {
			setPunchedIn(true);
		}
	}

	async function punchOut() {
		await setDuty(false);
		setPunchedIn(false);
	}

	const title =
		tabs.find((item) => item.value === tab)?.label ?? "Livreur";

	return (
		<RestoLiveProvider
			enabled={punchedIn}
			onForceClockOut={() => setPunchedIn(false)}
		>
			<LivreurTrackingProvider active={punchedIn}>
				<LivreurDutyGate
					punchedIn={punchedIn}
					onPunchIn={() => void punchIn()}
					onPunchOut={() => void punchOut()}
				>
					<div className="livreur-shell flex min-h-dvh flex-col">
						<AppBar color="primary" position="sticky" elevation={0}>
							<Toolbar sx={{ minHeight: 56 }}>
								<div className="min-w-0 flex-1">
									<Typography variant="h6" Element="p">
										{title}
									</Typography>
									<Typography
										variant="caption"
										sx={{ color: "rgba(255,255,255,0.8)" }}
									>
										{auth?.userMeta?.identifier ?? "Livreur"}
										{punchedIn ? " · actif" : " · hors service"}
									</Typography>
								</div>
							</Toolbar>
						</AppBar>
						<main className="min-w-0 flex-1 overflow-x-clip px-3 pb-3 pt-3">
							{punchedIn ? children : null}
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
				</LivreurDutyGate>
			</LivreurTrackingProvider>
		</RestoLiveProvider>
	);
}
