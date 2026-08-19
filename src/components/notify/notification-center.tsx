import NotificationsIcon from "@material-design-icons/svg/filled/notifications.svg";
import Badge from "@shpaw415/mui-lite/Badge";
import IconButton from "@shpaw415/mui-lite/IconButton";
import {
	List,
	ListItem,
	ListItemButton,
	ListItemText,
} from "@shpaw415/mui-lite/List";
import Menu from "@shpaw415/mui-lite/Menu";
import Snackbar from "@shpaw415/mui-lite/Snackbar";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useRef, useState } from "react";
import {
	markActivitiesRead,
	subscribeActivities,
	type Activity,
} from "../../lib/notify/center";

export function NotificationCenter() {
	const anchor = useRef<HTMLButtonElement>(null);
	const [open, setOpen] = useState(false);
	const [items, setItems] = useState<Activity[]>([]);
	const [toast, setToast] = useState<Activity | null>(null);

	useEffect(() => {
		return subscribeActivities((next) => {
			setItems(next);
			const latest = next[0];
			if (latest && !latest.read) {
				setToast(latest);
			}
		});
	}, []);

	const unread = items.filter((item) => !item.read).length;

	return (
		<>
			<IconButton
				ref={anchor}
				aria-label="Notifications"
				colorOverRide="#ffffff"
				onClick={() => {
					setOpen((current) => !current);
					markActivitiesRead();
				}}
			>
				<Badge
					badgeContent={unread}
					invisible={unread === 0}
					color="error"
					overlap="circular"
				>
					<NotificationsIcon />
				</Badge>
			</IconButton>
			<Menu
				open={open}
				anchorEl={anchor}
				onClose={() => setOpen(false)}
				placement="bottom"
				sx={{ minWidth: 280, maxWidth: 360 }}
			>
				<List disablePadding>
					{items.length === 0 ? (
						<ListItem>
							<ListItemText primary="Aucune notification" />
						</ListItem>
					) : (
						items.slice(0, 12).map((item) => (
							<ListItemButton key={item.id} onClick={() => setOpen(false)}>
								<ListItemText primary={item.title} secondary={item.body} />
							</ListItemButton>
						))
					)}
				</List>
			</Menu>
			<Snackbar
				open={Boolean(toast)}
				autoHideDuration={4000}
				onClose={() => setToast(null)}
				position="top-right"
				message={
					toast ? (
						<span>
							<Typography variant="subtitle2">{toast.title}</Typography>
							<Typography variant="caption">{toast.body}</Typography>
						</span>
					) : (
						""
					)
				}
			/>
		</>
	);
}
