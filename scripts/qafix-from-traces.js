const { spawnSync } = require("node:child_process");
const { existsSync, readdirSync, statSync } = require("node:fs");
const path = require("node:path");

function resolveQafixBin() {
  if (process.env.QAFIX_BIN) return process.env.QAFIX_BIN;
  const candidates = [
    path.join(
      process.cwd(),
      "node_modules",
      "qafix",
      "dist",
      "bin",
      "qafix.js",
    ),
    path.resolve(__dirname, "../../../qaFixAIAgent/qa-fix/dist/bin/qafix.js"),
  ];
  return candidates.find((file) => existsSync(file)) || candidates[0];
}

function healTargetFromDryRun(output) {
  return output.match(/^- Edit only `([^`]+)`/m)?.[1];
}

function healTargetIsDirty(relativePath) {
  const result = spawnSync(
    "git",
    ["status", "--porcelain", "--", relativePath],
    {
      encoding: "utf8",
      cwd: process.cwd(),
    },
  );
  if (result.status !== 0) return false;
  return Boolean((result.stdout || "").trim());
}

function collectTraces(target) {
  const resolved = path.resolve(target);
  if (!existsSync(resolved)) {
    console.error(`No such file or directory: ${target}`);
    process.exit(1);
  }
  if (statSync(resolved).isFile()) {
    if (!resolved.endsWith(".zip")) {
      console.error(`Expected a trace.zip file, got: ${target}`);
      process.exit(1);
    }
    return [resolved];
  }
  const traces = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && entry.name.endsWith(".zip")) traces.push(file);
    }
  };
  visit(resolved);
  return traces.sort();
}

const bin = resolveQafixBin();
if (!existsSync(bin)) {
  console.error(
    "qafix CLI not found. In qa-fix run: npm ci && npm run build && npm link. In this Playwright repo run: npm link qafix.",
  );
  console.error(`Looked for ${bin}`);
  process.exit(1);
}

const qafixRoot = path.resolve(path.dirname(bin), "..", "..");
const target = process.argv[2] || "test-results";
const traces = collectTraces(target);

if (traces.length === 0) {
  console.log(
    `No trace.zip files under ${target}. Run a failing suite first, for example: npm run test:known-failures`,
  );
  process.exit(0);
}

const locatorTraces = [];
for (const tracePath of traces) {
  console.log(`\n=== qafix preflight ${tracePath} ===`);
  const result = spawnSync(
    process.execPath,
    [bin, "fix", "--dry-run", path.resolve(tracePath)],
    {
      encoding: "utf8",
      cwd: qafixRoot,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  if (
    result.status === 0 &&
    output.includes("# qafix: repair a failing locator") &&
    (output.includes("MISSING_SELECTOR") ||
      output.includes("recorded no selector"))
  ) {
    console.log(
      "Skipped: trace has no selector to repair, so it is not a locator heal.",
    );
  } else if (
    result.status === 0 &&
    output.includes("# qafix: repair a failing locator")
  ) {
    locatorTraces.push({
      tracePath,
      target: healTargetFromDryRun(output),
    });
    console.log(
      "Selected: qafix classified this as a repairable locator failure.",
    );
  } else {
    const refusal = output.match(/qafix fix: refused[^\r\n]*/);
    console.log(
      `Skipped: ${refusal?.[0] || "trace is not dispatchable as a locator repair."}`,
    );
  }
}

if (locatorTraces.length === 0) {
  console.log("\nNo dispatchable locator-failure traces found.");
  process.exit(0);
}

console.log(`\nSelected ${locatorTraces.length} locator trace(s) for healing.`);
let failed = false;
const repaired = new Set();
const blocked = new Set();
for (const { tracePath, target } of locatorTraces) {
  if (target && repaired.has(target)) {
    console.log(
      `\n=== qafix apply ${tracePath} ===\nSkipped: ${target} was already repaired in this batch. Commit that staged fix before healing another trace for the same file.`,
    );
    continue;
  }
  if (target && blocked.has(target)) {
    console.log(
      `\n=== qafix apply ${tracePath} ===\nSkipped: heal target must be clean before qafix: ${target}`,
    );
    continue;
  }
  if (target && healTargetIsDirty(target)) {
    console.log(
      `\n=== qafix apply ${tracePath} ===\nSkipped: heal target must be clean before qafix: ${target}\nCommit or restore that file, then rerun this command.`,
    );
    blocked.add(target);
    failed = true;
    continue;
  }
  console.log(`\n=== qafix apply ${tracePath} ===`);
  const result = spawnSync(
    process.execPath,
    [bin, "fix", path.resolve(tracePath)],
    {
      encoding: "utf8",
      cwd: qafixRoot,
      stdio: "inherit",
    },
  );
  if (result.status !== 0) failed = true;
  else if (target) repaired.add(target);
}

process.exit(failed ? 1 : 0);
