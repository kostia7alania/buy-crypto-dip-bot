import {
  type AuditActor,
  type AuditEventV1,
  assertAuditEventV1,
} from "@buy-crypto-dip-bot/shared-types";

export const auditEventRow = (event: AuditEventV1) => {
  assertAuditEventV1(event);
  return {
    schemaVersion: event.schemaVersion,
    userId: event.userId,
    scope: event.scope,
    actorKind: event.actor.kind,
    actorChannel: event.actor.channel,
    actorUserId: event.actor.kind === "USER" ? event.actor.userId : null,
    entityType: event.subject.type.toLowerCase(),
    entityId: event.subject.id,
    action: event.type,
    reasonCode: event.reasonCode,
    correlationId: event.correlationId,
    payloadClass: event.payloadClass,
    payload: event.payload,
  };
};

export interface AuditEventRowLike {
  schemaVersion: number;
  userId: string | null;
  scope: string | null;
  actorKind: string | null;
  actorChannel: string | null;
  actorUserId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  reasonCode: string | null;
  correlationId: string | null;
  payloadClass: string | null;
  payload: unknown;
}

const actorFromRow = (row: AuditEventRowLike): AuditActor | null => {
  if (
    row.actorKind === "USER" &&
    (row.actorChannel === "WEB" || row.actorChannel === "TELEGRAM") &&
    row.actorUserId
  ) {
    return {
      kind: "USER",
      channel: row.actorChannel,
      userId: row.actorUserId,
    };
  }
  if (
    row.actorKind === "SYSTEM" &&
    (row.actorChannel === "API" ||
      row.actorChannel === "RUNNER" ||
      row.actorChannel === "MIGRATOR")
  ) {
    return { kind: "SYSTEM", channel: row.actorChannel };
  }
  if (
    row.actorKind === "ANONYMOUS" &&
    (row.actorChannel === "WEB" || row.actorChannel === "TELEGRAM")
  ) {
    return { kind: "ANONYMOUS", channel: row.actorChannel };
  }
  return null;
};

export const auditEventFromRow = (
  row: AuditEventRowLike,
): AuditEventV1 | null => {
  if (row.schemaVersion !== 1) return null;
  const actor = actorFromRow(row);
  if (!actor) return null;

  const event: unknown = {
    schemaVersion: row.schemaVersion,
    type: row.action,
    scope: row.scope,
    userId: row.userId,
    actor,
    reasonCode: row.reasonCode,
    correlationId: row.correlationId,
    subject: {
      type: row.entityType.toUpperCase(),
      id: row.entityId,
    },
    payloadClass: row.payloadClass,
    payload: row.payload,
  };

  try {
    assertAuditEventV1(event);
    return event;
  } catch {
    return null;
  }
};
