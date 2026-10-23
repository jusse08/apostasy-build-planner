// Copies a handful of Untarnished UI's ImGui icons (mouse buttons, steppers) from the local
// Apostasy install into static/icons, so controls look like the modlist's menus.
// Like the font, the copies are committed (private repository); rerun this if the modlist updates the mod.
// Usage: node scripts/copy-icons.mjs [path to MO2 instance]   (default C:\Games\Apostasy)
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const instance = process.argv[2] ?? process.env.APOSTASY_DIR ?? 'C:\\Games\\Apostasy';
const dir = join(instance, 'mods', 'ImGui Icons - Untarnished UI', 'Interface', 'ImGuiIcons', 'Icons');
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'static', 'icons');

// [source, output]: output names are what the CSS refers to.
const files = [
	['Mouse1.png', 'mouse1.png'],
	['Mouse2.png', 'mouse2.png'],
	['Wheel.png', 'wheel.png'],
	['StepperLeft.png', 'stepper-left.png'],
	['StepperRight.png', 'stepper-right.png']
];

if (!existsSync(dir)) {
	console.warn(`ImGui Icons - Untarnished UI not found under ${instance}; controls keep their plain look.`);
} else {
	mkdirSync(out, { recursive: true });
	for (const [src, dst] of files) {
		copyFileSync(join(dir, src), join(out, dst));
		console.log(`${src} -> ${join(out, dst)}`);
	}
}
