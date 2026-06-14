// Zero-dependency PNG icon generator for the Microsoft 365 app package.
// Produces appPackage/color.png (192x192) and appPackage/outline.png (32x32):
// a white shield emblem on the AuditAlly brand blue. Run: npm run icons
//
// Uses only Node built-ins (zlib + crc32). Replace with branded art anytime.

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "..", "appPackage");

// --- CRC32 (PNG chunk checksum) ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** Encode RGBA pixel buffer (Uint8Array length = w*h*4) to a PNG Buffer. */
function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // 10,11,12 = compression, filter, interlace = 0
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type none
    rgba.copy ? rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
      : Buffer.from(rgba.subarray(y * stride, y * stride + stride)).copy(raw, y * (stride + 1) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- Shield shape test in normalized [0,1] coords ---
function inShield(nx, ny) {
  if (ny < 0.16 || ny > 0.86) return false;
  if (ny <= 0.55) return nx >= 0.22 && nx <= 0.78;
  const t = (ny - 0.55) / (0.86 - 0.55);
  const hw = 0.28 * (1 - t);
  return Math.abs(nx - 0.5) <= hw;
}

function makeImage(size, { bg, shield }) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const nx = (x + 0.5) / size;
      const ny = (y + 0.5) / size;
      const px = inShield(nx, ny) ? shield : bg;
      rgba[i] = px[0];
      rgba[i + 1] = px[1];
      rgba[i + 2] = px[2];
      rgba[i + 3] = px[3];
    }
  }
  return encodePng(size, size, rgba);
}

const BRAND = [15, 108, 189, 255]; // #0F6CBD
const WHITE = [255, 255, 255, 255];
const TRANSPARENT = [0, 0, 0, 0];

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(resolve(OUT_DIR, "color.png"), makeImage(192, { bg: BRAND, shield: WHITE }));
writeFileSync(resolve(OUT_DIR, "outline.png"), makeImage(32, { bg: TRANSPARENT, shield: WHITE }));
console.log("Wrote appPackage/color.png (192x192) and appPackage/outline.png (32x32).");
