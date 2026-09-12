import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const REQUIRED_COUNTS = [
  "ownerlessStrategies",
  "ownerlessOrders",
  "ordersWithoutStrategy",
  "mismatchedOrders",
  "orphanedOrders",
  "duplicateStrategies",
  "invalidStrategyModes",
  "invalidOrderModes",
];

const REQUIRED_KEYS = [
  "recordVersion",
  "decisionId",
  "environmentLabel",
  "sourceCatalog",
  "targetCatalog",
  "verificationReportSha256",
  "counts",
  "unresolvedItems",
  "backup",
  "auditHistoryDisposition",
  "approver",
];

const fail = (code) => {
  throw new Error(`LEGACY_DECISION_INVALID:${code}`);
};

const plainObject = (value, code) => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail(code);
  }
  return value;
};

const exactKeys = (value, expected, code) => {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index])
  ) {
    fail(code);
  }
};

const nonEmpty = (value, code) => {
  if (typeof value !== "string" || value.trim().length === 0) fail(code);
};

const isoDate = (value, code) => {
  nonEmpty(value, code);
  if (Number.isNaN(Date.parse(value)) || !value.endsWith("Z")) fail(code);
};

export const validateLegacyDecision = (input) => {
  const record = plainObject(input, "RECORD");
  exactKeys(record, REQUIRED_KEYS, "RECORD_KEYS");
  if (record.recordVersion !== 1) fail("VERSION");
  if (
    typeof record.decisionId !== "string" ||
    !/^[a-z0-9][a-z0-9_-]{7,79}$/.test(record.decisionId)
  ) {
    fail("DECISION_ID");
  }
  nonEmpty(record.environmentLabel, "ENVIRONMENT_LABEL");
  nonEmpty(record.sourceCatalog, "SOURCE_CATALOG");
  nonEmpty(record.targetCatalog, "TARGET_CATALOG");
  if (!/^[0-9a-f]{64}$/.test(record.verificationReportSha256)) {
    fail("VERIFICATION_DIGEST");
  }

  const counts = plainObject(record.counts, "COUNTS");
  exactKeys(counts, REQUIRED_COUNTS, "COUNT_KEYS");
  for (const key of REQUIRED_COUNTS) {
    if (!Number.isInteger(counts[key]) || counts[key] < 0) fail("COUNT_VALUE");
  }

  if (!Array.isArray(record.unresolvedItems)) fail("UNRESOLVED_ITEMS");
  const covered = new Set();
  for (const itemInput of record.unresolvedItems) {
    const item = plainObject(itemInput, "UNRESOLVED_ITEM");
    exactKeys(
      item,
      ["category", "count", "disposition", "authorizationReference"],
      "UNRESOLVED_ITEM_KEYS",
    );
    if (!REQUIRED_COUNTS.includes(item.category)) fail("UNRESOLVED_CATEGORY");
    if (!Number.isInteger(item.count) || item.count <= 0) {
      fail("UNRESOLVED_COUNT");
    }
    if (item.count !== counts[item.category]) fail("UNRESOLVED_COUNT_MISMATCH");
    if (
      ![
        "ASSIGN_OWNER",
        "RESTORE_RELATIONSHIP",
        "QUARANTINE_NON_AUDIT",
        "DELETE_CONFIRMED_SEED",
      ].includes(item.disposition)
    ) {
      fail("UNRESOLVED_DISPOSITION");
    }
    nonEmpty(item.authorizationReference, "AUTHORIZATION_REFERENCE");
    if (covered.has(item.category)) fail("UNRESOLVED_DUPLICATE");
    covered.add(item.category);
  }
  for (const key of REQUIRED_COUNTS) {
    if (counts[key] > 0 && !covered.has(key)) fail("MISSING_DISPOSITION");
  }

  const backup = plainObject(record.backup, "BACKUP");
  exactKeys(
    backup,
    ["reference", "createdAt", "restoreOrIntegrityCheckedAt"],
    "BACKUP_KEYS",
  );
  nonEmpty(backup.reference, "BACKUP_REFERENCE");
  isoDate(backup.createdAt, "BACKUP_CREATED_AT");
  isoDate(backup.restoreOrIntegrityCheckedAt, "BACKUP_CHECKED_AT");
  if (record.auditHistoryDisposition !== "PRESERVE_AS_V0") {
    fail("AUDIT_HISTORY_MUST_BE_PRESERVED");
  }

  const approver = plainObject(record.approver, "APPROVER");
  exactKeys(approver, ["name", "role", "approvedAt"], "APPROVER_KEYS");
  nonEmpty(approver.name, "APPROVER_NAME");
  nonEmpty(approver.role, "APPROVER_ROLE");
  isoDate(approver.approvedAt, "APPROVED_AT");
  return record;
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const recordPath = process.argv[2];
  if (!recordPath) fail("PATH_REQUIRED");
  const parsed = JSON.parse(readFileSync(recordPath, "utf8"));
  validateLegacyDecision(parsed);
  process.stdout.write("LEGACY_DECISION_VALID\n");
}
