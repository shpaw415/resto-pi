import { useAuth } from "@hooks/useAuth";
import { usePath } from "@hooks/usePath";
import CloseIcon from "@material-design-icons/svg/filled/close.svg";
import LogoutIcon from "@material-design-icons/svg/filled/logout.svg";
import MenuIcon from "@material-design-icons/svg/filled/menu.svg";
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
import Paper from "@shpaw415/mui-lite/Paper";
import Typography from "@shpaw415/mui-lite/Typography";
import { navigate } from "frame-master-plugin-apply-react/utils";
import { useEffect, useState } from "react";
import { logoutClient } from "../../lib/auth/access-token-cookie";

const adminNavItems = [
	{ href: "/admin", label: "Tableau de bord", description: "Compteurs" },
	{ href: "/admin/commandes", label: "Commandes", description: "Statuts cuisine" },
	{ href: "/admin/catalogue", label: "Catalogue", description: "Produits et prix" },
	{ href: "/admin/restaurants", label: "Restaurants", description: "Établissements" },
	{ href: "/admin/api", label: "API", description: "Clés et scopes" },
	{ href: "/admin/pos", label: "POS", description: "Colossal / mock" },
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

	useEffect(() => {
		setOpen(false);
	}, [pathname]);

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

	return (
		<div className="flex min-h-dvh flex-col">
			<Paper
				elevation={1}
				square
				className="sticky top-0 z-20 border-x-0 border-t-0"
				sx={{ backgroundColor: "rgb(var(--bg-surface))" }}
			>
				<div className="flex min-h-14 items-center justify-between gap-2 px-2">
					<div className="flex min-w-0 items-center gap-1">
						<IconButton
							onClick={() => setOpen(true)}
							aria-label="Ouvrir le menu"
						>
							<MenuIcon />
						</IconButton>
						<div className="min-w-0">
							<Typography variant="subtitle2" Element="p" className="truncate">
								{currentLabel}
							</Typography>
							<Typography variant="caption" color="secondary">
								Resto Pi
							</Typography>
						</div>
					</div>
					<Button
						variant="text"
						size="small"
						color="secondary"
						onClick={handleLogout}
					>
						<span className="inline-flex items-center gap-1.5">
							<LogoutIcon
								className="h-4 w-4"
								style={{ fill: "currentColor" }}
							/>
							Déconnexion
						</span>
					</Button>
				</div>
			</Paper>
			<Drawer
				width="min(100vw - 3rem, 18rem)"
				anchor="left"
				open={open}
				onOpen={() => setOpen(true)}
				onClose={() => setOpen(false)}
			>
				<div className="flex h-full flex-col">
					<div className="flex items-center justify-between px-3 py-3">
						<Typography Element="span" variant="subtitle1">
							Resto Pi
						</Typography>
						<IconButton
							onClick={() => setOpen(false)}
							aria-label="Fermer le menu"
						>
							<CloseIcon />
						</IconButton>
					</div>
					<Divider />
					{navList}
				</div>
			</Drawer>
			<Box className="min-w-0 flex-1 p-4 sm:p-6">{children}</Box>
		</div>
	);
}
