import type { AuditEventV1 } from "@buy-crypto-dip-bot/shared-types";

export type AuditLog = AuditEventV1 & {
  id: string;
  createdAt: string;
};
