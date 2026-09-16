import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RUNTIME_ROOTS = [
  "apps/api/src",
  "apps/bot/src",
  "apps/web/server",
  "packages/exchange-bybit/src",
  "packages/exchange-core/src",
];

const sourceFiles = (directory) =>
  readdirSync(directory).flatMap((entry) => {
    const fullPath = path.join(directory, entry);
    if (statSync(fullPath).isDirectory()) return sourceFiles(fullPath);
    if (!/\.(?:ts|vue|mjs)$/.test(entry) || /\.test\./.test(entry)) return [];
    return [fullPath];
  });

const forbiddenRuntimePatterns = [
  ["private Bybit API key", /\bBYBIT_(?:API_KEY|API_SECRET|SECRET_KEY)\b/],
  ["Demo private host", /\b(?:api|stream)-demo\.bybit\.com\b/],
  ["private order endpoint", /\/v5\/order\//],
  ["transfer or withdrawal endpoint", /\/v5\/asset\/(?:transfer|withdraw)/],
  ["Broker credential", /\bBROKER_(?:CLIENT_ID|CLIENT_SECRET)\b/],
  ["private adapter import", /exchange-bybit-private|private-bybit-adapter/],
];

const forbiddenExchangePatterns = [
  ["exchange request signing", /\bcreateHmac\b|\bx-bapi-sign\b/i],
  ["exchange credential header", /\bx-bapi-api-key\b/i],
  ["private order operation", /\bplaceOrder\b|\bsubmitOrder\b/],
];

const violations = [];
for (const root of RUNTIME_ROOTS) {
  for (const file of sourceFiles(path.join(ROOT, root))) {
    const source = readFileSync(file, "utf8");
    for (const [label, pattern] of forbiddenRuntimePatterns) {
      if (pattern.test(source))
        violations.push(`${label}: ${path.relative(ROOT, file)}`);
    }
    if (file.includes(`${path.sep}packages${path.sep}exchange-`)) {
      for (const [label, pattern] of forbiddenExchangePatterns) {
        if (pattern.test(source)) {
          violations.push(`${label}: ${path.relative(ROOT, file)}`);
        }
      }
    }
  }
}

const requiredInvariants = [
  [
    "packages/db/src/schema.ts",
    /strategies_mode_dry_run_check[\s\S]*orders_mode_dry_run_check/,
    "database DRY_RUN checks",
  ],
  [
    "apps/api/src/runtime-config.ts",
    /EXECUTION_MODE:[\s\S]*picklist\(\["DRY_RUN"\]\)/,
    "runtime DRY_RUN-only config",
  ],
  [
    "apps/api/src/modules/runner/reservation.repository.ts",
    /liveTradingEnabled:\s*false/,
    "reservation live-trading hard stop",
  ],
  [
    "apps/api/src/modules/runner/runner.service.ts",
    /reserveDryRunOrder/,
    "runner reservation boundary",
  ],
];

for (const [relativePath, pattern, label] of requiredInvariants) {
  const source = readFileSync(path.join(ROOT, relativePath), "utf8");
  if (!pattern.test(source))
    violations.push(`missing ${label}: ${relativePath}`);
}

if (violations.length > 0) {
  process.stderr.write(`GATE1_BOUNDARY_VIOLATION\n${violations.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("GATE1_BOUNDARY_OK: DRY_RUN public-market path only\n");
}
