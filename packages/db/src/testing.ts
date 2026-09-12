// Test-only entry point, reached as `@buy-crypto-dip-bot/db/testing`.
//
// Kept out of the package's main export on purpose: it pulls in PGlite, which
// has no business being reachable from production code. Everything here is
// source-resolved rather than bundled, because only test runners import it.

export {
  createEmptyTestDb,
  createTestDb,
  type TestDatabase,
  type TestDb,
} from "./testing-db.js";
export {
  type SeededTenant,
  seedTwoTenants,
  type TwoTenantWorld,
} from "./testing-seed.js";
