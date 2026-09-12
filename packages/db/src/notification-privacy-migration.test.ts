import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createEmptyTestDb, type TestDatabase } from "./testing.js";

const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../migrations",
);
const migration = (name: string) =>
  readFileSync(path.join(migrationsDir, name), "utf8");

let harness: TestDatabase;

afterEach(async () => {
  await harness?.close();
});

describe("0014 notification privacy upgrade", () => {
  it("redacts and skips undelivered legacy plaintext", async () => {
    harness = await createEmptyTestDb();
    for (const name of [
      "0000_violet_gargoyle.sql",
      "0001_glorious_kulan_gath.sql",
      "0002_left_pride.sql",
      "0003_unusual_blue_shield.sql",
      "0004_stale_black_knight.sql",
      "0005_cooing_vapor.sql",
      "0006_whole_living_tribunal.sql",
      "0007_burly_amazoness.sql",
      "0008_gigantic_taskmaster.sql",
      "0009_strange_stryfe.sql",
      "0010_wandering_hulk.sql",
      "0011_silky_omega_sentinel.sql",
      "0012_black_valkyrie.sql",
      "0013_immutable_audit_history.sql",
    ]) {
      await harness.exec(migration(name));
    }

    await harness.exec(`
      INSERT INTO users (id, telegram_user_id)
      VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 'privacy-upgrade-user');
      INSERT INTO notification_outbox (
        id, user_id, chat_id, kind, message, status
      ) VALUES (
        'bbbbbbbb-0000-4000-8000-000000000002',
        'aaaaaaaa-0000-4000-8000-000000000001',
        '123456', 'PLAIN', 'SECRET_FINANCIAL_MESSAGE', 'PENDING'
      );
    `);

    await harness.exec(migration("0014_bouncy_zuras.sql"));

    const result = (await harness.exec(`
      SELECT status, last_error_code, template_key, render_inputs::text AS render_inputs,
             correlation_id
      FROM notification_outbox;
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'notification_outbox' AND column_name IN ('kind', 'message');
    `)) as Array<{ rows: Array<Record<string, string>> }>;

    expect(result[0]?.rows[0]).toMatchObject({
      status: "SKIPPED",
      last_error_code: "LEGACY_PLAINTEXT_REDACTED",
      template_key: "ORDER_COMPLETED",
      render_inputs: "{}",
    });
    expect(result[0]?.rows[0]?.correlation_id).toMatch(/^legacy_[a-f0-9]{32}$/);
    expect(result[1]?.rows).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("SECRET_FINANCIAL_MESSAGE");
  });
});
