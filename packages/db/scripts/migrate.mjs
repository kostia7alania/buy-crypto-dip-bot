import { createPostgresConnection, runMigrations } from "../dist/index.mjs";

let connection;
try {
  connection = createPostgresConnection(process.env.POSTGRES_CONNECTION_STRING);
  await runMigrations(connection.db);
  process.stdout.write("DATABASE_MIGRATION_OK\n");
} catch (error) {
  // Drizzle errors can include SQL and row values. Report only safe error codes.
  const code =
    error instanceof Error && /^[A-Z][A-Z0-9_]+$/.test(error.message)
      ? error.message
      : "DATABASE_MIGRATION_FAILED";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
} finally {
  await connection?.pool.end();
}
