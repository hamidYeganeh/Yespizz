import "server-only";
import { Pool } from "pg";
import { CommerceError, records, type RecordValue } from "../../../../packages/ui/src/commerce-store";

let pool: Pool | undefined;

export async function publicRecords(
  scopes: string[],
  collection: "content" | "ads" | "promotions" | "reviews",
  allRestaurants = false,
) {
  const connectionString = process.env.COMMERCE_DATABASE_URL;
  try {
    if (!connectionString) return scopes.flatMap(scope => records(scope, collection));
    pool ??= new Pool({ connectionString, max: 4, connectionTimeoutMillis: 5000, query_timeout: 5000 });
    const result = await pool.query<{ id: string; data: string }>(
      `SELECT id, data FROM yespizz_commerce.commerce_records
       WHERE collection = $1 AND (scope = ANY($2::text[]) OR
         ($3::boolean AND scope NOT IN ('admin', 'system') AND scope NOT LIKE 'customer:%' AND scope NOT LIKE 'guest:%'))
       ORDER BY scope, id`,
      [collection, scopes, allRestaurants],
    );
    return result.rows.map(({ id, data }) => ({ ...JSON.parse(data), id }) as RecordValue & { id: string });
  } catch (error) {
    console.error("Public record store unavailable", collection, (error as { code?: string } | null)?.code);
    throw new CommerceError(503, "This list is temporarily unavailable.");
  }
}
