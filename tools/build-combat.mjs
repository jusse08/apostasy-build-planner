// Builds data/combat.json from tools/combat-notes.json: hand-written summaries of combat-related
// mods, plus each mod's Nexus URL and whether it is enabled, read from the local MO2 install.
// Usage: node tools/build-combat.mjs [MO2 instance dir] [profile]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const instance = process.argv[2] ?? 'C:/Games/Apostasy';
const profile = process.argv[3] ?? 'Apostasy';
const notes = JSON.parse(readFileSync('tools/combat-notes.json', 'utf8'));
const enabled = new Set(
	readFileSync(join(instance, 'profiles', profile, 'modlist.txt'), 'utf8')
		.split(/\r?\n/)
		.filter((l) => l.startsWith('+'))
		.map((l) => l.slice(1))
);

for (const group of notes)
	for (const item of group.items) {
		if (item.url) continue; // given by hand
		const meta = join(instance, 'mods', item.mod, 'meta.ini');
		item.enabled = enabled.has(item.mod);
		item.url = null;
		if (existsSync(meta)) {
			const t = readFileSync(meta, 'utf8');
			const id = t.match(/^modid=(\d+)/m)?.[1];
			item.url = t.match(/^url=(.+)$/m)?.[1] ?? (id && id !== '0' ? `https://www.nexusmods.com/skyrimspecialedition/mods/${id}` : null);
		}
		if (!item.enabled) console.warn(`not enabled in ${profile}: ${item.mod}`);
	}

writeFileSync('data/combat.json', JSON.stringify({ groups: notes }, null, 2) + '\n');
console.log('wrote data/combat.json');
