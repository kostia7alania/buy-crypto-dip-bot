-- The one-shot migrator provisions LOGIN/password after this migration succeeds.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dipbot_runtime') THEN
    CREATE ROLE dipbot_runtime
      NOLOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      NOBYPASSRLS
      NOINHERIT;
  END IF;

  -- A role already provisioned for another database may retain its LOGIN/password.
  IF EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'dipbot_runtime'
      AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication
        OR rolbypassrls OR rolinherit)
  ) OR EXISTS (
    SELECT 1 FROM pg_auth_members
    WHERE member = (SELECT oid FROM pg_roles WHERE rolname = 'dipbot_runtime')
      AND (roleid <> (SELECT oid FROM pg_roles WHERE rolname = 'dipbot_app')
        OR admin_option)
  ) OR EXISTS (
    SELECT 1 FROM pg_shdepend
    WHERE refclassid = 'pg_catalog.pg_authid'::regclass
      AND refobjid = (SELECT oid FROM pg_roles WHERE rolname = 'dipbot_runtime')
      AND deptype = 'o'
  ) THEN
    RAISE EXCEPTION 'MIGRATION_RUNTIME_ROLE_UNSAFE';
  END IF;
END
$$;
--> statement-breakpoint
GRANT dipbot_app TO dipbot_runtime WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;
--> statement-breakpoint
DO $$
BEGIN
  EXECUTE format('REVOKE CREATE, TEMPORARY ON DATABASE %I FROM PUBLIC', current_database());
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM dipbot_runtime', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO dipbot_runtime', current_database());
END
$$;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public, drizzle FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON SCHEMA public, drizzle FROM dipbot_runtime;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public, drizzle TO dipbot_runtime;
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA public, drizzle FROM PUBLIC, dipbot_runtime;
--> statement-breakpoint
-- Table-level REVOKE does not remove existing column privileges.
DO $$
DECLARE relation record;
BEGIN
  FOR relation IN
    SELECT format('%I.%I', n.nspname, c.relname) AS qualified_name,
      string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum) AS column_list
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'drizzle')
      AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND a.attnum > 0 AND NOT a.attisdropped AND a.attacl IS NOT NULL
    GROUP BY n.nspname, c.relname
  LOOP
    EXECUTE format('REVOKE ALL (%s) ON TABLE %s FROM PUBLIC, dipbot_runtime',
      relation.column_list, relation.qualified_name);
  END LOOP;
END
$$;
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE public.users TO dipbot_runtime;
--> statement-breakpoint
GRANT UPDATE (telegram_chat_id, notification_enabled_at, username, first_name)
  ON TABLE public.users TO dipbot_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON TABLE public.api_sessions TO dipbot_runtime;
--> statement-breakpoint
GRANT UPDATE (last_used_at, revoked_at) ON TABLE public.api_sessions TO dipbot_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON TABLE public.telegram_login_presentations TO dipbot_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON TABLE public.telegram_login_abuse_limits TO dipbot_runtime;
--> statement-breakpoint
GRANT UPDATE (window_started_at, attempt_count, blocked_until, updated_at)
  ON TABLE public.telegram_login_abuse_limits TO dipbot_runtime;
--> statement-breakpoint
-- The invoker users_personal_tenant trigger provisions these compatibility rows.
GRANT SELECT, INSERT ON TABLE public.auth_identities, public.tenants,
  public.tenant_memberships TO dipbot_runtime;
--> statement-breakpoint
GRANT UPDATE (profile, updated_at) ON TABLE public.auth_identities TO dipbot_runtime;
--> statement-breakpoint
GRANT UPDATE (personal_owner_user_id) ON TABLE public.tenants TO dipbot_runtime;
--> statement-breakpoint
GRANT SELECT ON TABLE public.strategies, public.orders, public.order_reservations
  TO dipbot_runtime;
--> statement-breakpoint
-- Delivery metadata updates still execute the invoker ownership/reservation guards.
GRANT UPDATE (tg_message_id) ON TABLE public.orders TO dipbot_runtime;
--> statement-breakpoint
GRANT INSERT ON TABLE public.audit_events TO dipbot_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE public.notification_outbox TO dipbot_runtime;
--> statement-breakpoint
GRANT UPDATE (status, attempt_count, next_attempt_at, last_error_code,
  telegram_message_id, delivered_at, updated_at)
  ON TABLE public.notification_outbox TO dipbot_runtime;
--> statement-breakpoint
GRANT SELECT ON TABLE drizzle.__drizzle_migrations, drizzle.__dipbot_convergence,
  drizzle.__dipbot_forward_migrations TO dipbot_runtime;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.dipbot_set_owned_tenant(),
  public.dipbot_provision_personal_tenant(), public.dipbot_guard_reserved_order_evidence()
  TO dipbot_runtime;
--> statement-breakpoint
-- Trusted policies must stop applying after SET LOCAL ROLE dipbot_app.
CREATE POLICY tenants_runtime_select ON public.tenants FOR SELECT TO dipbot_runtime
  USING (current_user = 'dipbot_runtime');
--> statement-breakpoint
CREATE POLICY tenants_runtime_insert ON public.tenants FOR INSERT TO dipbot_runtime
  WITH CHECK (current_user = 'dipbot_runtime' AND kind = 'personal'
    AND personal_owner_user_id IS NOT NULL);
--> statement-breakpoint
CREATE POLICY tenants_runtime_update ON public.tenants FOR UPDATE TO dipbot_runtime
  USING (current_user = 'dipbot_runtime' AND kind = 'personal')
  WITH CHECK (current_user = 'dipbot_runtime' AND kind = 'personal'
    AND personal_owner_user_id IS NOT NULL);
--> statement-breakpoint
CREATE POLICY tenant_memberships_runtime_select ON public.tenant_memberships
  FOR SELECT TO dipbot_runtime USING (current_user = 'dipbot_runtime');
--> statement-breakpoint
CREATE POLICY tenant_memberships_runtime_insert ON public.tenant_memberships
  FOR INSERT TO dipbot_runtime
  WITH CHECK (current_user = 'dipbot_runtime' AND role = 'owner');
--> statement-breakpoint
CREATE POLICY strategies_runtime_select ON public.strategies FOR SELECT TO dipbot_runtime
  USING (current_user = 'dipbot_runtime');
--> statement-breakpoint
CREATE POLICY orders_runtime_select ON public.orders FOR SELECT TO dipbot_runtime
  USING (current_user = 'dipbot_runtime');
--> statement-breakpoint
CREATE POLICY orders_runtime_update ON public.orders FOR UPDATE TO dipbot_runtime
  USING (current_user = 'dipbot_runtime')
  WITH CHECK (current_user = 'dipbot_runtime');
--> statement-breakpoint
CREATE POLICY order_reservations_runtime_select ON public.order_reservations
  FOR SELECT TO dipbot_runtime USING (current_user = 'dipbot_runtime');
--> statement-breakpoint
CREATE POLICY audit_events_runtime_insert ON public.audit_events FOR INSERT TO dipbot_runtime
  WITH CHECK (current_user = 'dipbot_runtime');
--> statement-breakpoint
CREATE POLICY notification_outbox_runtime_select ON public.notification_outbox
  FOR SELECT TO dipbot_runtime USING (current_user = 'dipbot_runtime');
--> statement-breakpoint
CREATE POLICY notification_outbox_runtime_insert ON public.notification_outbox
  FOR INSERT TO dipbot_runtime WITH CHECK (current_user = 'dipbot_runtime');
--> statement-breakpoint
CREATE POLICY notification_outbox_runtime_update ON public.notification_outbox
  FOR UPDATE TO dipbot_runtime
  USING (current_user = 'dipbot_runtime')
  WITH CHECK (current_user = 'dipbot_runtime');
