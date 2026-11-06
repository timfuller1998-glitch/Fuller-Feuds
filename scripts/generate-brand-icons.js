#!/usr/bin/env node
/**
 * Regenerates PWA / favicon / logo PNGs from public/brand/logo-editorial.svg
 * Usage: node scripts/generate-brand-icons.js
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const svgPath = path.join(root, 'public', 'brand', 'logo-editorial.svg');
const publicDir = path.join(root, 'public');
const cream = { r: 246, g: 239, b: 225, alpha: 1 };

function pngToIco(pngBuf) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuf.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, pngBuf]);
}

async function render(size, outName, { pad = 0 } = {}) {
  const outPath = path.join(publicDir, outName);
  if (pad > 0) {
    const inner = Math.round(size * (1 - pad * 2));
    const buf = await sharp(fs.readFileSync(svgPath), { density: 300 })
      .resize(inner, inner, { fit: 'contain', background: cream })
      .png()
      .toBuffer();
    await sharp({ create: { width: size, height: size, channels: 4, background: cream } })
      .composite([{ input: buf, gravity: 'centre' }])
      .png()
      .toFile(outPath);
  } else {
    await sharp(fs.readFileSync(svgPath), { density: 300 })
      .resize(size, size, { fit: 'contain', background: cream })
      .png()
      .toFile(outPath);
  }
  console.log('✓', outName);
}

async function main() {
  if (!fs.existsSync(svgPath)) throw new Error(`Missing ${svgPath}`);
  await render(512, 'logo.png');
  await render(512, 'pwa-512x512.png');
  await render(192, 'pwa-192x192.png');
  await render(64, 'pwa-64x64.png');
  await render(180, 'apple-touch-icon-180x180.png');
  await render(512, 'maskable-icon-512x512.png', { pad: 0.12 });
  const fav32 = await sharp(fs.readFileSync(svgPath), { density: 300 }).resize(32, 32).png().toBuffer();
  fs.writeFileSync(path.join(publicDir, 'favicon-32x32.png'), fav32);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), pngToIco(fav32));
  fs.copyFileSync(svgPath, path.join(publicDir, 'logo.svg'));
  console.log('✓ favicon.ico, favicon-32x32.png, logo.svg');
}

main().catch((e) => { console.error(e); process.exit(1); });
