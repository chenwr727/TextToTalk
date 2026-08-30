import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const src = path.join(repoRoot, "web", "public", "favicon.svg");
const outDir = path.join(here, "..", "build");

if (!fs.existsSync(src)) {
  console.error(`找不到图标源文件：${src}`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

const png = async (size) => sharp(src, { density: 400 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  const dir = Buffer.alloc(16 * entries.length);
  let offset = header.length + dir.length;
  entries.forEach((e, i) => {
    const at = i * 16;
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, at);
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, at + 1);
    dir.writeUInt8(0, at + 2);
    dir.writeUInt8(0, at + 3);
    dir.writeUInt16LE(1, at + 4);
    dir.writeUInt16LE(32, at + 6);
    dir.writeUInt32LE(e.data.length, at + 8);
    dir.writeUInt32LE(offset, at + 12);
    offset += e.data.length;
  });

  return Buffer.concat([header, dir, ...entries.map((e) => e.data)]);
}

function buildIcns(entries) {
  const parts = entries.map(({ type, data }) => {
    const head = Buffer.alloc(8);
    head.write(type, 0, "ascii");
    head.writeUInt32BE(data.length + 8, 4);
    return Buffer.concat([head, data]);
  });
  const body = Buffer.concat(parts);
  const head = Buffer.alloc(8);
  head.write("icns", 0, "ascii");
  head.writeUInt32BE(body.length + 8, 4);
  return Buffer.concat([head, body]);
}

const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const icoEntries = [];
for (const size of icoSizes) {
  icoEntries.push({ size, data: await png(size) });
}

const png1024 = await png(1024);
const png512 = await png(512);
const png256 = await png(256);

fs.writeFileSync(path.join(outDir, "icon.png"), png1024);
fs.writeFileSync(path.join(outDir, "icon.ico"), buildIco(icoEntries));
fs.writeFileSync(
  path.join(outDir, "icon.icns"),
  buildIcns([
    { type: "ic09", data: png512 },
    { type: "ic08", data: png256 },
  ]),
);

console.log(`[icon] 已生成 icon.png / icon.ico / icon.icns -> ${outDir}`);
