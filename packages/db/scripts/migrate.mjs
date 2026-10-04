import pg from "pg";
import { createPostgresConnection, runMigrations } from "../dist/index.mjs";

let connection;
try {
  const password = process.env.POSTGRES_RUNTIME_PASSWORD;
  const nonLocal =
    process.env.APP_RUNTIME === "non-local" ||
    process.env.NODE_ENV === "production";
  if (nonLocal && !password)
    throw new Error("POSTGRES_RUNTIME_PASSWORD_REQUIRED");
  // Production Compose puts this value in a URL; generated hex needs no escaping.
  if (password !== undefined && !/^[0-9a-f]{48,128}$/.test(password)) {
    throw new Error("POSTGRES_RUNTIME_PASSWORD_INVALID");
  }
  if (
    password &&
    password ===
      decodeURIComponent(
        new URL(process.env.POSTGRES_CONNECTION_STRING).password,
      )
  )
    throw new Error("POSTGRES_RUNTIME_PASSWORD_MUST_DIFFER");
  if (process.argv[2] === "--check-config") {
    process.stdout.write("DATABASE_CONFIG_OK\n");
  } else {
    connection = createPostgresConnection(
      process.env.POSTGRES_CONNECTION_STRING,
    );
    await runMigrations(connection.db);
    if (password) {
      const client = await connection.pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SET LOCAL password_encryption = 'scram-sha-256'");
        await client.query(
          `ALTER ROLE dipbot_runtime LOGIN PASSWORD ${pg.escapeLiteral(password)}`,
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
    process.stdout.write("DATABASE_MIGRATION_OK\n");
  }
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
