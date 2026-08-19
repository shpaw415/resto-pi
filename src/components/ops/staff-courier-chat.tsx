import { GET as loadMessages, POST as sendMessage } from "@api/private/ops/messages";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";
import { useOptionalRestoLive } from "../../hooks/useRestoLive";
import type { ChatAuthorKind, ChatMessage } from "../../lib/ops/types";

export function StaffCourierChat({
	restaurantId,
	selfKind,
}: {
	restaurantId?: string;
	selfKind: ChatAuthorKind;
}) {
	const live = useOptionalRestoLive();
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [draft, setDraft] = useState("");
	const [error, setError] = useState<string | null>(null);
	const liveMessages = live?.messages;

	useEffect(() => {
		if (liveMessages) {
			setMessages(liveMessages);
			return;
		}
		void loadMessages(restaurantId ?? "").then((result) => {
			if (result.ok) {
				setMessages(result.messages);
			}
		});
		const timer = window.setInterval(() => {
			void loadMessages(restaurantId ?? "").then((result) => {
				if (result.ok) {
					setMessages(result.messages);
				}
			});
		}, 5000);
		return () => window.clearInterval(timer);
	}, [restaurantId, liveMessages]);

	async function submit() {
		setError(null);
		if (live?.connected && live.sendChat(draft)) {
			setDraft("");
			return;
		}
		const result = await sendMessage(draft, restaurantId ?? "");
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
				<Typography variant="subtitle1">Messages resto ↔ livreur</Typography>
				<Typography variant="caption" color="secondary">
					{live?.connected ? "Temps réel" : "Hors ligne / secours HTTP"}
				</Typography>
				<div className="max-h-72 space-y-2 overflow-y-auto">
					{messages.length === 0 ? (
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
					disabled={!draft.trim()}
					onClick={() => void submit()}
				>
					Envoyer
				</Button>
			</Stack>
		</Paper>
	);
}
