// Ritar appikoner (PNG) utan externa beroenden. Kör: node scripts/gen-icons.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

function crc32(buf: Buffer) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size: number, pixel: (x: number, y: number) => [number, number, number]) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x / size, y / size);
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

// Blå bakgrund med ett vitt hus och en bock (fungerar även som "maskable").
const BLUE: [number, number, number] = [29, 78, 216];
const WHITE: [number, number, number] = [255, 255, 255];
function icon(x: number, y: number): [number, number, number] {
  const roof = y >= 0.24 && y <= 0.46 && Math.abs(x - 0.5) <= (y - 0.24) * 1.15 + 0.005;
  const body = x >= 0.3 && x <= 0.7 && y >= 0.45 && y <= 0.74;
  const door = x >= 0.45 && x <= 0.55 && y >= 0.6 && y <= 0.74;
  return (roof || body) && !door ? WHITE : BLUE;
}

const dir = new URL("../public/icons/", import.meta.url);
mkdirSync(dir, { recursive: true });
for (const s of [192, 512]) writeFileSync(new URL(`icon-${s}.png`, dir), png(s, icon));
console.log("Ikoner skrivna.");
