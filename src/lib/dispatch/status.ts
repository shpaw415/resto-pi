import type { DispatchStatus, OrderStatus } from "../../db/schema";

export const DISPATCH_LABELS: Record<DispatchStatus, string> = {
	pending: "En attente",
	need_prep: "À préparer",
	ready: "Prêt",
	done: "Terminé",
};

export function toDispatchStatus(status: OrderStatus): DispatchStatus {
	if (status === "en_attente") {
		return "pending";
	}
	if (status === "peut_preparer" || status === "en_preparation") {
		return "need_prep";
	}
	if (status === "pret" || status === "assigne" || status === "en_livraison") {
		return "ready";
	}
	return "done";
}

export function fromDispatchStatus(status: DispatchStatus): OrderStatus {
	if (status === "pending") {
		return "en_attente";
	}
	if (status === "need_prep") {
		return "peut_preparer";
	}
	if (status === "ready") {
		return "pret";
	}
	return "livre";
}
