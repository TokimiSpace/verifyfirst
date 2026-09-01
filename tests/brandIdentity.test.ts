import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { inflateSync } from 'node:zlib';

const read = (file: string) => fs.readFileSync(path.resolve(file), 'utf8');

const readPngSize = (file: string) => {
  const data = fs.readFileSync(path.resolve(file));
  expect(data.subarray(1, 4).toString()).toBe('PNG');
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
};

const readPngTopLeft = (file: string) => {
  const data = fs.readFileSync(path.resolve(file));
  const chunks: Buffer[] = [];
  let offset = 8;
  while (offset < data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.subarray(offset + 4, offset + 8).toString();
    if (type === 'IDAT') chunks.push(data.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  const scanlines = inflateSync(Buffer.concat(chunks));
  return [...scanlines.subarray(1, 5)];
};

describe('VerifyFirst brand identity', () => {
  it('uses one threshold monogram across every product entry', () => {
    const consumer = read('App.tsx');
    const business = read('apps/business/BusinessApp.tsx');
    const pathways = read('public/trust-pathways/index.html');
    const updateTrust = read('public/update-trust/index.html');

    expect(consumer).toContain("import BrandMark from './components/BrandMark'");
    expect(business).toContain("import BrandMark from '../../components/BrandMark'");
    expect(consumer).toContain('<BrandMark');
    expect(business).toContain('<BrandMark');
    expect(pathways).toContain('src="/verifyfirst-mark.svg"');
    expect(updateTrust).toContain('src="/verifyfirst-mark.svg"');
  });

  it('ships a small native SVG favicon instead of an embedded raster', () => {
    const svg = read('public/favicon.svg');
    expect(Buffer.byteLength(svg)).toBeLessThan(2_000);
    expect(svg).toContain('viewBox="0 0 64 64"');
    expect(svg).not.toContain('data:image');
    expect(svg).toContain('#62d5c0');
    expect(svg).toContain('#f2c14e');
  });

  it('publishes valid favicon, Apple, and install icon sizes', () => {
    const expected = [
      ['public/favicon-16x16.png', 16],
      ['public/favicon-32x32.png', 32],
      ['public/favicon-96x96.png', 96],
      ['public/apple-touch-icon.png', 180],
      ['public/web-app-manifest-192x192.png', 192],
      ['public/web-app-manifest-512x512.png', 512],
    ] as const;

    for (const [file, size] of expected) {
      expect(readPngSize(file)).toEqual({ width: size, height: size });
    }

    const ico = fs.readFileSync(path.resolve('public/favicon.ico'));
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(3);
    const corner = readPngTopLeft('public/favicon-16x16.png');
    expect(corner[0]).toBeLessThan(40);
    expect(corner[1]).toBeLessThan(40);
    expect(corner[2]).toBeLessThan(40);
    expect(corner[3]).toBe(255);
  });

  it('keeps the web manifest connected to files that exist', () => {
    const manifest = JSON.parse(read('public/site.webmanifest')) as { theme_color: string; icons: Array<{ src: string }> };
    expect(manifest.theme_color).toBe('#0B1117');
    for (const icon of manifest.icons) {
      expect(fs.existsSync(path.resolve('public', icon.src.replace(/^\//, '')))).toBe(true);
    }
  });
});
