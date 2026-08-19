import type { DispatchStatus } from "../../db/schema";

export type DispatchJob = {
	id: string;
	restaurantId: string;
	restaurantName: string;
	phone: string | null;
	address: string | null;
	customerName: string | null;
	status: DispatchStatus;
	updatedAt: string;
};
