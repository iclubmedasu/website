/**
 * Merge Supabase (production) data into the local Postgres database.
 *
 * Keeps existing local rows; inserts remote rows beside them with ID remapping.
 * Match-or-insert on natural keys where defined (email, slug, confirmation codes, …).
 *
 * Usage (from backend/):
 *   # Dry-run (no writes) — reports insert / skip / conflict counts
 *   pnpm merge:from-supabase -- --dry-run
 *
 *   # Real merge (backup local first: pg_dump)
 *   pnpm merge:from-supabase
 *
 * Env:
 *   DATABASE_URL           — must be local Postgres (refuses Supabase / remote hosts)
 *   SUPABASE_DATABASE_URL  — production Postgres URL (read; prefer direct/session role that bypasses RLS)
 *
 * Does not truncate, reset, or sync GitHub file storage / Supabase Auth.
 */
import "dotenv/config";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

type FkSpec = {
    column: string;
    refTable: string;
    optional?: boolean;
};

type TableSpec = {
    /** Quoted Postgres table name (Prisma model name). */
    name: string;
    /** Primary key column. Default "id". */
    idColumn?: string;
    /** int = serial remap; string = keep/match id as-is (e.g. SitePage). */
    idType?: "int" | "string";
    /**
     * Natural key columns for match-or-insert (after FK remap).
     * If a local row matches, reuse its id (skip insert).
     */
    naturalKey?: string[];
    fks?: FkSpec[];
    /** Self-FK columns: insert as null, then UPDATE after map is complete. */
    selfFks?: string[];
};

type Counts = {
    remote: number;
    inserted: number;
    skipped: number;
    conflicts: number;
    missingParent: number;
};

const LOCAL_HOSTS = new Set([
    "localhost",
    "127.0.0.1",
    "::1",
    "host.docker.internal",
]);

/** FK-safe order covering main app tables from prisma/schema.prisma. */
const TABLES: TableSpec[] = [
    { name: "Member", naturalKey: ["email"] },
    { name: "Team", naturalKey: ["name"] },
    {
        name: "TeamRole",
        naturalKey: ["teamId", "roleName"],
        fks: [{ column: "teamId", refTable: "Team" }],
    },
    {
        name: "Subteam",
        naturalKey: ["teamId", "name"],
        fks: [{ column: "teamId", refTable: "Team" }],
    },
    {
        name: "TeamMember",
        naturalKey: ["teamId", "memberId"],
        fks: [
            { column: "teamId", refTable: "Team" },
            { column: "memberId", refTable: "Member" },
            { column: "roleId", refTable: "TeamRole" },
            { column: "subteamId", refTable: "Subteam", optional: true },
        ],
    },
    {
        name: "MemberRoleHistory",
        fks: [
            { column: "memberId", refTable: "Member" },
            { column: "teamId", refTable: "Team", optional: true },
            { column: "roleId", refTable: "TeamRole", optional: true },
            { column: "subteamId", refTable: "Subteam", optional: true },
        ],
    },
    {
        name: "Alumni",
        fks: [
            { column: "memberId", refTable: "Member" },
            { column: "teamId", refTable: "Team", optional: true },
            { column: "roleId", refTable: "TeamRole", optional: true },
            { column: "subteamId", refTable: "Subteam", optional: true },
        ],
    },
    {
        name: "User",
        naturalKey: ["memberId"],
        fks: [{ column: "memberId", refTable: "Member" }],
    },
    { name: "ProjectType", naturalKey: ["name"] },
    {
        name: "Project",
        naturalKey: ["slug"],
        fks: [
            { column: "projectTypeId", refTable: "ProjectType" },
            { column: "createdByMemberId", refTable: "Member" },
        ],
    },
    {
        name: "ProjectTeam",
        naturalKey: ["projectId", "teamId"],
        fks: [
            { column: "projectId", refTable: "Project" },
            { column: "teamId", refTable: "Team" },
        ],
    },
    {
        name: "ProjectTag",
        naturalKey: ["projectId", "tagName"],
        fks: [{ column: "projectId", refTable: "Project" }],
    },
    {
        name: "ProjectPhase",
        fks: [{ column: "projectId", refTable: "Project" }],
    },
    {
        name: "Task",
        fks: [
            { column: "projectId", refTable: "Project" },
            { column: "phaseId", refTable: "ProjectPhase", optional: true },
            { column: "leaderId", refTable: "Member", optional: true },
        ],
        selfFks: ["parentTaskId"],
    },
    {
        name: "TaskTeam",
        naturalKey: ["taskId", "teamId"],
        fks: [
            { column: "taskId", refTable: "Task" },
            { column: "teamId", refTable: "Team" },
        ],
    },
    {
        name: "TaskAssignment",
        naturalKey: ["taskId", "memberId"],
        fks: [
            { column: "taskId", refTable: "Task" },
            { column: "memberId", refTable: "Member" },
        ],
    },
    {
        name: "TaskTag",
        naturalKey: ["taskId", "tagName"],
        fks: [{ column: "taskId", refTable: "Task" }],
    },
    {
        name: "TaskDependency",
        naturalKey: ["taskId", "dependsOnTaskId"],
        fks: [
            { column: "taskId", refTable: "Task" },
            { column: "dependsOnTaskId", refTable: "Task" },
        ],
    },
    {
        name: "TaskComment",
        fks: [
            { column: "taskId", refTable: "Task" },
            { column: "memberId", refTable: "Member" },
        ],
    },
    {
        name: "TaskActivityLog",
        fks: [
            { column: "taskId", refTable: "Task" },
            { column: "memberId", refTable: "Member" },
        ],
    },
    {
        name: "ProjectActivityLog",
        fks: [
            { column: "projectId", refTable: "Project" },
            { column: "taskId", refTable: "Task", optional: true },
            { column: "phaseId", refTable: "ProjectPhase", optional: true },
            { column: "memberId", refTable: "Member" },
        ],
    },
    {
        name: "ProjectScheduleSlot",
        fks: [
            { column: "projectId", refTable: "Project" },
            { column: "taskId", refTable: "Task", optional: true },
            { column: "memberId", refTable: "Member" },
            { column: "createdByMemberId", refTable: "Member", optional: true },
        ],
    },
    {
        name: "ProjectFolder",
        fks: [
            { column: "projectId", refTable: "Project" },
            { column: "createdByMemberId", refTable: "Member" },
        ],
    },
    {
        name: "ProjectFile",
        fks: [
            { column: "projectId", refTable: "Project" },
            { column: "folderId", refTable: "ProjectFolder", optional: true },
            { column: "uploadedByMemberId", refTable: "Member" },
        ],
    },
    {
        name: "ProjectFileComment",
        fks: [
            { column: "fileId", refTable: "ProjectFile" },
            { column: "memberId", refTable: "Member" },
        ],
    },
    {
        name: "ProjectPhoto",
        fks: [
            { column: "projectId", refTable: "Project" },
            { column: "uploadedByMemberId", refTable: "Member" },
        ],
    },
    {
        name: "Event",
        naturalKey: ["slug"],
        fks: [
            { column: "projectId", refTable: "Project", optional: true },
            { column: "projectTypeId", refTable: "ProjectType", optional: true },
            { column: "createdByMemberId", refTable: "Member" },
        ],
    },
    {
        name: "EventTier",
        naturalKey: ["eventId", "name"],
        fks: [{ column: "eventId", refTable: "Event" }],
    },
    {
        name: "EventCustomField",
        fks: [{ column: "eventId", refTable: "Event" }],
    },
    {
        name: "EventSession",
        fks: [{ column: "eventId", refTable: "Event" }],
    },
    {
        name: "EventTeam",
        naturalKey: ["eventId", "teamId"],
        fks: [
            { column: "eventId", refTable: "Event" },
            { column: "teamId", refTable: "Team" },
        ],
    },
    {
        name: "EventRegistration",
        naturalKey: ["confirmationCode"],
        fks: [
            { column: "eventId", refTable: "Event" },
            { column: "tierId", refTable: "EventTier", optional: true },
            { column: "memberId", refTable: "Member", optional: true },
        ],
    },
    {
        name: "EventRegistrationDay",
        naturalKey: ["registrationId", "eventDay"],
        fks: [{ column: "registrationId", refTable: "EventRegistration" }],
    },
    {
        name: "EventSessionAttendance",
        fks: [
            { column: "sessionId", refTable: "EventSession" },
            { column: "registrationId", refTable: "EventRegistration" },
        ],
    },
    {
        name: "EventSessionToken",
        naturalKey: ["token"],
        fks: [
            { column: "sessionId", refTable: "EventSession" },
            { column: "registrationId", refTable: "EventRegistration" },
        ],
    },
    {
        name: "EventRegistrationSession",
        naturalKey: ["registrationId", "sessionId"],
        fks: [
            { column: "registrationId", refTable: "EventRegistration" },
            { column: "sessionId", refTable: "EventSession" },
        ],
    },
    {
        name: "EventTask",
        fks: [
            { column: "eventId", refTable: "Event" },
            { column: "leaderId", refTable: "Member", optional: true },
            { column: "createdByMemberId", refTable: "Member", optional: true },
        ],
    },
    {
        name: "EventTaskAssignment",
        fks: [
            { column: "eventTaskId", refTable: "EventTask" },
            { column: "memberId", refTable: "Member" },
        ],
    },
    {
        name: "EventActivityLog",
        fks: [
            { column: "eventId", refTable: "Event" },
            { column: "eventTaskId", refTable: "EventTask", optional: true },
            { column: "memberId", refTable: "Member", optional: true },
        ],
    },
    {
        name: "EventFolder",
        fks: [
            { column: "eventId", refTable: "Event" },
            { column: "createdByMemberId", refTable: "Member" },
        ],
    },
    {
        name: "EventFile",
        fks: [
            { column: "eventId", refTable: "Event" },
            { column: "folderId", refTable: "EventFolder", optional: true },
            { column: "uploadedByMemberId", refTable: "Member" },
        ],
    },
    {
        name: "EventFileComment",
        fks: [
            { column: "fileId", refTable: "EventFile" },
            { column: "memberId", refTable: "Member" },
        ],
    },
    {
        name: "EventPhoto",
        fks: [
            { column: "eventId", refTable: "Event" },
            { column: "uploadedByMemberId", refTable: "Member" },
        ],
    },
    {
        name: "NotificationEvent",
        fks: [{ column: "actorMemberId", refTable: "Member", optional: true }],
    },
    {
        name: "Notification",
        naturalKey: ["memberId", "eventId"],
        fks: [
            { column: "memberId", refTable: "Member" },
            { column: "eventId", refTable: "NotificationEvent", optional: true },
        ],
    },
    {
        name: "PushSubscription",
        naturalKey: ["endpoint"],
        fks: [{ column: "memberId", refTable: "Member" }],
    },
    { name: "SitePage", idType: "string", naturalKey: ["id"] },
    { name: "AboutSection" },
    {
        name: "AboutSponsor",
        fks: [{ column: "sectionId", refTable: "AboutSection" }],
    },
    { name: "ContactMethod" },
    { name: "SocialLink" },
    { name: "SupportNoticeBlock" },
    { name: "IncidentReportType", naturalKey: ["slug"] },
    {
        name: "IncidentReportField",
        fks: [{ column: "formId", refTable: "IncidentReportType" }],
    },
    {
        name: "IncidentReport",
        fks: [{ column: "submitterMemberId", refTable: "Member", optional: true }],
    },
    { name: "FinanceAccount" },
    {
        name: "FinanceTransaction",
        fks: [
            { column: "accountId", refTable: "FinanceAccount" },
            { column: "createdByMemberId", refTable: "Member", optional: true },
        ],
    },
    {
        name: "FinanceLiability",
        fks: [{ column: "accountId", refTable: "FinanceAccount" }],
    },
    {
        name: "FinanceScheduledItem",
        fks: [{ column: "accountId", refTable: "FinanceAccount" }],
    },
    { name: "CertificateTemplate" },
    {
        name: "Certificate",
        naturalKey: ["verificationCode"],
        fks: [
            { column: "templateId", refTable: "CertificateTemplate", optional: true },
            { column: "eventId", refTable: "Event", optional: true },
            { column: "projectId", refTable: "Project", optional: true },
            { column: "recipientMemberId", refTable: "Member", optional: true },
        ],
    },
    {
        name: "DocumentCategory",
        fks: [{ column: "scopeTeamId", refTable: "Team", optional: true }],
    },
    {
        name: "Document",
        fks: [
            { column: "categoryId", refTable: "DocumentCategory", optional: true },
            { column: "scopeTeamId", refTable: "Team", optional: true },
            { column: "uploadedById", refTable: "Member" },
        ],
    },
    {
        name: "DocumentCategoryAccessGrant",
        fks: [
            { column: "categoryId", refTable: "DocumentCategory" },
            { column: "memberId", refTable: "Member", optional: true },
            { column: "teamId", refTable: "Team", optional: true },
            { column: "grantedById", refTable: "Member" },
            { column: "revokedById", refTable: "Member", optional: true },
        ],
    },
    {
        name: "DocumentCategoryAccessLog",
        fks: [
            { column: "categoryId", refTable: "DocumentCategory" },
            { column: "memberId", refTable: "Member" },
        ],
    },
    {
        name: "DocumentCategoryAccessRequest",
        fks: [
            { column: "categoryId", refTable: "DocumentCategory" },
            { column: "memberId", refTable: "Member" },
            { column: "reviewedById", refTable: "Member", optional: true },
        ],
    },
    {
        name: "DocumentAccessGrant",
        fks: [
            { column: "documentId", refTable: "Document" },
            { column: "memberId", refTable: "Member", optional: true },
            { column: "teamId", refTable: "Team", optional: true },
            { column: "grantedById", refTable: "Member" },
            { column: "revokedById", refTable: "Member", optional: true },
        ],
    },
    {
        name: "DocumentAccessRequest",
        fks: [
            { column: "documentId", refTable: "Document" },
            { column: "memberId", refTable: "Member" },
            { column: "reviewedById", refTable: "Member", optional: true },
        ],
    },
    {
        name: "DocumentAccessLog",
        fks: [
            { column: "documentId", refTable: "Document" },
            { column: "memberId", refTable: "Member" },
        ],
    },
    {
        name: "Announcement",
        fks: [
            { column: "createdByMemberId", refTable: "Member" },
            { column: "eventId", refTable: "Event", optional: true },
            { column: "projectId", refTable: "Project", optional: true },
        ],
    },
    {
        name: "AnnouncementResponse",
        naturalKey: ["announcementId", "memberId"],
        fks: [
            { column: "announcementId", refTable: "Announcement" },
            { column: "memberId", refTable: "Member" },
        ],
    },
    {
        name: "AnnouncementResponsePeriod",
        fks: [{ column: "responseId", refTable: "AnnouncementResponse" }],
    },
    {
        name: "UsageEvent",
        fks: [{ column: "memberId", refTable: "Member", optional: true }],
    },
];

function parseHost(connectionString: string): string {
    const normalized = connectionString.replace(/^postgresql:/i, "http:");
    return new URL(normalized).hostname.toLowerCase();
}

function assertEnv(): { localUrl: string; remoteUrl: string; dryRun: boolean } {
    const localUrl = process.env.DATABASE_URL?.trim();
    const remoteUrl = process.env.SUPABASE_DATABASE_URL?.trim();
    const dryRun = process.argv.includes("--dry-run");

    if (!localUrl) {
        throw new Error("DATABASE_URL is not set. Point it at local Postgres before merging.");
    }
    if (!remoteUrl) {
        throw new Error(
            "SUPABASE_DATABASE_URL is not set. Set it to the production Postgres URL (read-only use preferred), then re-run.",
        );
    }

    const localHost = parseHost(localUrl);
    if (localHost.includes("supabase")) {
        throw new Error(
            `Refusing merge: DATABASE_URL host "${localHost}" looks like Supabase. Keep DATABASE_URL on local Postgres and put production in SUPABASE_DATABASE_URL.`,
        );
    }
    if (!LOCAL_HOSTS.has(localHost) && !localHost.endsWith(".local")) {
        throw new Error(
            `Refusing merge: DATABASE_URL host "${localHost}" does not look local (expected localhost / 127.0.0.1 / host.docker.internal).`,
        );
    }

    if (localUrl === remoteUrl) {
        throw new Error("DATABASE_URL and SUPABASE_DATABASE_URL must be different connections.");
    }

    return { localUrl, remoteUrl, dryRun };
}

function qIdent(name: string): string {
    return `"${name.replace(/"/g, '""')}"`;
}

function emptyCounts(): Counts {
    return { remote: 0, inserted: 0, skipped: 0, conflicts: 0, missingParent: 0 };
}

function remapFks(
    row: QueryResultRow,
    spec: TableSpec,
    idMaps: Map<string, Map<string | number, string | number>>,
): { ok: true; data: QueryResultRow } | { ok: false; reason: "missingParent" } {
    const data: QueryResultRow = { ...row };
    for (const fk of spec.fks ?? []) {
        const remoteVal = data[fk.column];
        if (remoteVal == null) continue;
        const map = idMaps.get(fk.refTable);
        const localVal = map?.get(remoteVal as string | number);
        if (localVal === undefined) {
            if (fk.optional) {
                data[fk.column] = null;
            } else {
                return { ok: false, reason: "missingParent" };
            }
        } else {
            data[fk.column] = localVal;
        }
    }
    for (const col of spec.selfFks ?? []) {
        // Cleared on insert; patched after table map is filled.
        data[col] = null;
    }
    return { ok: true, data };
}

async function findByNaturalKey(
    client: PoolClient,
    spec: TableSpec,
    data: QueryResultRow,
): Promise<string | number | null> {
    const keys = spec.naturalKey;
    if (!keys?.length) return null;

    // Nulls never match under SQL UNIQUE / = (e.g. optional slug, nullable eventId).
    if (keys.some((k) => data[k] == null)) return null;

    const clauses = keys.map((k, i) => `${qIdent(k)} = $${i + 1}`);
    const values = keys.map((k) => data[k]);
    const idCol = spec.idColumn ?? "id";
    const sql = `SELECT ${qIdent(idCol)} AS id FROM ${qIdent(spec.name)} WHERE ${clauses.join(" AND ")} LIMIT 1`;
    const result = await client.query(sql, values);
    return result.rows[0]?.id ?? null;
}

/**
 * node-pg treats JS arrays as Postgres array literals. Json/jsonb columns that
 * hold arrays or objects must be sent as JSON text instead.
 */
function serializeParam(value: unknown): unknown {
    if (value === null || value === undefined) return value;
    if (value instanceof Date || Buffer.isBuffer(value)) return value;
    if (typeof value === "object") return JSON.stringify(value);
    return value;
}

async function insertRow(
    client: PoolClient,
    spec: TableSpec,
    data: QueryResultRow,
): Promise<string | number> {
    const idCol = spec.idColumn ?? "id";
    const idType = spec.idType ?? "int";
    const columns = Object.keys(data).filter((c) => (idType === "int" ? c !== idCol : true));
    const colsSql = columns.map(qIdent).join(", ");
    const params = columns.map((_, i) => `$${i + 1}`);
    const values = columns.map((c) => serializeParam(data[c]));

    if (idType === "string") {
        const sql = `INSERT INTO ${qIdent(spec.name)} (${colsSql}) VALUES (${params.join(", ")}) RETURNING ${qIdent(idCol)} AS id`;
        const result = await client.query(sql, values);
        return result.rows[0].id;
    }

    const sql = `INSERT INTO ${qIdent(spec.name)} (${colsSql}) VALUES (${params.join(", ")}) RETURNING ${qIdent(idCol)} AS id`;
    const result = await client.query(sql, values);
    return result.rows[0].id as number;
}

async function patchSelfFks(
    client: PoolClient,
    spec: TableSpec,
    remoteRows: QueryResultRow[],
    idMap: Map<string | number, string | number>,
    dryRun: boolean,
): Promise<void> {
    const selfFks = spec.selfFks;
    if (!selfFks?.length) return;
    const idCol = spec.idColumn ?? "id";

    for (const remote of remoteRows) {
        const localId = idMap.get(remote[idCol] as string | number);
        if (localId === undefined) continue;

        const updates: string[] = [];
        const values: unknown[] = [];
        for (const col of selfFks) {
            const remoteParent = remote[col];
            if (remoteParent == null) continue;
            const localParent = idMap.get(remoteParent as string | number);
            if (localParent === undefined) continue;
            values.push(localParent);
            updates.push(`${qIdent(col)} = $${values.length}`);
        }
        if (!updates.length || dryRun) continue;
        values.push(localId);
        await client.query(
            `UPDATE ${qIdent(spec.name)} SET ${updates.join(", ")} WHERE ${qIdent(idCol)} = $${values.length}`,
            values,
        );
    }
}

async function bumpSequence(client: PoolClient, table: string, idColumn: string): Promise<void> {
    // Prisma tables are mixed-case; pg_get_serial_sequence needs a quoted regclass text.
    const seqResult = await client.query<{ seq: string | null }>(
        `SELECT pg_get_serial_sequence($1, $2) AS seq`,
        [`public."${table}"`, idColumn],
    );
    const seq = seqResult.rows[0]?.seq;
    if (!seq) return;
    await client.query(
        `SELECT setval($1::regclass, (SELECT COALESCE(MAX(${qIdent(idColumn)}), 1) FROM ${qIdent(table)}))`,
        [seq],
    );
}

async function mergeTable(
    remote: PoolClient,
    local: PoolClient,
    spec: TableSpec,
    idMaps: Map<string, Map<string | number, string | number>>,
    dryRun: boolean,
    dryRunSeq: { next: number },
): Promise<Counts> {
    const counts = emptyCounts();
    const idCol = spec.idColumn ?? "id";
    const idType = spec.idType ?? "int";
    const idMap = new Map<string | number, string | number>();
    idMaps.set(spec.name, idMap);

    const remoteResult = await remote.query(`SELECT * FROM ${qIdent(spec.name)}`);
    const remoteRows = remoteResult.rows as QueryResultRow[];
    counts.remote = remoteRows.length;

    for (const remoteRow of remoteRows) {
        const remoteId = remoteRow[idCol] as string | number;
        const remapped = remapFks(remoteRow, spec, idMaps);
        if (!remapped.ok) {
            counts.missingParent++;
            continue;
        }
        const data = remapped.data;

        try {
            const existingId = await findByNaturalKey(local, spec, data);
            if (existingId != null) {
                idMap.set(remoteId, existingId);
                counts.skipped++;
                continue;
            }

            if (dryRun) {
                if (idType === "string") {
                    idMap.set(remoteId, data[idCol] as string);
                } else {
                    idMap.set(remoteId, dryRunSeq.next--);
                }
                counts.inserted++;
                continue;
            }

            const newId = await insertRow(local, spec, data);
            idMap.set(remoteId, newId);
            counts.inserted++;
        } catch (err: unknown) {
            const code = (err as { code?: string })?.code;
            if (code === "23505") {
                // Unique violation without natural-key match (e.g. Member phone collision).
                counts.conflicts++;
                continue;
            }
            throw err;
        }
    }

    await patchSelfFks(local, spec, remoteRows, idMap, dryRun);
    return counts;
}

function printReport(
    dryRun: boolean,
    byTable: Map<string, Counts>,
): void {
    const mode = dryRun ? "DRY-RUN" : "MERGE";
    console.log(`\n=== ${mode} report ===\n`);
    console.log(
        `${"Table".padEnd(32)} ${"Remote".padStart(7)} ${"Insert".padStart(7)} ${"Skip".padStart(7)} ${"Conflict".padStart(9)} ${"NoParent".padStart(9)}`,
    );
    console.log("-".repeat(74));

    const totals = emptyCounts();
    for (const [name, c] of byTable) {
        if (c.remote === 0 && c.inserted === 0 && c.skipped === 0 && c.conflicts === 0 && c.missingParent === 0) {
            continue;
        }
        console.log(
            `${name.padEnd(32)} ${String(c.remote).padStart(7)} ${String(c.inserted).padStart(7)} ${String(c.skipped).padStart(7)} ${String(c.conflicts).padStart(9)} ${String(c.missingParent).padStart(9)}`,
        );
        totals.remote += c.remote;
        totals.inserted += c.inserted;
        totals.skipped += c.skipped;
        totals.conflicts += c.conflicts;
        totals.missingParent += c.missingParent;
    }
    console.log("-".repeat(74));
    console.log(
        `${"TOTAL".padEnd(32)} ${String(totals.remote).padStart(7)} ${String(totals.inserted).padStart(7)} ${String(totals.skipped).padStart(7)} ${String(totals.conflicts).padStart(9)} ${String(totals.missingParent).padStart(9)}`,
    );
    if (dryRun) {
        console.log("\nNo rows were written (dry-run). Re-run without --dry-run after backing up local with pg_dump.");
    } else {
        console.log("\nSequences bumped. Local data preserved; remote rows merged beside it.");
    }
}

async function main(): Promise<void> {
    const { localUrl, remoteUrl, dryRun } = assertEnv();
    console.log(dryRun ? "Mode: dry-run (no writes)" : "Mode: real merge (will write to local)");
    console.log(`Local:    ${parseHost(localUrl)}`);
    console.log(`Supabase: ${parseHost(remoteUrl)}`);

    const remotePool = new Pool({ connectionString: remoteUrl, max: 2 });
    const localPool = new Pool({ connectionString: localUrl, max: 2 });

    const remote = await remotePool.connect();
    const local = await localPool.connect();
    const idMaps = new Map<string, Map<string | number, string | number>>();
    const byTable = new Map<string, Counts>();
    const dryRunSeq = { next: -1 };

    try {
        if (!dryRun) {
            await local.query("BEGIN");
        }

        for (const spec of TABLES) {
            process.stdout.write(`Processing ${spec.name}...`);
            try {
                const counts = await mergeTable(remote, local, spec, idMaps, dryRun, dryRunSeq);
                byTable.set(spec.name, counts);
                console.log(
                    ` remote=${counts.remote} insert=${counts.inserted} skip=${counts.skipped} conflict=${counts.conflicts} noParent=${counts.missingParent}`,
                );
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                // Table missing on one side (older schema) — skip with warning.
                if (/does not exist/i.test(msg)) {
                    console.log(` skipped (table missing: ${msg.split("\n")[0]})`);
                    byTable.set(spec.name, emptyCounts());
                    continue;
                }
                throw err;
            }
        }

        if (!dryRun) {
            for (const spec of TABLES) {
                if ((spec.idType ?? "int") !== "int") continue;
                await bumpSequence(local, spec.name, spec.idColumn ?? "id");
            }
            await local.query("COMMIT");
        }

        printReport(dryRun, byTable);
    } catch (err) {
        if (!dryRun) {
            try {
                await local.query("ROLLBACK");
            } catch {
                /* ignore */
            }
        }
        throw err;
    } finally {
        remote.release();
        local.release();
        await remotePool.end();
        await localPool.end();
    }
}

main().catch((err) => {
    console.error("\nmergeFromSupabase failed:", err instanceof Error ? err.message : err);
    process.exit(1);
});
