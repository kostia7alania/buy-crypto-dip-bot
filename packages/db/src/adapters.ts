export type DatabaseRuntime = "production" | "local" | "test";
export type DatabaseDialect = "postgresql" | "sqlite";

export interface DatabaseAdapterDescriptor {
  dialect: DatabaseDialect;
  runtime: DatabaseRuntime;
  connectionTarget: string;
  ready: false;
  note: string;
}

export interface PostgresAdapterOptions {
  runtime: DatabaseRuntime;
  connectionString?: string;
}

export interface SqliteDevAdapterOptions {
  runtime: DatabaseRuntime;
  filename?: string;
}

export const createPostgresAdapterPlaceholder = (
  options: PostgresAdapterOptions,
): DatabaseAdapterDescriptor => {
  if (!options.connectionString) {
    throw new Error("POSTGRES_CONNECTION_STRING_REQUIRED");
  }

  return {
    dialect: "postgresql",
    runtime: options.runtime,
    connectionTarget: options.connectionString,
    ready: false,
    note: "Postgres is the production database target; wire the concrete Drizzle adapter in the next DB task.",
  };
};

export const createSqliteDevAdapterPlaceholder = (
  options: SqliteDevAdapterOptions,
): DatabaseAdapterDescriptor => {
  if (options.runtime === "production") {
    throw new Error("SQLITE_IS_LOCAL_DEV_TEST_ONLY");
  }

  return {
    dialect: "sqlite",
    runtime: options.runtime,
    connectionTarget: options.filename ?? ":memory:",
    ready: false,
    note: "SQLite is a local/dev/test placeholder only and must not be used for production.",
  };
};
