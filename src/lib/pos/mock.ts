import type { CreateOrderInput } from "../orders/service";
import type { ExternalOrder, PosAdapter } from "./types";

export class MockPosAdapter implements PosAdapter {
	id = "mock" as const;
	label = "POS simulé";

	async pullNewOrders(restaurantId: string): Promise<ExternalOrder[]> {
		const stamp = Date.now().toString(36);
		return [
			{
				restaurantId,
				type: "emporter",
				source: "pos",
				externalPosId: `mock-${stamp}`,
				customerName: "Client POS",
				customerPhone: "514-555-0100",
				notes: "Import simulé Colossal / mock",
				items: [
					{
						name: "Commande POS",
						quantity: 1,
						unitPriceCents: 1895,
					},
				],
			},
		];
	}

	async pushOrder(
		_restaurantId: string,
		_order: CreateOrderInput,
	): Promise<{ externalId: string }> {
		return { externalId: `mock-push-${crypto.randomUUID().slice(0, 8)}` };
	}

	async syncStatus(): Promise<void> {}
}
