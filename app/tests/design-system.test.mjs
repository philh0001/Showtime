import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { BrandColors, ControlSize, Layout } from '../src/constants/design.ts';

function luminance(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map((value) => {
    const channel = Number.parseInt(value, 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('brand tokens keep readable text and usable controls', () => {
  assert.ok(contrast(BrandColors.text, BrandColors.background) >= 7);
  assert.ok(contrast(BrandColors.onGold, BrandColors.gold) >= 4.5);
  assert.ok(contrast(BrandColors.textMuted, BrandColors.background) >= 4.5);
  assert.ok(ControlSize.minimum >= 44);
  assert.equal(Layout.maxContentWidth, 1120);
});

test('brand SVGs are original accessible vector assets', async () => {
  for (const name of ['showtime-logo.svg', 'showtime-mark.svg']) {
    const svg = await readFile(path.resolve(import.meta.dirname, '..', 'assets', 'images', name), 'utf8');
    assert.match(svg, /^<svg/);
    assert.match(svg, /<title>Showtime(?: logo)?<\/title>/);
    assert.match(svg, /<linearGradient/);
    assert.doesNotMatch(svg, /<image|data:image|SHOWTIME NETWORKS/i);
  }
});
