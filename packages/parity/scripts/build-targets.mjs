/**
 * Builds Lite into packages/parity/.out/ for the parity harness.
 *   --lite-head          vite build of the current working tree into .out/lite-head
 *   --lite-base <ref>    vite build of the repo at <ref> (git worktree) into .out/lite-base
 *   --saas               builds the React Lite-area preview (vite --mode parity) into packages/app/dist-parity
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');
const outRoot = join(repoRoot, 'packages', 'parity', '.out');

function run(cmd, args, cwd) {
  execFileSync(cmd, args, { cwd, stdio: 'inherit' });
}

/** Copies js/config_base.js to js/config.js only when the target is absent. */
function ensureConfig(dir) {
  const target = join(dir, 'js', 'config.js');
  if (!existsSync(target)) copyFileSync(join(dir, 'js', 'config_base.js'), target);
}

function buildHead() {
  ensureConfig(repoRoot);
  run('npx', ['vite', 'build', '--outDir', join(outRoot, 'lite-head'), '--emptyOutDir'], repoRoot);
  console.log('parity: built lite-head');
}

function buildSaas() {
  run('npm', ['-w', '@roadmapsnap/app', 'run', 'build:parity'], repoRoot);
  console.log('parity: built saas preview');
}

function buildBase(ref) {
  const tmp = mkdtempSync(join(tmpdir(), 'parity-base-'));
  const wt = join(tmp, 'wt');
  run('git', ['worktree', 'add', '--detach', wt, ref], repoRoot);
  try {
    const pkg = JSON.parse(readFileSync(join(wt, 'package.json'), 'utf8'));
    if (pkg.workspaces) {
      run('npm', ['ci', '--workspace=packages/core', '--workspace=packages/tokens', '--include-workspace-root'], wt);
    } else {
      run('npm', ['ci'], wt);
    }
    // Config is copied inside the temporary worktree only; the user's js/config.js is untouched.
    copyFileSync(join(wt, 'js', 'config_base.js'), join(wt, 'js', 'config.js'));
    run('npx', ['vite', 'build', '--outDir', join(outRoot, 'lite-base'), '--emptyOutDir'], wt);
    console.log(`parity: built lite-base from ${ref}`);
  } finally {
    try {
      run('git', ['worktree', 'remove', '--force', wt], repoRoot);
    } catch (err) {
      console.error('parity: failed to remove worktree', wt, err.message);
    }
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('parity: usage: build-targets.mjs [--lite-head] [--lite-base <ref>] [--saas]');
  process.exit(1);
}
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--lite-head') buildHead();
  else if (args[i] === '--saas') buildSaas();
  else if (args[i] === '--lite-base') {
    const ref = args[i + 1];
    if (!ref) {
      console.error('parity: --lite-base needs a git ref');
      process.exit(1);
    }
    i += 1;
    buildBase(ref);
  } else {
    console.error(`parity: unknown argument ${args[i]}`);
    process.exit(1);
  }
}
