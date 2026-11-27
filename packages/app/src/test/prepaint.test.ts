// The blocking inline script in index.html sets data-theme from localStorage before first paint (D-06), so the
// page never flashes the wrong theme. The script is run here exactly as written, in node:vm, with stubs for the two
// browser objects it touches. Its allowlist must equal core THEMES (T-02-29).
import { beforeAll, describe, expect, it } from 'vitest'
import { THEMES } from '@roadmapsnap/core'

// The app has no Node type declarations, so the Node modules are reached through dynamic imports of a variable.
const FS_MODULE = 'node:fs'
const VM_MODULE = 'node:vm'
const indexPath = decodeURIComponent(import.meta.url.replace(/^file:\/\//, '')).replace(/src\/test\/[^/]*$/, 'index.html')

let html = ''
let script = ''
let vm: { runInNewContext: (code: string, sandbox: object) => unknown }

beforeAll(async () => {
  const fs = await import(/* @vite-ignore */ FS_MODULE)
  vm = await import(/* @vite-ignore */ VM_MODULE)
  html = fs.readFileSync(indexPath, 'utf8') as string
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1])
  script = inline.find((s) => s.includes('roadmapsnap-theme')) ?? ''
})

/** Runs the script with the given localStorage behavior and returns the data-theme it set (or null if it set none). */
function runWith(storage: { getItem: (key: string) => string | null }): string | null {
  let applied: string | null = null
  const document = {
    documentElement: {
      setAttribute(name: string, value: string) {
        if (name === 'data-theme') applied = value
      },
    },
  }
  vm.runInNewContext(script, { localStorage: storage, document })
  return applied
}

function stored(value: string | null) {
  return { getItem: (key: string) => (key === 'roadmapsnap-theme' ? value : null) }
}

describe('index.html pre-paint theme script', () => {
  it('exists as an inline script that reads roadmapsnap-theme', () => {
    expect(script).not.toBe('')
  })

  it('runs before any stylesheet or module script in the head', () => {
    const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'))
    const at = head.indexOf('roadmapsnap-theme')
    expect(at).toBeGreaterThan(-1)
    expect(head.indexOf('type="module"')).toBe(-1)
    expect(head.indexOf('rel="stylesheet"')).toBe(-1)
    // Blocking: not async, not deferred, not a module.
    expect(html).not.toMatch(/<script[^>]*(async|defer|type="module")[^>]*>\s*\(function/)
  })

  it('maps the legacy dsm-firmenich value to evergreen', () => {
    expect(runWith(stored('dsm-firmenich'))).toBe('evergreen')
  })

  it.each([...THEMES])('keeps the stored theme %s', (theme) => {
    expect(runWith(stored(theme))).toBe(theme)
  })

  it.each([
    ['an unknown value', 'neon'],
    ['an empty value', ''],
    ['a missing key', null],
  ])('falls back to light for %s', (_label, value) => {
    expect(runWith(stored(value))).toBe('light')
  })

  it('falls back to light when localStorage throws', () => {
    expect(
      runWith({
        getItem() {
          throw new Error('storage blocked')
        },
      }),
    ).toBe('light')
  })

  it('has an allowlist equal to core THEMES', () => {
    const match = script.match(/var\s+ok\s*=\s*\[([^\]]*)\]/)
    expect(match).not.toBeNull()
    const list = [...(match as RegExpMatchArray)[1].matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2])
    expect([...list].sort()).toEqual([...THEMES].sort())
  })
})
