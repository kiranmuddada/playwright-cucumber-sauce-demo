const { spawnSync } = require('node:child_process');

function run(command, args, env = process.env) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
}

console.log('\n=== Cucumber: all features ===\n');
const cucumber = run('npx', ['cucumber-js'], {
  ...process.env,
  QAFIX_CAPTURE_ONLY: '1'
});

if (cucumber.status === null) {
  process.exit(1);
}

console.log('\n=== qafix 1.1–1.3 on every saved trace.zip ===\n');
const qafix = run('npm', ['run', 'qafix']);

process.exit(qafix.status ?? 1);
