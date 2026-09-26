const { spawnSync } = require("node:child_process");

function run(command, args) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

console.log("\n=== Cucumber: all features ===\n");
const cucumber = run("npx", ["cucumber-js"]);

if (cucumber.status === null) {
  process.exit(1);
}

console.log("\n=== qafix heal on every saved trace.zip ===\n");
const qafix = run("npm", ["run", "heal"]);

process.exit(qafix.status ?? 1);
