-- Deduplicate active registrations by event + email (keep oldest)
WITH email_duplicates AS (
    SELECT
        id,
        "eventId",
        lower(email) AS email_key,
        ROW_NUMBER() OVER (
            PARTITION BY "eventId", lower(email)
            ORDER BY "createdAt" ASC, id ASC
        ) AS rn
    FROM "EventRegistration"
    WHERE status <> 'CANCELLED'
),
email_keepers AS (
    SELECT id AS keeper_id, "eventId", email_key
    FROM email_duplicates
    WHERE rn = 1
),
email_losers AS (
    SELECT d.id AS loser_id, k.keeper_id
    FROM email_duplicates d
    INNER JOIN email_keepers k
        ON k."eventId" = d."eventId" AND k.email_key = d.email_key
    WHERE d.rn > 1
)
INSERT INTO "EventRegistrationDay" ("registrationId", "eventDay", "checkedInAt")
SELECT l.keeper_id, erd."eventDay", erd."checkedInAt"
FROM "EventRegistrationDay" erd
INNER JOIN email_losers l ON l.loser_id = erd."registrationId"
ON CONFLICT ("registrationId", "eventDay") DO NOTHING;

WITH email_duplicates AS (
    SELECT
        id,
        "eventId",
        lower(email) AS email_key,
        ROW_NUMBER() OVER (
            PARTITION BY "eventId", lower(email)
            ORDER BY "createdAt" ASC, id ASC
        ) AS rn
    FROM "EventRegistration"
    WHERE status <> 'CANCELLED'
),
email_keepers AS (
    SELECT id AS keeper_id, "eventId", email_key
    FROM email_duplicates
    WHERE rn = 1
),
email_losers AS (
    SELECT d.id AS loser_id
    FROM email_duplicates d
    INNER JOIN email_keepers k
        ON k."eventId" = d."eventId" AND k.email_key = d.email_key
    WHERE d.rn > 1
)
DELETE FROM "EventRegistration"
WHERE id IN (SELECT loser_id FROM email_losers);

-- Deduplicate active registrations by event + memberId (keep oldest)
WITH member_duplicates AS (
    SELECT
        id,
        "eventId",
        "memberId",
        ROW_NUMBER() OVER (
            PARTITION BY "eventId", "memberId"
            ORDER BY "createdAt" ASC, id ASC
        ) AS rn
    FROM "EventRegistration"
    WHERE status <> 'CANCELLED' AND "memberId" IS NOT NULL
),
member_keepers AS (
    SELECT id AS keeper_id, "eventId", "memberId"
    FROM member_duplicates
    WHERE rn = 1
),
member_losers AS (
    SELECT d.id AS loser_id, k.keeper_id
    FROM member_duplicates d
    INNER JOIN member_keepers k
        ON k."eventId" = d."eventId" AND k."memberId" = d."memberId"
    WHERE d.rn > 1
)
INSERT INTO "EventRegistrationDay" ("registrationId", "eventDay", "checkedInAt")
SELECT l.keeper_id, erd."eventDay", erd."checkedInAt"
FROM "EventRegistrationDay" erd
INNER JOIN member_losers l ON l.loser_id = erd."registrationId"
ON CONFLICT ("registrationId", "eventDay") DO NOTHING;

WITH member_duplicates AS (
    SELECT
        id,
        "eventId",
        "memberId",
        ROW_NUMBER() OVER (
            PARTITION BY "eventId", "memberId"
            ORDER BY "createdAt" ASC, id ASC
        ) AS rn
    FROM "EventRegistration"
    WHERE status <> 'CANCELLED' AND "memberId" IS NOT NULL
),
member_keepers AS (
    SELECT id AS keeper_id, "eventId", "memberId"
    FROM member_duplicates
    WHERE rn = 1
),
member_losers AS (
    SELECT d.id AS loser_id
    FROM member_duplicates d
    INNER JOIN member_keepers k
        ON k."eventId" = d."eventId" AND k."memberId" = d."memberId"
    WHERE d.rn > 1
)
DELETE FROM "EventRegistration"
WHERE id IN (SELECT loser_id FROM member_losers);

CREATE UNIQUE INDEX "EventRegistration_eventId_email_active_key"
    ON "EventRegistration" ("eventId", "email")
    WHERE status <> 'CANCELLED';

CREATE UNIQUE INDEX "EventRegistration_eventId_memberId_active_key"
    ON "EventRegistration" ("eventId", "memberId")
    WHERE "memberId" IS NOT NULL AND status <> 'CANCELLED';
