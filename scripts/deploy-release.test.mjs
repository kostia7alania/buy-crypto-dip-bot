import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const source = readFileSync(
  new URL("./deploy-release.sh", import.meta.url),
  "utf8",
);
const image = `ghcr.io/kostia7alania/buy-crypto-dip-bot@sha256:${"a".repeat(64)}`;
const fixture = (failure) => {
  const root = mkdtempSync(path.join(tmpdir(), "dipbot-release-"));
  const bin = path.join(root, "bin");
  mkdirSync(bin);
  writeFileSync(
    path.join(root, ".env"),
    "DIPBOT_IMAGE=\nSESSION_SECRET=fixture-only\n",
  );
  writeFileSync(path.join(root, "docker-compose.yml"), "services: {}\n");
  const script = path.join(root, "release.sh");
  // The fixture copy cannot address /opt or contact a real Docker/network endpoint.
  writeFileSync(
    script,
    source.replace("APP_DIR=/opt/buy-crypto-dip-bot", `APP_DIR='${root}'`),
  );
  const shim = `#!${process.execPath}
import {appendFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const name=path.basename(process.argv[1]);
const args=process.argv.slice(2);
appendFileSync(process.env.RELEASE_CALLS,JSON.stringify([name,...args])+'\\n');
if(name==='curl') {
  const output=args.indexOf('--output');
  if(output!==-1 && args[output+1]!=='/dev/null')writeFileSync(args[output+1],'services: {}\\n');
  if(args.includes('--write-out'))process.stdout.write('301');
} else if(name==='docker') {
  if(args.includes('pg_dump')) {
    if(process.env.RELEASE_FAILURE==='backup')process.exit(23);
    process.stdout.write('fixture-dump');
  }
  if(args.includes('--check-config') && process.env.RELEASE_FAILURE==='configuration')process.exit(23);
  if(args.includes('run') && args.includes('migrate') && !args.includes('--check-config') && process.env.RELEASE_FAILURE==='migration')process.exit(23);
  if(args.includes('up') && !args.includes('db') && process.env.RELEASE_FAILURE==='startup')process.exit(23);
  if(args.includes('ps') && args.includes('-aq'))process.stdout.write('fixture-'+args.at(-1));
  if(args.includes('inspect'))process.stdout.write('sha256:fixture-previous-image');
} else process.exit(99);
`;
  for (const command of ["curl", "docker"]) {
    writeFileSync(path.join(bin, command), shim, { mode: 0o755 });
  }
  const result = spawnSync("bash", [script], {
    cwd: root,
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      TARGET_SHA: "b".repeat(40),
      TARGET_IMAGE: image,
      RELEASE_CALLS: path.join(root, "calls.jsonl"),
      RELEASE_FAILURE: failure,
    },
    encoding: "utf8",
    timeout: 15_000,
  });
  const calls = readFileSync(path.join(root, "calls.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  return { root, result, calls };
};

for (const failure of [
  "none",
  "configuration",
  "backup",
  "migration",
  "startup",
]) {
  test(`release control flow: ${failure}`, () => {
    const { root, result, calls } = fixture(failure);
    try {
      assert.equal(result.error, undefined);
      const at = (predicate) => calls.findIndex(predicate);
      const stop = at((c) => c.includes("stop"));
      const dump = at((c) => c.includes("pg_dump"));
      const preflight = at((c) => c.includes("--check-config"));
      const migrate = at(
        (c) =>
          c.includes("run") &&
          c.includes("migrate") &&
          !c.includes("--check-config"),
      );
      const appUp = at((c) => c.includes("up") && !c.includes("db"));
      assert.ok(preflight >= 0, "credentials checked without DB dependencies");
      if (failure === "configuration") {
        assert.notEqual(result.status, 0);
        assert.equal(stop, -1);
        assert.equal(dump, -1);
        assert.equal(migrate, -1);
        assert.equal(appUp, -1);
        assert.equal(
          calls.some((c) => c.includes("start")),
          false,
        );
        return;
      }
      assert.ok(preflight < stop, "credential errors precede stopping writers");
      assert.ok(stop >= 0 && dump > stop, "writers stop before backup");
      if (failure === "backup") {
        assert.notEqual(result.status, 0);
        assert.equal(migrate, -1);
        assert.ok(
          calls.some((c) => c.includes("start")),
          "old containers resume only before DDL",
        );
      } else {
        assert.ok(migrate > dump, "migration follows backup");
        if (failure === "migration") assert.equal(appUp, -1);
        else assert.ok(appUp > migrate, "new app starts after migration");
        if (failure === "none") {
          assert.equal(result.status, 0, result.stderr);
          assert.equal(
            readFileSync(
              path.join(root, ".deploy/image.last-successful"),
              "utf8",
            ).trim(),
            image,
          );
        } else {
          assert.notEqual(result.status, 0);
          assert.ok(calls.at(-1).includes("stop"));
          assert.equal(
            calls.some((c) => c.includes("start")),
            false,
            "no old-image restart after attempted DDL",
          );
        }
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
