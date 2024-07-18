import * as schema from "./schema";

import { sql } from "@vercel/postgres";
import { drizzle } from "drizzle-orm/vercel-postgres";
import { env } from "../../env.js";

export type SchemaType = typeof schema;

// Connect to Vercel Postgres
export const db = drizzle<SchemaType>(sql, {
  schema,
  logger: env.NODE_ENV === "development",
});
