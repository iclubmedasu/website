-- Prisma's internal migration bookkeeping table.
-- Enabling RLS here removes the Supabase warning without changing app data access.

ALTER TABLE IF EXISTS "_prisma_migrations" ENABLE ROW LEVEL SECURITY;