ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_v1_envelope_check";--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_v1_envelope_check" CHECK ("audit_events"."schema_version" = 0 OR (
        "audit_events"."schema_version" = 1
        AND "audit_events"."scope" IS NOT NULL
        AND "audit_events"."scope" IN ('USER', 'SYSTEM')
        AND (
          ("audit_events"."scope" = 'USER' AND "audit_events"."user_id" IS NOT NULL)
          OR ("audit_events"."scope" = 'SYSTEM' AND "audit_events"."user_id" IS NULL)
        )
        AND "audit_events"."actor_kind" IS NOT NULL
        AND "audit_events"."actor_kind" IN ('USER', 'SYSTEM', 'ANONYMOUS')
        AND "audit_events"."actor_channel" IS NOT NULL
        AND "audit_events"."actor_channel" IN ('WEB', 'TELEGRAM', 'API', 'RUNNER', 'MIGRATOR')
        AND (
          ("audit_events"."actor_kind" = 'USER' AND "audit_events"."actor_user_id" IS NOT NULL AND "audit_events"."actor_user_id" = "audit_events"."user_id")
          OR ("audit_events"."actor_kind" IN ('SYSTEM', 'ANONYMOUS') AND "audit_events"."actor_user_id" IS NULL)
        )
        AND "audit_events"."reason_code" IS NOT NULL
        AND "audit_events"."action" IN (
          'AUTH_LOGIN_SUCCEEDED',
          'AUTH_LOGIN_REJECTED',
          'SESSION_REVOKED',
          'NOTIFICATION_BINDING_VERIFIED',
          'STRATEGY_CREATED',
          'STRATEGY_UPDATED',
          'STRATEGIES_BULK_PAUSED',
          'STRATEGIES_BULK_RESUMED',
          'RISK_DECISION_REJECTED',
          'RISK_DECISION_APPROVED',
          'PENDING_ORDER_DUPLICATE_SUPPRESSED',
          'DRY_RUN_ORDER_COMPLETED',
          'DRY_RUN_ORDER_CANCELLED'
        )
        AND "audit_events"."correlation_id" IS NOT NULL
        AND "audit_events"."correlation_id" ~ '^[A-Za-z0-9_-]{8,80}$'
        AND "audit_events"."payload_class" IS NOT NULL
        AND "audit_events"."payload_class" IN ('SECURITY', 'TENANT_CONFIGURATION', 'TENANT_FINANCIAL', 'OPERATIONAL')
        AND jsonb_typeof("audit_events"."payload") = 'object'
        AND octet_length("audit_events"."payload"::text) <= 8192
      ));