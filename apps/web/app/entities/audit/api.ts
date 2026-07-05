import type { AuditLog } from "./types.js";

export const fetchAuditLogs = () => $fetch<AuditLog[]>("/api/audit");
