import { useAuth } from "@hooks/useAuth";
import { usePath } from "@hooks/usePath";
import CloseIcon from "@material-design-icons/svg/filled/close.svg";
import LogoutIcon from "@material-design-icons/svg/filled/logout.svg";
import MenuIcon from "@material-design-icons/svg/filled/menu.svg";
import AppBar from "@shpaw415/mui-lite/AppBar";
import Box from "@shpaw415/mui-lite/Box";
import Button from "@shpaw415/mui-lite/Button";
import Divider from "@shpaw415/mui-lite/Divider";
import Drawer from "@shpaw415/mui-lite/Drawer";
import IconButton from "@shpaw415/mui-lite/IconButton";
import {
	List,
	ListItem,
	ListItemButton,
	ListItemText,
} from "@shpaw415/mui-lite/List";
import Toolbar from "@shpaw415/mui-lite/Toolbar";
import Typography from "@shpaw415/mui-lite/Typography";
import { navigate } from "frame-master-plugin-apply-react/utils";
import { useEffect, useState } from "react";
import { logoutClient } from "../../lib/auth/access-token-cookie";

const DRAWER_WIDTH = 260;

const adminNavItems = [
	{ href: "/admin", label: "Tableau de bord", description: "Vue d’ensemble" },
	{ href: "/admin/commandes", label: "Commandes", description: "Cuisine" },
	{ href: "/admin/suivi", label: "Livreurs", description: "Carte OSM" },
	{ href: "/admin/catalogue", label: "Catalogue", description: "Menu POS" },
	{ href: "/admin/restaurants", label: "Restaurants", description: "Fiches" },
	{ href: "/admin/api", label: "API", description: "Clés externes" },
	{ href: "/admin/pos", label: "POS", description: "Colossal" },
];

function isActive(pathname: string, href: string) {
	if (href === "/admin") {
		return pathname === "/admin" || pathname === "/admin/";
	}
	return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminLayout({
	children,
}: {
	children: React.JSX.Element;
}) {
	const auth = useAuth();
	const pathname = usePath();
	const [open, setOpen] = useState(false);
	const [wide, setWide] = useState(false);

	useEffect(() => {
		setOpen(false);
	}, [pathname]);

	useEffect(() => {
		const media = window.matchMedia("(min-width: 900px)");
		const sync = () => setWide(media.matches);
		sync();
		media.addEventListener("change", sync);
		return () => media.removeEventListener("change", sync);
	}, []);

	function handleLogout() {
		logoutClient(auth);
		window.location.assign("/login");
	}

	const currentLabel =
		adminNavItems.find((item) => isActive(pathname, item.href))?.label ??
		"Admin";

	const navList = (
		<List disablePadding className="py-1">
			{adminNavItems.map((item) => {
				const selected = isActive(pathname, item.href);
				return (
					<ListItem key={item.href} disablePadding disableGutters>
						<ListItemButton
							selected={selected}
							aria-current={selected ? "page" : undefined}
							onClick={() => {
								setOpen(false);
								navigate(item.href);
							}}
						>
							<ListItemText
								primary={item.label}
								secondary={item.description}
							/>
						</ListItemButton>
					</ListItem>
				);
			})}
		</List>
	);

	const drawer = (
		<div className="flex h-full flex-col">
			<div className="flex items-center justify-between px-4 py-4">
				<Typography Element="span" variant="subtitle1">
					Resto Pi
				</Typography>
				{!wide ? (
					<IconButton
						onClick={() => setOpen(false)}
						aria-label="Fermer le menu"
					>
						<CloseIcon />
					</IconButton>
				) : null}
			</div>
			<Divider />
			{navList}
		</div>
	);

	return (
		<div className="flex min-h-dvh">
			{wide ? (
				<Drawer variant="permanent" anchor="left" width={DRAWER_WIDTH} open>
					{drawer}
				</Drawer>
			) : (
				<Drawer
					variant="temporary"
					anchor="left"
					width={DRAWER_WIDTH}
					open={open}
					onOpen={() => setOpen(true)}
					onClose={() => setOpen(false)}
				>
					{drawer}
				</Drawer>
			)}
			<Box className="flex min-w-0 flex-1 flex-col">
				<AppBar color="primary" position="sticky" elevation={1}>
					<Toolbar>
						{!wide ? (
							<IconButton
								onClick={() => setOpen(true)}
								aria-label="Ouvrir le menu"
								colorOverRide="#ffffff"
							>
								<MenuIcon />
							</IconButton>
						) : null}
						<div className="min-w-0 flex-1 px-2">
							<Typography variant="h6" Element="p" className="truncate">
								{currentLabel}
							</Typography>
						</div>
						<Button
							variant="text"
							size="small"
							onClick={handleLogout}
							sx={{ color: "#fff" }}
						>
							<span className="inline-flex items-center gap-1.5">
								<LogoutIcon
									className="h-4 w-4"
									style={{ fill: "currentColor" }}
								/>
								Déconnexion
							</span>
						</Button>
					</Toolbar>
				</AppBar>
				<Box className="min-w-0 flex-1 p-4 sm:p-6">{children}</Box>
			</Box>
		</div>
	);
}
