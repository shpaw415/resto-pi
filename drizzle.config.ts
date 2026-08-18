import { defineConfig } from "drizzle-kit";

export default defineConfig({
	out: "./drizzle",
	schema: "./src/db/schema.ts",
	dialect: "sqlite",
	strict: true,
	driver: "d1-http",
	dbCredentials: {
		url: "",
	},
});
