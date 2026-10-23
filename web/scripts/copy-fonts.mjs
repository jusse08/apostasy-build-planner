// Copies Futura Book BT (the Untarnished UI font) from the local Apostasy install into static/fonts.
// The copy is committed (private repository); rerun this if the modlist updates the font.
// Without it the app falls back to Jost.
// Usage: node scripts/copy-fonts.mjs [path to MO2 instance]   (default C:\Games\Apostasy)
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const instance = process.argv[2] ?? process.env.APOSTASY_DIR ?? 'C:\\Games\\Apostasy';
const candidates = [
	'mods/Apostasy Futura Book Patch/interface/ImGuiIcons/Fonts/FuturaBook.ttf',
	'mods/ImGui Icons - Untarnished UI/Interface/ImGuiIcons/Fonts/Futura Book Regular.ttf'
];

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'static', 'fonts', 'FuturaBookBT.ttf');
const src = candidates.map((c) => join(instance, c)).find(existsSync);

if (!src) {
	console.warn(`Futura Book BT not found under ${instance}; the app will use Jost instead.`);
} else {
	mkdirSync(dirname(out), { recursive: true });
	copyFileSync(src, out);
	console.log(`Copied ${src} -> ${out}`);
}
