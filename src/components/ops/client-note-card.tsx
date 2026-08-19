import { GET as loadNote, PUT as saveNote } from "@api/private/ops/notes";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";

export function ClientNoteCard({
	phone: initialPhone,
	restaurantId,
	compact,
}: {
	phone?: string;
	restaurantId?: string;
	compact?: boolean;
}) {
	const [phone, setPhone] = useState(initialPhone ?? "");
	const [note, setNote] = useState("");
	const [meta, setMeta] = useState("");
	const [error, setError] = useState<string | null>(null);
	const locked = Boolean(initialPhone);

	async function lookup(value = phone) {
		if (!value.trim()) {
			return;
		}
		const result = await loadNote(value, restaurantId);
		if (!result.ok || !result.note) {
			return;
		}
		setPhone(result.note.phone);
		setNote(result.note.note);
		setMeta(
			result.note.updatedAt
				? `Maj ${result.note.updatedByName || ""}`.trim()
				: "",
		);
	}

	useEffect(() => {
		if (initialPhone) {
			setPhone(initialPhone);
			void lookup(initialPhone);
		}
	}, [initialPhone, restaurantId]);

	async function save() {
		setError(null);
		const result = await saveNote(phone, note, restaurantId);
		if (!result.ok) {
			setError(result.error);
			return;
		}
		if (result.note) {
			setPhone(result.note.phone);
			setNote(result.note.note);
		}
		setMeta("Enregistré");
	}

	return (
		<Paper elevation={compact ? 0 : 1} className={compact ? "" : "p-4"}>
			<Stack spacing={1.5}>
				{!compact ? (
					<Typography variant="subtitle1">Note client</Typography>
				) : null}
				<TextField
					name="client-phone"
					label="Téléphone"
					value={phone}
					disabled={locked}
					onChange={(event) =>
						setPhone((event.target as HTMLInputElement).value)
					}
				/>
				{!locked ? (
					<Button variant="text" onClick={() => void lookup()}>
						Ouvrir la note
					</Button>
				) : null}
				<TextField
					name="client-note"
					label="Note persistante"
					value={note}
					multiline={{ minRows: 3 }}
					onChange={(event) =>
						setNote((event.target as HTMLInputElement).value)
					}
				/>
				{meta ? (
					<Typography variant="caption" color="secondary">
						{meta}
					</Typography>
				) : null}
				{error ? (
					<Typography variant="caption" color="error">
						{error}
					</Typography>
				) : null}
				<Button variant="outlined" onClick={() => void save()}>
					Enregistrer la note
				</Button>
			</Stack>
		</Paper>
	);
}
