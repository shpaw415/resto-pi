import {
	GET as loadJobs,
	POST as setJobStatus,
	PUT as saveJob,
} from "@api/private/ops/dispatch";
import AddIcon from "@material-design-icons/svg/filled/add.svg";
import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Dialog, {
	DialogActions,
	DialogContent,
	DialogTitle,
} from "@shpaw415/mui-lite/Dialog";
import FAB from "@shpaw415/mui-lite/FloatingActionButton";
import Paper from "@shpaw415/mui-lite/Paper";
import Select from "@shpaw415/mui-lite/Select";
import Stack from "@shpaw415/mui-lite/Stack";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useMemo, useState } from "react";
import { useOptionalRestoLive } from "../../hooks/useRestoLive";
import type { DispatchStatus } from "../../db/schema";
import { DISPATCH_LABELS } from "../../lib/dispatch/status";
import type { DispatchJob } from "../../lib/dispatch/types";

function option(value: string, label: string) {
	return (
		<span key={value} {...{ value }}>
			{label}
		</span>
	);
}

const STATUSES: DispatchStatus[] = ["pending", "need_prep", "ready", "done"];

const emptyForm = {
	id: "",
	phone: "",
	address: "",
	note: "",
	status: "pending" as DispatchStatus,
};

export function DispatchBoard({
	restaurantId,
	editable = false,
}: {
	restaurantId?: string;
	editable?: boolean;
}) {
	const live = useOptionalRestoLive();
	const [hubName, setHubName] = useState("Centre");
	const [jobs, setJobs] = useState<DispatchJob[]>([]);
	const [statusFilter, setStatusFilter] = useState("");
	const [addressFilter, setAddressFilter] = useState("");
	const [form, setForm] = useState(emptyForm);
	const [open, setOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		void loadJobs(restaurantId ?? "").then((result) => {
			if (result.ok) {
				setHubName(result.hub?.name ?? "Centre");
				setJobs(result.jobs);
			}
		});
	}, [restaurantId]);

	useEffect(() => {
		if (!live?.connected) {
			const timer = window.setInterval(() => {
				void loadJobs(restaurantId ?? "").then((result) => {
					if (result.ok) {
						setJobs(result.jobs);
					}
				});
			}, 5000);
			return () => window.clearInterval(timer);
		}
	}, [live?.connected, restaurantId]);

	useEffect(() => {
		if (!live?.dispatchJob) {
			return;
		}
		setJobs((current) => {
			const next = current.filter((job) => job.id !== live.dispatchJob!.id);
			return [live.dispatchJob!, ...next];
		});
	}, [live?.dispatchJob]);

	const visible = useMemo(() => {
		const query = addressFilter.trim().toLowerCase();
		return jobs.filter((job) => {
			if (statusFilter && job.status !== statusFilter) {
				return false;
			}
			if (!query) {
				return true;
			}
			return (job.address ?? "").toLowerCase().includes(query);
		});
	}, [jobs, statusFilter, addressFilter]);

	function openCreate() {
		setForm(emptyForm);
		setError(null);
		setOpen(true);
	}

	function startEdit(job: DispatchJob) {
		setForm({
			id: job.id,
			phone: job.phone ?? "",
			address: job.address ?? "",
			note: job.note ?? "",
			status: job.status,
		});
		setError(null);
		setOpen(true);
	}

	async function persist(job: DispatchJob) {
		setJobs((current) => {
			const next = current.filter((item) => item.id !== job.id);
			return [job, ...next];
		});
		live?.sendDispatch(job);
	}

	async function changeStatus(job: DispatchJob, status: DispatchStatus) {
		const result = await setJobStatus(job.id, status, restaurantId ?? "");
		if (!result.ok) {
			return;
		}
		await persist(result.job);
	}

	async function submit() {
		setError(null);
		if (!form.phone.trim() || !form.address.trim()) {
			setError("Téléphone et adresse requis.");
			return;
		}
		const result = await saveJob(
			{
				id: form.id || undefined,
				phone: form.phone,
				address: form.address,
				note: form.note,
				status: form.status,
			},
			restaurantId ?? "",
		);
		if (!result.ok) {
			setError(result.error);
			return;
		}
		await persist(result.job);
		setOpen(false);
		setForm(emptyForm);
	}

	return (
		<Stack spacing={2}>
			<Typography variant="h5" Element="h1">
				{hubName}
			</Typography>
			<Typography variant="body2" color="secondary">
				{editable
					? "Ajoute ou modifie les courses du centre."
					: "Consultation seulement — le resto gère les courses."}
			</Typography>
			<div className="grid gap-3 sm:grid-cols-2">
				<Select
					name="dispatch-status"
					label="Statut"
					value={statusFilter}
					onSelect={(value) => setStatusFilter(String(value))}
				>
					{option("", "Tous")}
					{STATUSES.map((status) => option(status, DISPATCH_LABELS[status]))}
				</Select>
				<TextField
					name="dispatch-address"
					label="Adresse"
					value={addressFilter}
					onChange={(event) =>
						setAddressFilter((event.target as HTMLInputElement).value)
					}
				/>
			</div>
			{visible.length === 0 ? (
				<Paper variant="outlined" className="p-4">
					<Typography color="secondary">Aucune course.</Typography>
				</Paper>
			) : (
				visible.map((job) => (
					<Paper key={job.id} elevation={1} className="p-4">
						<Stack spacing={1}>
							<Stack
								direction="row"
								justifyContent="space-between"
								alignItems="center"
							>
								<Typography variant="subtitle1">
									{job.phone || "Course"}
								</Typography>
								<Chip
									size="small"
									color="primary"
									label={DISPATCH_LABELS[job.status]}
								/>
							</Stack>
							<Typography variant="body2">{job.address}</Typography>
							{job.note ? (
								<Typography variant="body2" color="secondary">
									{job.note}
								</Typography>
							) : null}
							<Typography variant="caption" color="secondary">
								{job.restaurantName}
							</Typography>
							{editable ? (
								<>
									<div className="flex flex-wrap gap-2">
										{STATUSES.map((status) => (
											<Button
												key={status}
												size="small"
												variant={
													job.status === status ? "contained" : "outlined"
												}
												disabled={job.status === status}
												onClick={() => void changeStatus(job, status)}
											>
												{DISPATCH_LABELS[status]}
											</Button>
										))}
									</div>
									<Button
										size="small"
										variant="text"
										onClick={() => startEdit(job)}
									>
										Modifier
									</Button>
								</>
							) : null}
						</Stack>
					</Paper>
				))
			)}
			{editable ? (
				<>
					<FAB
						color="primary"
						variant="extended"
						aria-label="Créer une course"
						sx={{
							position: "fixed",
							right: 16,
							bottom: 24,
							zIndex: 30,
						}}
						onClick={openCreate}
					>
						<AddIcon />
						+ Créer
					</FAB>
					<Dialog open={open} onClose={() => setOpen(false)} fullWidth>
						<DialogTitle>
							{form.id ? "Modifier la course" : "Nouvelle course"}
						</DialogTitle>
						<DialogContent>
							<Stack spacing={1.5} className="pt-2">
								<TextField
									label="Téléphone"
									value={form.phone}
									onChange={(event) =>
										setForm((current) => ({
											...current,
											phone: (event.target as HTMLInputElement).value,
										}))
									}
								/>
								<TextField
									label="Adresse"
									value={form.address}
									onChange={(event) =>
										setForm((current) => ({
											...current,
											address: (event.target as HTMLInputElement).value,
										}))
									}
								/>
								<TextField
									label="Note (optionnel)"
									value={form.note}
									multiline={{ minRows: 2 }}
									onChange={(event) =>
										setForm((current) => ({
											...current,
											note: (event.target as HTMLInputElement).value,
										}))
									}
								/>
								<Select
									name="job-status"
									label="Statut"
									value={form.status}
									onSelect={(value) =>
										setForm((current) => ({
											...current,
											status: String(value) as DispatchStatus,
										}))
									}
								>
									{STATUSES.map((status) =>
										option(status, DISPATCH_LABELS[status]),
									)}
								</Select>
								{error ? (
									<Typography variant="caption" color="error">
										{error}
									</Typography>
								) : null}
							</Stack>
						</DialogContent>
						<DialogActions>
							<Button onClick={() => setOpen(false)}>Annuler</Button>
							<Button variant="contained" onClick={() => void submit()}>
								{form.id ? "Enregistrer" : "Créer"}
							</Button>
						</DialogActions>
					</Dialog>
				</>
			) : null}
		</Stack>
	);
}
