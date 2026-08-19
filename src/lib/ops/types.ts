export type ChatAuthorKind = "staff" | "courier";

export type ChatMessage = {
	id: string;
	authorUserId: string;
	authorKind: ChatAuthorKind;
	authorName: string | null;
	body: string;
	createdAt: string;
};

export type ClientNote = {
	phone: string;
	note: string;
	updatedAt: string;
	updatedByName: string | null;
};
