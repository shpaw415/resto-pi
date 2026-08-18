import type { CreateOrderInput } from "../orders/service";

export type UeatOrderLine = {
	externalId: string;
	name: string;
	quantity: number;
	unitPrice: number;
	regularUnitPrice: number;
	hasFederalTax: boolean;
	hasStateTax: boolean;
	extras: unknown[];
	options: UeatOrderLine[];
	orderItemId: number;
	orderItemNote: string;
};

export type UeatSendOrderBody = {
	location: { id: string };
	order: {
		company: { id: number | string; name: string; phoneNumber: string };
		marketplace: null;
		customer: {
			allergies: string;
			company: string;
			email: string;
			fidelityNumber: string;
			firstName: string;
			lastName: string;
			phoneNumber: string;
		};
		deliveryAddress: {
			apartment: string | null;
			city: string;
			civicNumber: string;
			postalCode: string;
			streetName: string;
		};
		deliveryLocation: string;
		fees: {
			allergyFees: number;
			serviceFees: number;
			shipingFees: number;
			bagFees: unknown[];
		};
		id: string;
		items: UeatOrderLine[];
		paidDateTime: string;
		paymentDetailsList: unknown[];
		pickupDateTime: string;
		preparationTimeInMinutes: number;
		preparationType: "asap" | "preOrder";
		processedDateTime: string;
		promotions: unknown[];
		readyDateTime: string;
		scheduledPreparationDateTime: string;
		serviceQuestions: unknown[];
		totals: {
			customerPaidAmount: number;
			isOrderPaid: boolean;
			subTotal: number;
			taxes: Array<{
				amount: number;
				name: string;
				percent: number;
				type: "Federal" | "State";
			}>;
			tips: number;
			total: number;
		};
		orderType: "delivery" | "takeout";
		counterNotes: string;
		deliveryNotes: string;
		roomNumber: string;
		tableNumber: string;
		kiosk: string;
		channel: string;
	};
};

const TPS = 0.05;
const TVQ = 0.09975;

function dollars(cents: number): number {
	return Math.round(cents) / 100;
}

function splitName(full: string | undefined): { firstName: string; lastName: string } {
	const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) {
		return { firstName: "Client", lastName: "" };
	}
	if (parts.length === 1) {
		return { firstName: parts[0] ?? "Client", lastName: "" };
	}
	return {
		firstName: parts[0] ?? "Client",
		lastName: parts.slice(1).join(" "),
	};
}

function parseStreet(address: string | undefined): {
	civicNumber: string;
	streetName: string;
} {
	const raw = (address ?? "").trim();
	const match = raw.match(/^(\d+\w*)\s+(.+)$/);
	if (!match) {
		return { civicNumber: "", streetName: raw };
	}
	return { civicNumber: match[1] ?? "", streetName: match[2] ?? "" };
}

export function quebecTaxes(subTotal: number): UeatSendOrderBody["order"]["totals"]["taxes"] {
	const tps = Math.round(subTotal * TPS * 100) / 100;
	const tvq = Math.round(subTotal * TVQ * 100) / 100;
	return [
		{ amount: tps, name: "TPS", percent: TPS, type: "Federal" },
		{ amount: tvq, name: "TVQ", percent: TVQ, type: "State" },
	];
}

export function buildUeatSendOrderBody(
	locationId: string,
	order: CreateOrderInput,
	opts: {
		orderId: string;
		companyName?: string;
		companyPhone?: string;
		shippingFees?: number;
	},
): UeatSendOrderBody {
	const now = new Date();
	const ready = new Date(now.getTime() + 5 * 60_000);
	const iso = now.toISOString();
	const readyIso = ready.toISOString();
	const names = splitName(order.customerName);
	const street = parseStreet(order.customerAddress);
	let itemSeq = Number(String(Date.now()).slice(-9));
	const nextId = () => {
		itemSeq += 1;
		return itemSeq;
	};

	const items: UeatOrderLine[] = order.items.map((item) => {
		const unit = dollars(item.unitPriceCents);
		const line: UeatOrderLine = {
			externalId: item.variantId || item.productId || item.name,
			name: item.name,
			quantity: item.quantity,
			unitPrice: unit,
			regularUnitPrice: unit,
			hasFederalTax: true,
			hasStateTax: true,
			extras: [],
			options: (item.extras ?? []).map((extra) => ({
				externalId: extra.name,
				name: extra.name,
				quantity: 1,
				unitPrice: dollars(extra.priceCentsDelta),
				regularUnitPrice: dollars(extra.priceCentsDelta),
				hasFederalTax: true,
				hasStateTax: true,
				extras: [],
				options: [],
				orderItemId: nextId(),
				orderItemNote: "",
			})),
			orderItemId: nextId(),
			orderItemNote: "",
		};
		return line;
	});

	const subTotal = dollars(
		order.items.reduce((sum, item) => {
			const extras = (item.extras ?? []).reduce(
				(acc, extra) => acc + extra.priceCentsDelta,
				0,
			);
			return sum + (item.unitPriceCents + extras) * item.quantity;
		}, 0),
	);
	const shipingFees = opts.shippingFees ?? 0;
	const taxable = subTotal + shipingFees;
	const taxes = quebecTaxes(taxable);
	const taxSum = taxes.reduce((sum, tax) => sum + tax.amount, 0);
	const total = Math.round((taxable + taxSum) * 100) / 100;
	const companyId = Number(locationId);
	const orderType = order.type === "livraison" ? "delivery" : "takeout";

	return {
		location: { id: locationId },
		order: {
			company: {
				id: Number.isFinite(companyId) ? companyId : locationId,
				name: opts.companyName ?? "",
				phoneNumber: opts.companyPhone ?? "",
			},
			marketplace: null,
			customer: {
				allergies: "",
				company: "",
				email: "",
				fidelityNumber: "",
				firstName: names.firstName,
				lastName: names.lastName,
				phoneNumber: order.customerPhone ?? "",
			},
			deliveryAddress: {
				apartment: null,
				city: "",
				civicNumber: street.civicNumber,
				postalCode: "",
				streetName: street.streetName,
			},
			deliveryLocation: "",
			fees: {
				allergyFees: 0,
				serviceFees: 0,
				shipingFees,
				bagFees: [],
			},
			id: opts.orderId,
			items,
			paidDateTime: "0001-01-01T00:00:00",
			paymentDetailsList: [],
			pickupDateTime: readyIso,
			preparationTimeInMinutes: 0,
			preparationType: "asap",
			processedDateTime: iso,
			promotions: [],
			readyDateTime: readyIso,
			scheduledPreparationDateTime: readyIso,
			serviceQuestions: [],
			totals: {
				customerPaidAmount: total,
				isOrderPaid: false,
				subTotal,
				taxes,
				tips: 0,
				total,
			},
			orderType,
			counterNotes: order.notes ?? "",
			deliveryNotes: "",
			roomNumber: "",
			tableNumber: "",
			kiosk: "",
			channel: "web",
		},
	};
}
