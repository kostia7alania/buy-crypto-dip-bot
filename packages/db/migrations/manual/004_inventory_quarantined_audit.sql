-- Read-only inventory for legacy audit evidence after migrations 0009-0013.
-- V0 rows are retained as immutable evidence and excluded from tenant feeds.

SELECT
  schema_version,
  coalesce(scope, 'UNCLASSIFIED') AS scope,
  entity_type,
  action,
  count(*) AS event_count,
  min(created_at) AS oldest_event_at,
  max(created_at) AS newest_event_at
FROM audit_events
WHERE schema_version = 0
GROUP BY schema_version, coalesce(scope, 'UNCLASSIFIED'), entity_type, action
ORDER BY entity_type, action;

SELECT
  count(*) FILTER (WHERE schema_version = 0) AS quarantined_v0_events,
  count(*) FILTER (WHERE schema_version = 1) AS validated_v1_events
FROM audit_events;
