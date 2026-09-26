const { spawnSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");

function resolveQafixBin() {
  if (process.env.QAFIX_BIN) return process.env.QAFIX_BIN;
  const candidates = [
    path.join(process.cwd(), "node_modules", "qafix", "dist", "bin", "qafix.js"),
    path.resolve(__dirname, "../../../qaFixAIAgent/qa-fix/dist/bin/qafix.js"),
  ];
  return candidates.find((file) => existsSync(file)) || candidates[0];
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
const target = path.resolve(process.argv[2] || "test-results");
const reportDir = path.resolve(process.cwd(), "reports/qafix");

console.log(`\n=== qafix heal ${target} ===\n`);
const result = spawnSync(
  process.execPath,
  [bin, "heal", target, "--report", reportDir],
  {
    cwd: qafixRoot,
    stdio: "inherit",
  },
);

process.exit(result.status ?? 1);
