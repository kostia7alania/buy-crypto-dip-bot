export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export const fetchAuditLogs = () => $fetch<AuditLog[]>("/api/audit");
