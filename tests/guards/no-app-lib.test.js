/**
 * Static guard for CORE-02: the app holds no second implementation of the roadmap rules.
 *
 * packages/app/src/lib is gone, nothing in the app imports from a lib directory, and no app source file declares a
 * function or constant named after a rule that lives in @roadmapsnap/core. A renamed re-implementation is not caught
 * here; that stays with code review.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const APP_SRC = join(ROOT, 'packages', 'app', 'src');

const CORE_RULE_NAMES = [
    'calculateStats',
    'filterDeliverables',
    'sortDeliverables',
    'getDependencyGraph',
    'getCurrentStatus',
    'generateMonths',
    'calculatePosition',
    'getEffectiveAtRiskSet',
    'buildCsv',
    'buildJson',
];

function sourceFiles(dir) {
    const out = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...sourceFiles(path));
        else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) out.push(path);
    }
    return out;
}

/** True when `text` declares a function or a const/let/var called `name`. */
function declares(text, name) {
    return new RegExp(`\\b(?:function\\s*\\*?\\s+|(?:const|let|var)\\s+)${name}\\b`).test(text);
}

const files = sourceFiles(APP_SRC);

test('the app has source files to check', () => {
    assert.ok(files.length > 20, `expected the app sources, found ${files.length}`);
});

test('packages/app/src/lib does not exist', () => {
    assert.equal(existsSync(join(APP_SRC, 'lib')), false);
});

test('no app source imports a path through a lib directory', () => {
    const offenders = [];
    for (const file of files) {
        const text = readFileSync(file, 'utf8');
        for (const match of text.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g)) {
            if (match[1].includes('/lib/') || match[1].endsWith('/lib')) {
                offenders.push(`${relative(ROOT, file)} -> ${match[1]}`);
            }
        }
    }
    assert.deepEqual(offenders, []);
});

test('no app source declares a function or constant named after a core roadmap rule', () => {
    const offenders = [];
    for (const file of files) {
        const text = readFileSync(file, 'utf8');
        for (const name of CORE_RULE_NAMES) {
            if (declares(text, name)) offenders.push(`${relative(ROOT, file)} declares ${name}`);
        }
    }
    assert.deepEqual(offenders, []);
});

test('the guard detects a declaration (self-check)', () => {
    assert.equal(declares('export function calculateStats(items) { return items }', 'calculateStats'), true);
    assert.equal(declares('export const filterDeliverables = () => []', 'filterDeliverables'), true);
    assert.equal(declares('import { calculateStats } from "@roadmapsnap/core"; calculateStats(x)', 'calculateStats'), false);
});
