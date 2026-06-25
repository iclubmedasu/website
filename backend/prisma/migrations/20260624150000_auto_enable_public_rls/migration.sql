-- Catch up: enable RLS on all existing public tables (app tables + _prisma_migrations).
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- Auto-enable RLS on every future CREATE TABLE in public.
CREATE OR REPLACE FUNCTION public.auto_enable_rls_on_public_table()
RETURNS event_trigger
LANGUAGE plpgsql
AS $$
DECLARE obj record;
DECLARE table_name text;
BEGIN
  FOR obj IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag = 'CREATE TABLE'
      AND schema_name = 'public'
  LOOP
    table_name := trim(both '"' from split_part(obj.object_identity, '.', 2));
    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
      table_name
    );
  END LOOP;
END;
$$;

DROP EVENT TRIGGER IF EXISTS auto_enable_public_rls_on_create_table;
CREATE EVENT TRIGGER auto_enable_public_rls_on_create_table
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE')
  EXECUTE FUNCTION public.auto_enable_rls_on_public_table();
