import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { safeHttpUrl, RISK_ICON_SVG, INFO_ICON_SVG, EXPORT_ICON_SVGS } from '../src/index.js';

const sha = (s) => createHash('sha256').update(s).digest('hex');

// SHA-256 of the strings Lite defined inline in js/app.js (riskIconSVG, infoIconSVG) and
// js/ui/exportControls.js before they moved to core: a byte-for-byte guard without repeating the markup.
const EXPECTED_SHA = {
  info: '1213eaa82c2f38a0d23db6279f02574ac2d0623d3bba4046b1872f057ad72401',
  risk: '4b3f65836b0be85b23a6a8f551d2af7c41ebef57cf3fec47a0439ae44626156b',
  full: 'dec8ea357058e4659401a2c390e93f15b85a95e70281b310a3b57e32571a9040',
  summary: 'c17a52cae48766647f888f637cbf34f055af39a7755304376621482898f150cf',
  timeline: '0312057c4cd326664606c93d3ffaee0828a4f39eefb710f548bf137a7b962f31',
  csv: 'cdb7416c1dd2fe624a73826b67b260867e92d7f3730244efb96305118308c0bf',
  json: 'e12dcd3f549bbf4ceb5f27bccfa7b5dc66b07d0c6697348056b4d0ae02adad76',
};

test('icons: INFO_ICON_SVG and RISK_ICON_SVG are the exact strings Lite defined', () => {
  assert.equal(sha(INFO_ICON_SVG), EXPECTED_SHA.info);
  assert.equal(sha(RISK_ICON_SVG), EXPECTED_SHA.risk);
});

test('icons: EXPORT_ICON_SVGS has full, summary, timeline, csv, json with the exportControls strings', () => {
  assert.deepEqual(Object.keys(EXPORT_ICON_SVGS), ['full', 'summary', 'timeline', 'csv', 'json']);
  for (const key of Object.keys(EXPORT_ICON_SVGS)) {
    assert.equal(sha(EXPORT_ICON_SVGS[key]), EXPECTED_SHA[key], key);
  }
});

test('icons: constants are frozen and each is a single svg element', () => {
  assert.equal(Object.isFrozen(EXPORT_ICON_SVGS), true);
  for (const svg of [INFO_ICON_SVG, RISK_ICON_SVG, ...Object.values(EXPORT_ICON_SVGS)]) {
    assert.equal(typeof svg, 'string');
    assert.ok(svg.startsWith('<svg ') && svg.endsWith('</svg>'));
    assert.equal(/<script|onload|onerror|javascript:/i.test(svg), false);
  }
});

test('safeHttpUrl: http and https URLs are returned unchanged', () => {
  assert.equal(safeHttpUrl('https://a.example/x'), 'https://a.example/x');
  assert.equal(safeHttpUrl('HTTP://A.EXAMPLE'), 'HTTP://A.EXAMPLE');
  assert.equal(safeHttpUrl('  https://a.example/x?y=1#z  '), 'https://a.example/x?y=1#z');
});

test('safeHttpUrl: javascript:, data:, relative, empty, null and malformed values return null', () => {
  for (const bad of ['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,x', 'vbscript:x', 'file:///etc/passwd', 'ftp://a.example',
    '/relative', '//a.example/x', '', '   ', null, undefined, 'not a url', 42, {}]) {
    assert.equal(safeHttpUrl(bad), null, String(bad));
  }
});
