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

test("skips a selector-less trace and applies every locator trace for the same target", (t) => {
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
  assert.deepEqual(
    readFileSync(appliedLog, "utf8")
      .trim()
      .split("\n")
      .map((trace) => path.basename(trace)),
    ["css-locator-trace.zip", "xpath-locator-trace.zip"],
  );
});

test("passes batch mode for a target with existing staged and unstaged changes", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "qafix-batch-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const page = path.join(root, "pages", "CartPage.ts");
  mkdirSync(path.dirname(page), { recursive: true });
  writeFileSync(page, "export class CartPage {}\n");
  execFileSync("git", ["init", "-b", "main"], { cwd: root, stdio: "pipe" });
  execFileSync("git", ["add", "pages/CartPage.ts"], {
    cwd: root,
    stdio: "pipe",
  });
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
  writeFileSync(page, "export class CartPage { stagedChange() {} }\n");
  execFileSync("git", ["add", "pages/CartPage.ts"], {
    cwd: root,
    stdio: "pipe",
  });
  const stagedTree = execFileSync("git", ["write-tree"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  writeFileSync(
    page,
    "export class CartPage { stagedChange() { return 1; } }\n",
  );

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
      "} else {",
      "  if (!process.argv.includes('--batch')) process.exitCode = 3;",
      "  fs.appendFileSync(process.env.QAFIX_APPLIED_LOG, trace + '\\n');",
      "}",
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

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Batch complete: 1 trace\(s\) fully verified/);
  assert.equal(
    readFileSync(appliedLog, "utf8").trim(),
    path.join(traces, "css-locator-trace.zip"),
  );
  assert.equal(
    execFileSync("git", ["write-tree"], { cwd: root, encoding: "utf8" }).trim(),
    stagedTree,
  );
});

test("applies multi-locator and standalone traces for the same file in priority order", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "qafix-batch-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const traces = path.join(root, "traces");
  mkdirSync(traces, { recursive: true });
  for (const name of ["css-locator-trace.zip", "heal-multiple-trace.zip"]) {
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
      "  console.log('- Edit only `pages/CartPage.ts`');",
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

  assert.match(output, /Batch complete: 2 trace\(s\) fully verified/);
  assert.deepEqual(
    readFileSync(appliedLog, "utf8")
      .trim()
      .split("\n")
      .map((trace) => path.basename(trace)),
    ["heal-multiple-trace.zip", "css-locator-trace.zip"],
  );
});

test("retains locator fixes after an advancing assertion and continues the batch", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "qafix-batch-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const traces = path.join(root, "traces");
  mkdirSync(traces, { recursive: true });
  for (const name of [
    "heal-multiple-assertion-trace.zip",
    "css-locator-trace.zip",
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
      "  console.log('- Edit only `pages/CartPage.ts`');",
      "} else if (trace.includes('assertion')) {",
      "  fs.appendFileSync(process.env.QAFIX_APPLIED_LOG, trace + '\\n');",
      "  console.error('qafix fix: retained verified locator repair(s); scenario still fails on an assertion/application expectation.');",
      "  process.exitCode = 1;",
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
    /retained locator fixes but still have assertion\/application failures/,
  );
  assert.deepEqual(
    readFileSync(appliedLog, "utf8")
      .trim()
      .split("\n")
      .map((trace) => path.basename(trace)),
    ["heal-multiple-assertion-trace.zip", "css-locator-trace.zip"],
  );
});

test("skips an apply that refuses an advancing assertion", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "qafix-batch-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const traces = path.join(root, "traces");
  mkdirSync(traces, { recursive: true });
  for (const name of [
    "assertion-followup-trace.zip",
    "css-locator-trace.zip",
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
      "  console.log(trace.includes('assertion') ? '- Edit only `pages/HomePage.ts`' : '- Edit only `pages/CartPage.ts`');",
      "} else if (trace.includes('assertion')) {",
      "  console.error('qafix fix: refused advancing assertion failure (assertion-signal)');",
      "  process.exitCode = 1;",
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

  assert.equal(result.status, 0);
  assert.match(
    result.stdout,
    /Skipped: qafix refused an assertion failure after inspecting this trace/,
  );
  assert.deepEqual(
    readFileSync(appliedLog, "utf8")
      .trim()
      .split("\n")
      .map((trace) => path.basename(trace)),
    ["css-locator-trace.zip"],
  );
});

test("fails the batch when a locator apply errors", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "qafix-batch-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const traces = path.join(root, "traces");
  mkdirSync(traces, { recursive: true });
  writeFileSync(path.join(traces, "css-locator-trace.zip"), "fixture");

  const fakeBin = path.join(root, "qafix.js");
  writeFileSync(
    fakeBin,
    [
      "const trace = process.argv.at(-1);",
      "if (process.argv.includes('--dry-run')) {",
      "  console.log('# qafix: repair a failing locator');",
      "  console.log('- Edit only `pages/CartPage.ts`');",
      "} else {",
      "  console.error('qafix fix: Cursor timeout: timed out');",
      "  process.exitCode = 1;",
      "}",
      "",
    ].join("\n"),
  );

  const result = spawnSync(process.execPath, [script, traces], {
    encoding: "utf8",
    cwd: root,
    env: { ...process.env, QAFIX_BIN: fakeBin },
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /qafix fix: Cursor timeout: timed out/);
});
