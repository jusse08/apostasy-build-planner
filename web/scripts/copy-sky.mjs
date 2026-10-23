// Converts the perk menu art of Skyrim SE Skill Interface Re-Texture (DXT5 .dds in the local Apostasy
// install) into PNGs under static/sky, so the perk trees look like the game's.
// Like the font, the output is committed (private repository); rerun this if the modlist changes the mod.
// Usage: node scripts/copy-sky.mjs [path to MO2 instance] [out dir]   (default C:\Games\Apostasy)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const instance = process.argv[2] ?? process.env.APOSTASY_DIR ?? 'C:\\Games\\Apostasy';
const out = process.argv[3] ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'static', 'sky');
const dir = join(instance, 'mods', 'Skyrim SE Skill Interface Re-Texture', 'textures', 'interface');

// [source, output, downscale factor]: the page draws them small or dimmed, so full size is wasted.
const files = [
	['intperkstars01.dds', 'stars.png', 2],
	['intperklines.dds', 'lines.png', 4],
	['intfullnebulapanarama.dds', 'nebula.png', 4]
];

/** Decodes the top mip of a DXT5 (BC3) texture into RGBA. */
function readDxt5(buf) {
	if (buf.toString('latin1', 0, 4) !== 'DDS ' || buf.toString('latin1', 84, 88) !== 'DXT5')
		throw new Error('not a DXT5 .dds');
	const h = buf.readUInt32LE(12);
	const w = buf.readUInt32LE(16);
	const px = new Uint8Array(w * h * 4);
	let o = 128;
	for (let by = 0; by < h; by += 4)
		for (let bx = 0; bx < w; bx += 4, o += 16) {
			const a0 = buf[o];
			const a1 = buf[o + 1];
			const alpha = [a0, a1];
			for (let i = 1; i < 7; i++)
				alpha.push(a0 > a1 ? ((7 - i) * a0 + i * a1) / 7 : i < 5 ? ((5 - i) * a0 + i * a1) / 5 : i === 5 ? 0 : 255);
			if (a0 <= a1) alpha.splice(6, 2, 0, 255);
			let abits = 0n;
			for (let i = 0; i < 6; i++) abits |= BigInt(buf[o + 2 + i]) << BigInt(8 * i);

			const c0 = buf.readUInt16LE(o + 8);
			const c1 = buf.readUInt16LE(o + 10);
			const rgb = (c) => [((c >> 11) & 31) * 255 / 31, ((c >> 5) & 63) * 255 / 63, (c & 31) * 255 / 31];
			const p0 = rgb(c0);
			const p1 = rgb(c1);
			const colors = [p0, p1, p0.map((v, i) => (2 * v + p1[i]) / 3), p0.map((v, i) => (v + 2 * p1[i]) / 3)];
			const cbits = buf.readUInt32LE(o + 12);

			for (let i = 0; i < 16; i++) {
				const x = bx + (i & 3);
				const y = by + (i >> 2);
				if (x >= w || y >= h) continue;
				const c = colors[(cbits >> (2 * i)) & 3];
				const p = (y * w + x) * 4;
				px[p] = c[0];
				px[p + 1] = c[1];
				px[p + 2] = c[2];
				px[p + 3] = alpha[Number((abits >> BigInt(3 * i)) & 7n)];
			}
		}
	return { w, h, px };
}

function downscale({ w, h, px }, f) {
	if (f === 1) return { w, h, px };
	const W = Math.floor(w / f);
	const H = Math.floor(h / f);
	const out = new Uint8Array(W * H * 4);
	for (let y = 0; y < H; y++)
		for (let x = 0; x < W; x++)
			for (let c = 0; c < 4; c++) {
				let s = 0;
				for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) s += px[((y * f + dy) * w + x * f + dx) * 4 + c];
				out[(y * W + x) * 4 + c] = s / (f * f);
			}
	return { w: W, h: H, px: out };
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});

function chunk(type, data) {
	const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
	let crc = 0xffffffff;
	for (const b of body) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const sum = Buffer.alloc(4);
	sum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
	return Buffer.concat([len, body, sum]);
}

function png({ w, h, px }) {
	// Opaque images (the nebula) drop the alpha channel.
	let opaque = true;
	for (let i = 3; i < px.length && opaque; i += 4) opaque = px[i] === 255;
	const ch = opaque ? 3 : 4;
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(w, 0);
	ihdr.writeUInt32BE(h, 4);
	ihdr.set([8, opaque ? 2 : 6, 0, 0, 0], 8); // 8-bit RGB or RGBA
	const raw = Buffer.alloc((w * ch + 1) * h);
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++)
			for (let c = 0; c < ch; c++) raw[y * (w * ch + 1) + 1 + x * ch + c] = px[(y * w + x) * 4 + c];
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', ihdr),
		chunk('IDAT', deflateSync(raw, { level: 9 })),
		chunk('IEND', Buffer.alloc(0))
	]);
}

if (!existsSync(dir)) {
	console.warn(`Skill Interface Re-Texture not found under ${instance}; the perk trees keep their drawn stars.`);
} else {
	mkdirSync(out, { recursive: true });
	for (const [src, dst, f] of files) {
		const img = downscale(readDxt5(readFileSync(join(dir, src))), f);
		writeFileSync(join(out, dst), png(img));
		console.log(`${src} -> ${join(out, dst)} (${img.w}x${img.h})`);
	}
}
