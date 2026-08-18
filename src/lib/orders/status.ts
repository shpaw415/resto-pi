import type { KitchenStatus, OrderStatus } from "../../db/schema";

export const STATUS_LABELS: Record<OrderStatus, string> = {
	en_attente: "En attente",
	peut_preparer: "Peut préparer",
	en_preparation: "En préparation",
	pret: "Prêt",
	termine: "Terminé",
	assigne: "Assigné",
	en_livraison: "En livraison",
	livre: "Livré",
};

export const KITCHEN_COLUMNS: KitchenStatus[] = [
	"en_attente",
	"peut_preparer",
	"en_preparation",
	"pret",
	"termine",
];

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
	en_attente: "peut_preparer",
	peut_preparer: "en_preparation",
	en_preparation: "pret",
	pret: "termine",
};

const PREV: Partial<Record<OrderStatus, OrderStatus>> = {
	peut_preparer: "en_attente",
	en_preparation: "peut_preparer",
	pret: "en_preparation",
	termine: "pret",
};

export function nextKitchenStatus(
	status: OrderStatus,
): OrderStatus | null {
	return NEXT[status] ?? null;
}

export function prevKitchenStatus(
	status: OrderStatus,
): OrderStatus | null {
	return PREV[status] ?? null;
}

export function isKitchenStatus(status: string): status is KitchenStatus {
	return KITCHEN_COLUMNS.includes(status as KitchenStatus);
}
