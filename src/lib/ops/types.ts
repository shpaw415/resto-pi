export type ChatAuthorKind = "staff" | "courier";

export type ChatMessage = {
	id: string;
	courierUserId: string;
	authorUserId: string;
	authorKind: ChatAuthorKind;
	authorName: string | null;
	body: string;
	createdAt: string;
};

export type ChatCourier = {
	id: string;
	name: string | null;
	email: string | null;
};

export type ClientNote = {
	phone: string;
	note: string;
	updatedAt: string;
	updatedByName: string | null;
};
