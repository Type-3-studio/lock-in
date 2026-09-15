import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = resolve(root, 'public');
const outDir = resolve(publicDir, 'icons');

const BG = [107, 63, 160];
const FG = [255, 255, 255];

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(size, rgba) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let offset = 0;
  for (let y = 0; y < size; y++) {
    raw[offset++] = 0;
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      raw[offset++] = rgba[i];
      raw[offset++] = rgba[i + 1];
      raw[offset++] = rgba[i + 2];
      raw[offset++] = rgba[i + 3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function inRoundedRect(px, py, x0, y0, x1, y1, r) {
  if (px < x0 || px > x1 || py < y0 || py > y1) return false;
  const cx = Math.max(x0 + r, Math.min(px, x1 - r));
  const cy = Math.max(y0 + r, Math.min(py, y1 - r));
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

function inRing(px, py, cx, cy, ro, ri) {
  const dx = px - cx;
  const dy = py - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 > ro * ro || d2 < ri * ri) return false;
  return dy <= 0;
}

function inShackle(gx, gy) {
  return inRing(gx, gy, 0.5, 0.4, 0.155, 0.085);
}

function inBody(gx, gy) {
  return inRoundedRect(gx, gy, 0.3, 0.46, 0.7, 0.74, 0.07);
}

function inKeyhole(gx, gy) {
  const dx = gx - 0.5;
  const dy = gy - 0.6;
  if (dx * dx + dy * dy <= 0.05 * 0.05) return true;
  return gx >= 0.485 && gx <= 0.515 && gy >= 0.6 && gy <= 0.66;
}

function colorAt(nx, ny, glyphScale, rounded) {
  if (rounded && !inRoundedRect(nx, ny, 0, 0, 1, 1, 0.22)) return [0, 0, 0, 0];
  const cx = 0.5;
  const gx = (nx - cx) / glyphScale + cx;
  const gy = (ny - cx) / glyphScale + cx;
  if (inShackle(gx, gy) || inBody(gx, gy)) {
    return inKeyhole(gx, gy) ? [BG[0], BG[1], BG[2], 255] : [FG[0], FG[1], FG[2], 255];
  }
  return [BG[0], BG[1], BG[2], 255];
}

function renderIcon(size, glyphScale, rounded) {
  const rgba = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = colorAt(x / size, y / size, glyphScale, rounded);
      const i = (y * size + x) * 4;
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = a;
    }
  }
  return encodePng(size, rgba);
}

function writeIcon(name, size, glyphScale, rounded) {
  writeFileSync(resolve(outDir, name), renderIcon(size, glyphScale, rounded));
}

function encodeIco(entries) {
  const dir = Buffer.alloc(6);
  dir.writeUInt16LE(0, 0);
  dir.writeUInt16LE(1, 2);
  dir.writeUInt16LE(entries.length, 4);
  let offset = 6 + entries.length * 16;
  const parts = [dir];
  for (const { size, data } of entries) {
    const e = Buffer.alloc(16);
    e[0] = size >= 256 ? 0 : size;
    e[1] = size >= 256 ? 0 : size;
    e[2] = 0;
    e[3] = 0;
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    parts.push(e);
    offset += data.length;
  }
  parts.push(...entries.map((e) => e.data));
  return Buffer.concat(parts);
}

mkdirSync(outDir, { recursive: true });
mkdirSync(publicDir, { recursive: true });
writeIcon('icon-192.png', 192, 1, true);
writeIcon('icon-512.png', 512, 1, true);
writeIcon('icon-192-maskable.png', 192, 0.78, false);
writeIcon('icon-512-maskable.png', 512, 0.78, false);

const faviconSizes = [16, 32, 48];
const faviconEntries = faviconSizes.map((size) => {
  const data = renderIcon(size, 1, true);
  writeFileSync(resolve(publicDir, `favicon-${size}.png`), data);
  return { size, data };
});
writeFileSync(resolve(publicDir, 'favicon.ico'), encodeIco(faviconEntries));

writeFileSync(resolve(publicDir, 'apple-touch-icon.png'), renderIcon(180, 1, false));

console.log(`Generated icons in ${outDir}`);
console.log(`Generated favicon.ico + favicon-16/32/48.png + apple-touch-icon.png in ${publicDir}`);
