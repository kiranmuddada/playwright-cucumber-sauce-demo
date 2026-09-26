const assert = require("node:assert/strict");
const { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const script = path.join(__dirname, "qafix-from-traces.js");

function fakeBin(root, body) {
  const bin = path.join(root, "qafix.js");
  writeFileSync(bin, body);
  return bin;
}

test("delegates saved traces to qafix heal and reports its summary", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "qafix-batch-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const traces = path.join(root, "traces");
  mkdirSync(traces, { recursive: true });
  writeFileSync(path.join(traces, "locator-trace.zip"), "fixture");
  const bin = fakeBin(
    root,
    [
      "const trace = process.argv.slice(2);",
      "if (trace[0] !== 'heal') process.exitCode = 2;",
      "console.log('Heal complete: 1 scenario(s) verified; 0 scenario(s) retained locator fixes but still have assertion/application failures; 0 scenario(s) were not healed.');",
      "console.log(JSON.stringify(trace));",
      "",
    ].join("\n"),
  );

  const result = spawnSync(process.execPath, [script, traces], {
    encoding: "utf8",
    cwd: root,
    env: { ...process.env, QAFIX_BIN: bin },
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Heal complete: 1 scenario\(s\) verified/);
  const args = JSON.parse(result.stdout.trim().split("\n").at(-1));
  assert.deepEqual(args.slice(0, 2), ["heal", traces]);
  assert.deepEqual(args.slice(2), [
    "--report",
    path.join(realpathSync(root), "reports", "qafix"),
  ]);
});

test("exits nonzero when heal retains assertion or unknown failures", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "qafix-batch-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const traces = path.join(root, "traces");
  mkdirSync(traces, { recursive: true });
  writeFileSync(path.join(traces, "mixed-trace.zip"), "fixture");
  const bin = fakeBin(
    root,
    [
      "console.log('retained verified locator repair(s); scenario still fails on an assertion/application expectation.');",
      "console.log('Heal complete: 0 scenario(s) verified; 1 scenario(s) retained locator fixes but still have assertion/application failures; 0 scenario(s) were not healed.');",
      "process.exitCode = 1;",
      "",
    ].join("\n"),
  );

  const result = spawnSync(process.execPath, [script, traces], {
    encoding: "utf8",
    cwd: root,
    env: { ...process.env, QAFIX_BIN: bin },
  });

  assert.equal(result.status, 1);
  assert.match(
    result.stdout,
    /retained locator fixes but still have assertion\/application failures/,
  );
});
