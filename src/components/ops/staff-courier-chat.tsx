import { GET as loadMessages, POST as sendMessage } from "@api/private/ops/messages";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Select from "@shpaw415/mui-lite/Select";
import Stack from "@shpaw415/mui-lite/Stack";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useMemo, useState } from "react";
import { useOptionalRestoLive } from "../../hooks/useRestoLive";
import type { ChatAuthorKind, ChatCourier, ChatMessage } from "../../lib/ops/types";

function option(value: string, label: string) {
	return (
		<span key={value} {...{ value }}>
			{label}
		</span>
	);
}

export function StaffCourierChat({
	restaurantId,
	selfKind,
}: {
	restaurantId?: string;
	selfKind: ChatAuthorKind;
}) {
	const live = useOptionalRestoLive();
	const [couriers, setCouriers] = useState<ChatCourier[]>([]);
	const [selectedId, setSelectedId] = useState("");
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [draft, setDraft] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [selfId, setSelfId] = useState("");

	const threadId = selfKind === "courier" ? selfId : selectedId;
	const connected = Boolean(live?.connected);

	useEffect(() => {
		void loadMessages(restaurantId ?? "", "").then((result) => {
			if (!result.ok) {
				return;
			}
			setSelfId(result.selfId ?? "");
			setCouriers(result.couriers);
			if (result.authorKind === "courier" && result.selfId) {
				setSelectedId(result.selfId);
				setMessages(result.messages);
			}
		});
	}, [restaurantId]);

	useEffect(() => {
		if (!threadId || selfKind === "courier") {
			return;
		}
		void loadMessages(restaurantId ?? "", threadId).then((result) => {
			if (result.ok) {
				setMessages(result.messages);
			}
		});
	}, [restaurantId, threadId, selfKind]);

	useEffect(() => {
		if (connected) {
			return;
		}
		if (!threadId) {
			return;
		}
		const timer = window.setInterval(() => {
			void loadMessages(restaurantId ?? "", threadId).then((result) => {
				if (result.ok) {
					setMessages(result.messages);
				}
			});
		}, 5000);
		return () => window.clearInterval(timer);
	}, [connected, restaurantId, threadId]);

	useEffect(() => {
		if (!connected || !live) {
			return;
		}
		setMessages(
			live.messages.filter((message) => message.courierUserId === threadId),
		);
	}, [connected, live?.messages, threadId]);

	const choices = useMemo(() => {
		const online = new Set(live?.onlineCourierIds ?? []);
		return couriers.map((courier) => ({
			...courier,
			online: online.has(courier.id),
			label: `${courier.name || courier.email || courier.id}${
				online.has(courier.id) ? " · en ligne" : ""
			}`,
		}));
	}, [couriers, live?.onlineCourierIds]);

	async function submit() {
		setError(null);
		if (!threadId) {
			setError("Choisis un livreur.");
			return;
		}
		if (live?.connected && live.sendChat(draft, threadId)) {
			setDraft("");
			return;
		}
		const result = await sendMessage(draft, restaurantId ?? "", threadId);
		if (!result.ok) {
			setError(result.error);
			return;
		}
		setDraft("");
		setMessages(result.messages);
	}

	return (
		<Paper elevation={1} className="p-4">
			<Stack spacing={1.5}>
				<Typography variant="subtitle1">
					{selfKind === "staff" ? "Message à un livreur" : "Messages du resto"}
				</Typography>
				<Typography variant="caption" color="secondary">
					{connected ? "Temps réel" : "Hors ligne — secours HTTP"}
				</Typography>
				{selfKind === "staff" ? (
					<Select
						name="courier"
						label="Livreur"
						value={selectedId}
						onSelect={(value) => setSelectedId(String(value))}
					>
						{choices.length === 0
							? option("", "Aucun livreur authentifié")
							: choices.map((courier) => option(courier.id, courier.label))}
					</Select>
				) : null}
				<div className="max-h-72 space-y-2 overflow-y-auto">
					{!threadId ? (
						<Typography variant="body2" color="secondary">
							Sélectionne un livreur authentifié.
						</Typography>
					) : messages.length === 0 ? (
						<Typography variant="body2" color="secondary">
							Aucun message.
						</Typography>
					) : (
						messages.map((message) => (
							<div
								key={message.id}
								className={
									message.authorKind === selfKind ? "text-right" : "text-left"
								}
							>
								<Typography variant="caption" color="secondary">
									{message.authorKind === "courier" ? "Livreur" : "Resto"}
									{message.authorName ? ` · ${message.authorName}` : ""}
								</Typography>
								<Typography variant="body2">{message.body}</Typography>
							</div>
						))
					)}
				</div>
				{error ? (
					<Typography variant="caption" color="error">
						{error}
					</Typography>
				) : null}
				<TextField
					name="chat-draft"
					label="Message"
					value={draft}
					disabled={!threadId}
					onChange={(event) =>
						setDraft((event.target as HTMLInputElement).value)
					}
					onKeyDown={(event) => {
						if (event.key === "Enter" && !event.shiftKey) {
							event.preventDefault();
							if (draft.trim()) {
								void submit();
							}
						}
					}}
				/>
				<Button
					variant="contained"
					color="primary"
					disabled={!draft.trim() || !threadId}
					onClick={() => void submit()}
				>
					Envoyer
				</Button>
			</Stack>
		</Paper>
	);
}
