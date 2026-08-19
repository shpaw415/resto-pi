import { GET as loadJobs, POST as setJobStatus } from "@api/private/ops/dispatch";
import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
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

export function DispatchBoard({ restaurantId }: { restaurantId?: string }) {
	const live = useOptionalRestoLive();
	const [hubName, setHubName] = useState("Centre");
	const [jobs, setJobs] = useState<DispatchJob[]>([]);
	const [statusFilter, setStatusFilter] = useState("");
	const [addressFilter, setAddressFilter] = useState("");

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

	async function changeStatus(job: DispatchJob, status: DispatchStatus) {
		const result = await setJobStatus(job.id, status, restaurantId ?? "");
		if (!result.ok) {
			return;
		}
		setJobs((current) =>
			current.map((item) => (item.id === result.job.id ? result.job : item)),
		);
		live?.sendDispatch(result.job);
	}

	return (
		<Stack spacing={2}>
			<Typography variant="h5" Element="h1">
				{hubName}
			</Typography>
			<Typography variant="body2" color="secondary">
				Courses partagées entre restaurants du même centre.
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
									{job.customerName || job.phone || "Client"}
								</Typography>
								<Chip size="small" color="primary" label={DISPATCH_LABELS[job.status]} />
							</Stack>
							<Typography variant="body2">{job.address || "Sans adresse"}</Typography>
							<Typography variant="caption" color="secondary">
								{job.phone || "Sans téléphone"} · {job.restaurantName}
							</Typography>
							<div className="flex flex-wrap gap-2">
								{STATUSES.map((status) => (
									<Button
										key={status}
										size="small"
										variant={job.status === status ? "contained" : "outlined"}
										disabled={job.status === status}
										onClick={() => void changeStatus(job, status)}
									>
										{DISPATCH_LABELS[status]}
									</Button>
								))}
							</div>
						</Stack>
					</Paper>
				))
			)}
		</Stack>
	);
}
