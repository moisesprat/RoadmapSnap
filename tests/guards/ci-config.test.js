/**
 * Static guard over the CI workflows and the single-lockfile rule (CORE-03, D-16).
 *
 * Reads the workflow files as plain text (no YAML dependency) so the root
 * `npm test` stays dependency-free. Keeps Lite CI always-on and light, every
 * workflow on Node 24, and the repository on exactly one root lockfile.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORKFLOWS = join(ROOT, '.github', 'workflows');

function read(relativePath) {
    return readFileSync(join(ROOT, relativePath), 'utf8');
}

function assertContains(text, needle, label) {
    assert.ok(text.includes(needle), `${label} must contain: ${needle}`);
}

test('ci.yml runs on every change: no paths / paths-ignore filter', () => {
    const ci = read('.github/workflows/ci.yml');
    const filterLines = ci.split('\n').filter((line) => /^\s*paths(-ignore)?\s*:/.test(line));
    assert.deepEqual(filterLines, [], 'ci.yml must not declare a path filter');
});

test('ci.yml: Node 24, light workspace install and the Lite + core checks', () => {
    const ci = read('.github/workflows/ci.yml');
    for (const needle of [
        "node-version: '24'",
        'npm ci --workspace=packages/core --workspace=packages/tokens --include-workspace-root',
        'cp js/config_base.js js/config.js',
        'npm test',
        'npm run typecheck -w @roadmapsnap/core',
        'npm run validate',
        'npm run build',
    ]) {
        assertContains(ci, needle, 'ci.yml');
    }
});

test('app-ci.yml: Node 24 and workspace commands from the root lockfile', () => {
    const app = read('.github/workflows/app-ci.yml');
    for (const needle of [
        "node-version: '24'",
        'npm ci -w @roadmapsnap/app',
        'npm run typecheck -w @roadmapsnap/app',
        'npm test -w @roadmapsnap/app',
        'npm run build -w @roadmapsnap/app',
    ]) {
        assertContains(app, needle, 'app-ci.yml');
    }
    assert.ok(!app.includes('cd packages/app'), 'app-ci.yml must not cd into packages/app');
});

test('api-ci.yml: Node 24 and workspace commands from the root lockfile', () => {
    const api = read('.github/workflows/api-ci.yml');
    for (const needle of [
        "node-version: '24'",
        'npm ci -w @roadmapsnap/api',
        'npm run migrate -w @roadmapsnap/api',
        'npm test -w @roadmapsnap/api',
        'npm run test:tz -w @roadmapsnap/api',
    ]) {
        assertContains(api, needle, 'api-ci.yml');
    }
    assert.ok(!api.includes('cd packages/api'), 'api-ci.yml must not cd into packages/api');
});

test('parity.yml: always reports, pinned image equals the Playwright version, heavy steps gated in-job', () => {
    const parity = read('.github/workflows/parity.yml');
    const filterLines = parity.split('\n').filter((line) => /^\s*paths(-ignore)?\s*:/.test(line));
    assert.deepEqual(filterLines, [], 'parity.yml must not declare a path filter (D-11)');
    const pinned = JSON.parse(read('packages/parity/package.json')).devDependencies['@playwright/test'];
    assert.match(pinned, /^\d+\.\d+\.\d+$/, '@playwright/test must be pinned to an exact version');
    assertContains(parity, `mcr.microsoft.com/playwright:v${pinned}-noble`, 'parity.yml');
    for (const needle of [
        'steps.changes.outputs.run',
        'npx playwright test -c packages/parity',
        'node packages/parity/scripts/build-targets.mjs --lite-head --saas',
    ]) {
        assertContains(parity, needle, 'parity.yml');
    }
});

test('no workflow is still on Node 20', () => {
    const files = readdirSync(WORKFLOWS).filter((name) => /\.ya?ml$/.test(name));
    assert.ok(files.length >= 3, 'expected at least the three CI workflows');
    for (const name of files) {
        const text = readFileSync(join(WORKFLOWS, name), 'utf8');
        assert.ok(!text.includes("node-version: '20'"), `${name} must not use Node 20`);
    }
});
test('exactly one package-lock.json is tracked: the root one', () => {
    const tracked = execFileSync('git', ['ls-files', '*package-lock.json'], {
        cwd: ROOT,
        encoding: 'utf8',
    })
        .split('\n')
        .filter(Boolean);
    assert.deepEqual(tracked, ['package-lock.json']);
});

test('root .dockerignore is an allowlist for the API image build context', () => {
    assert.ok(existsSync(join(ROOT, '.dockerignore')), 'root .dockerignore must exist');
    const lines = read('.dockerignore').split('\n');
    assert.equal(lines[0], '*', 'first line must deny everything');
    assertContains(read('.dockerignore'), '!packages/*/package.json', '.dockerignore');
});
