import { ThrowNotFound } from "@next/client";

export default function CatchAll() {
	ThrowNotFound();
	return null;
}
