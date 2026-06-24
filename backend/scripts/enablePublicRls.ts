import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

const sqlPath = join(process.cwd(), "prisma/sql/enable-public-rls.sql");

async function main(): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error("DATABASE_URL is not set");
    }

    const sql = readFileSync(sqlPath, "utf8");
    const pool = new Pool({ connectionString: databaseUrl });

    try {
        await pool.query(sql);
        console.log("Enabled Row-Level Security on all public tables missing it.");
    } finally {
        await pool.end();
    }
}

main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to enable public RLS:", message);
    process.exit(1);
});
