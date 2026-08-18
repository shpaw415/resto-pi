import type { CreateOrderInput } from "../orders/service";

export type ExternalOrder = CreateOrderInput & {
	externalPosId: string;
};

export interface PosAdapter {
	id: "mock" | "colossal";
	label: string;
	pullNewOrders(restaurantId: string): Promise<ExternalOrder[]>;
	pushOrder(
		restaurantId: string,
		order: CreateOrderInput,
	): Promise<{ externalId: string }>;
	syncStatus(
		restaurantId: string,
		externalId: string,
		status: string,
	): Promise<void>;
	ping?(): Promise<string>;
}
