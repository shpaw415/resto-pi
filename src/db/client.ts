import { drizzle } from "drizzle-orm/d1";
import type { CtxData } from "../action-utils/api-types";
import * as schema from "./schema";

export function createDb(env: Pick<Env, "DB">) {
	return drizzle(env.DB, { schema });
}

export type AppDatabase = ReturnType<typeof createDb>;

export function getDb(ctx: EventContext<Env, never, CtxData>) {
	ctx.data.db ??= createDb(ctx.env);
	return ctx.data.db;
}

export function newId(prefix: string) {
	return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
}
