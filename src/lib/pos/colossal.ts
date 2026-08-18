import type { CreateOrderInput } from "../orders/service";
import {
	type PosIpApiConfig,
	posipPing,
	posipPullOrders,
	posipPushOrder,
	posipSyncStatus,
	posipValidateOrder,
} from "./posipapi";
import type { ExternalOrder, PosAdapter } from "./types";

export class ColossalPosAdapter implements PosAdapter {
	id = "colossal" as const;
	label = "Colossal Cloud POS (POSIPAPI)";

	constructor(private readonly config: PosIpApiConfig) {}

	async pullNewOrders(restaurantId: string): Promise<ExternalOrder[]> {
		return posipPullOrders(this.config, restaurantId);
	}

	async pushOrder(
		_restaurantId: string,
		order: CreateOrderInput,
	): Promise<{ externalId: string }> {
		return posipPushOrder(this.config, order);
	}

	async syncStatus(
		_restaurantId: string,
		externalId: string,
		status: string,
	): Promise<void> {
		await posipSyncStatus(this.config, externalId, status);
	}

	async ping(): Promise<string> {
		return posipPing(this.config);
	}

	async validateOrder(order: CreateOrderInput, orderId: string) {
		return posipValidateOrder(this.config, order, orderId);
	}
}
