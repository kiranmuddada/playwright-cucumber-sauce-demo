const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const script = path.join(__dirname, "qafix-from-traces.js");

test("batch preflights traces and applies only locator failures", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "qafix-batch-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const traces = path.join(root, "traces");
  mkdirSync(path.join(traces, "nested", "run"), { recursive: true });
  for (const [directory, name] of [
    [traces, "css-locator-trace.zip"],
    [path.join(traces, "nested", "run"), "xpath-locator-trace.zip"],
    [traces, "assertion-trace.zip"],
  ]) {
    writeFileSync(path.join(directory, name), "fixture");
  }

  const appliedLog = path.join(root, "applied.jsonl");
  const fakeBin = path.join(root, "qafix.js");
  writeFileSync(
    fakeBin,
    [
      "const fs = require('node:fs');",
      "const trace = process.argv.at(-1);",
      "if (process.argv.includes('--dry-run')) {",
      "  if (trace.includes('locator')) console.log('# qafix: repair a failing locator');",
      "  else { console.error('qafix fix: refused assertion failure (assertion-signal)'); process.exitCode = 1; }",
      "} else fs.appendFileSync(process.env.QAFIX_APPLIED_LOG, trace + '\\n');",
      "",
    ].join("\n"),
  );

  const output = execFileSync(process.execPath, [script, traces], {
    encoding: "utf8",
    env: {
      ...process.env,
      QAFIX_BIN: fakeBin,
      QAFIX_APPLIED_LOG: appliedLog,
    },
  });

  assert.match(output, /Selected 2 locator trace\(s\) for healing\./);
  assert.match(output, /Skipped: qafix fix: refused assertion failure/);
  assert.deepEqual(
    readFileSync(appliedLog, "utf8")
      .trim()
      .split("\n")
      .map((trace) => path.basename(trace)),
    ["css-locator-trace.zip", "xpath-locator-trace.zip"],
  );
});

test("skips a selector-less trace and a second trace for the same heal target", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "qafix-batch-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const traces = path.join(root, "traces");
  mkdirSync(traces, { recursive: true });
  for (const name of [
    "css-locator-trace.zip",
    "xpath-locator-trace.zip",
    "navigation-trace.zip",
  ]) {
    writeFileSync(path.join(traces, name), "fixture");
  }

  const appliedLog = path.join(root, "applied.jsonl");
  const fakeBin = path.join(root, "qafix.js");
  writeFileSync(
    fakeBin,
    [
      "const fs = require('node:fs');",
      "const trace = process.argv.at(-1);",
      "if (process.argv.includes('--dry-run')) {",
      "  console.log('# qafix: repair a failing locator');",
      "  if (trace.includes('navigation')) console.log('MISSING_SELECTOR');",
      "  else console.log('- Edit only `pages/CartPage.ts`');",
      "} else fs.appendFileSync(process.env.QAFIX_APPLIED_LOG, trace + '\\n');",
      "",
    ].join("\n"),
  );

  const output = execFileSync(process.execPath, [script, traces], {
    encoding: "utf8",
    cwd: root,
    env: {
      ...process.env,
      QAFIX_BIN: fakeBin,
      QAFIX_APPLIED_LOG: appliedLog,
    },
  });

  assert.match(output, /Selected 2 locator trace\(s\) for healing\./);
  assert.match(output, /Skipped: trace has no selector to repair/);
  assert.match(
    output,
    /Skipped: pages\/CartPage.ts was already repaired in this batch/,
  );
  assert.deepEqual(
    readFileSync(appliedLog, "utf8")
      .trim()
      .split("\n")
      .map((trace) => path.basename(trace)),
    ["css-locator-trace.zip"],
  );
});

test("skips a heal target that already has uncommitted changes", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "qafix-batch-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const page = path.join(root, "pages", "CartPage.ts");
  mkdirSync(path.dirname(page), { recursive: true });
  writeFileSync(page, "export class CartPage {}\n");
  execFileSync("git", ["init", "-b", "main"], { cwd: root, stdio: "pipe" });
  execFileSync("git", ["add", "pages/CartPage.ts"], { cwd: root, stdio: "pipe" });
  execFileSync(
    "git",
    [
      "-c",
      "user.email=qafix-test@example.com",
      "-c",
      "user.name=qafix-test",
      "commit",
      "-m",
      "baseline",
    ],
    { cwd: root },
  );
  writeFileSync(page, "export class CartPage { broken() {} }\n");

  const traces = path.join(root, "traces");
  mkdirSync(traces, { recursive: true });
  writeFileSync(path.join(traces, "css-locator-trace.zip"), "fixture");

  const appliedLog = path.join(root, "applied.jsonl");
  const fakeBin = path.join(root, "qafix.js");
  writeFileSync(
    fakeBin,
    [
      "const fs = require('node:fs');",
      "const trace = process.argv.at(-1);",
      "if (process.argv.includes('--dry-run')) {",
      "  console.log('# qafix: repair a failing locator');",
      "  console.log('- Edit only `pages/CartPage.ts`');",
      "} else fs.appendFileSync(process.env.QAFIX_APPLIED_LOG, trace + '\\n');",
      "",
    ].join("\n"),
  );

  const result = spawnSync(process.execPath, [script, traces], {
    encoding: "utf8",
    cwd: root,
    env: {
      ...process.env,
      QAFIX_BIN: fakeBin,
      QAFIX_APPLIED_LOG: appliedLog,
    },
  });

  assert.equal(result.status, 1);
  assert.match(
    result.stdout,
    /Skipped: heal target must be clean before qafix: pages\/CartPage.ts/,
  );
  assert.equal(existsSync(appliedLog), false);
});
