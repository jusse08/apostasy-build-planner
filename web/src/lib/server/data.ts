import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type {
	CharClass,
	Condition,
	Deity,
	GameModel,
	Perk,
	PerkPointSource,
	Race,
	Shout,
	Spell,
	Tree
} from '#lib/types.ts';

// Extracted JSON lives in ../data during development and /app/data in the container.
const dataDir = process.env.DATA_DIR ?? resolve(process.cwd(), '..', 'data');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

function read(name: string): Raw {
	return JSON.parse(readFileSync(join(dataDir, name), 'utf8'));
}

function spell(raw: Raw): Spell | null {
	if (!raw) return null;
	return {
		formKey: raw.formKey,
		name: raw.name,
		description: raw.description,
		effects: (raw.effects ?? []).map((e: Raw) => ({
			name: e.name,
			description: e.description,
			magnitude: e.magnitude,
			duration: e.duration,
			conditions: e.conditions,
			perk: e.perk ? { name: e.perk.name, description: e.perk.description } : undefined
		}))
	};
}

// "You start with 1 additional Perk point." on a racial / class ability.
function startingPerkPoints(spells: (Spell | null)[]): number {
	let total = 0;
	for (const s of spells)
		for (const e of s?.effects ?? []) {
			const m = /start with (\d+) additional Perk point/i.exec(e.description ?? '');
			if (m) total += Number(m[1]);
		}
	return total;
}

// Uncapper / INI tables like {"0": 1, "5": 2, ...} -> sorted [level, value] pairs.
function table(raw: Record<string, number> | undefined): [number, number][] {
	return Object.entries(raw ?? { 0: 0 })
		.map(([k, v]) => [Number(k), Number(v)] as [number, number])
		.sort((a, b) => a[0] - b[0]);
}

function questGroup(id: string): PerkPointSource['group'] {
	if (id.startsWith('MQ')) return 'main';
	if (id.startsWith('DLC') || id.startsWith('WT_')) return 'dlc'; // WT_ = Wyrmstooth
	if (id.startsWith('DA')) return 'daedric';
	if (/^(C0|MG|TG|DB|CW|MS05)/.test(id)) return 'guild';
	if (/^(T0|MS|dun)/i.test(id)) return 'side';
	return 'other';
}

function build(): GameModel {
	const perksRaw = read('perks.json');
	const races = read('races.json');
	const classes = read('classes.json');
	const stones = read('stones.json');
	const religions = read('religions.json');
	const leveling = read('leveling.json');
	const shouts = read('shouts.json');
	const manual = read('manual.json');

	const perks: Record<string, Perk> = {};
	for (const [key, p] of Object.entries<Raw>(perksRaw.perks))
		perks[key] = {
			key,
			editorId: p.editorId,
			name: p.name,
			description: p.description,
			plugin: p.plugin,
			nextPerk: p.nextPerk,
			conditions: p.conditions,
			stance: (/\b(Wolf|Hawk|Bear) Stance\b/.exec(p.description ?? '')?.[1] as Perk['stance']) ?? null,
			tree: null,
			treeKind: null
		};

	const trees: Tree[] = perksRaw.trees.map((t: Raw) => ({
		id: t.id,
		name: t.name,
		skill: t.skill,
		description: t.description,
		kind: t.skill ? 'skill' : t.customSkill ? 'dragonborn' : 'transformation',
		nodes: t.nodes.map((n: Raw) => ({
			index: n.index,
			perk: n.perk,
			x: (n.gridX ?? 0) + (n.x ?? 0),
			y: (n.gridY ?? 0) + (n.y ?? 0),
			links: n.links
		}))
	}));

	for (const t of trees)
		for (const n of t.nodes) {
			let k = n.perk;
			while (k && perks[k] && !perks[k].tree) {
				perks[k].tree = t.id;
				perks[k].treeKind = t.kind;
				k = perks[k].nextPerk;
			}
		}

	// Follow-up perks ("Grievous Wounds deal more damage") belong to their parent's stance branch.
	for (const t of trees) {
		const byIndex = new Map(t.nodes.map((n) => [n.index, n]));
		const visit = (n: (typeof t.nodes)[number], stance: Perk['stance']) => {
			for (const i of n.links) {
				const child = byIndex.get(i);
				const p = child?.perk ? perks[child.perk] : null;
				if (!child || !p) continue;
				if (!p.stance) p.stance = stance;
				visit(child, p.stance);
			}
		};
		for (const n of t.nodes) {
			const p = n.perk ? perks[n.perk] : null;
			if (p?.stance) visit(n, p.stance);
		}
	}

	const skillTrees = trees.filter((t) => t.skill);
	// Skills menu order: warrior, thief, mage.
	const order = [
		'OneHanded', 'TwoHanded', 'Marksman', 'Block', 'HeavyArmor', 'Smithing',
		'LightArmor', 'Sneak', 'Lockpicking', 'Pickpocket', 'Speechcraft', 'Alchemy',
		'Illusion', 'Conjuration', 'Destruction', 'Restoration', 'Alteration', 'Enchanting'
	];
	skillTrees.sort((a, b) => order.indexOf(a.skill!) - order.indexOf(b.skill!));
	const skills = skillTrees.map((t) => ({ id: t.skill!, name: t.name, tree: t.id }));

	// Race values plus the Player record's offsets: what the game shows at level 1.
	const offsets = races.playerOffsets;
	const raceList: Race[] = races.races.map((r: Raw) => {
		const abilities = r.abilities.map(spell) as Spell[];
		return {
			id: r.id,
			name: r.name,
			description: r.description,
			start: {
				Health: r.start.Health + offsets.Health,
				Magicka: r.start.Magicka + offsets.Magicka,
				Stamina: r.start.Stamina + offsets.Stamina
			},
			skillBoosts: r.skillBoosts,
			abilities,
			startingPerkPoints: startingPerkPoints(abilities)
		};
	});

	const skillLabel = (id: string) => skills.find((s) => s.id === id)?.name ?? id;
	// The extractor's warnings name skills by id (Marksman); show the in-game names (Archery).
	const warning = (w: string) => w.replace(/\b[A-Z][A-Za-z]+\b/g, (word) => (skills.some((s) => s.id === word) ? skillLabel(word) : word));

	const classList: CharClass[] = classes.classes.map((c: Raw) => {
		const ability = spell(c.ability);
		return {
			id: c.id,
			name: c.name,
			description: c.description,
			majorSkill: c.majorSkill,
			minorSkills: c.minorSkills,
			startingGear: c.startingGear,
			ability,
			warnings: c.warnings.map(warning),
			startingPerkPoints: startingPerkPoints([ability])
		};
	});

	const deities: Deity[] = religions.items.map((g: Raw) => {
		const champion = spell(g.champion);
		const seen = new Set<string>();
		const req: Condition[] = [];
		for (const e of champion?.effects ?? [])
			for (const c of e.conditions ?? []) {
				const k = JSON.stringify(c);
				if (!seen.has(k)) {
					seen.add(k);
					req.push(c);
				}
			}
		return {
			id: g.id,
			name: g.name,
			group: g.group,
			blessing: spell(g.blessing),
			acolyte: spell(g.acolyte),
			champion,
			championRequirements: req
		};
	});

	const toggles = leveling.questPerkToggles ?? {};
	const perkSources: PerkPointSource[] = [
		...leveling.questPerks.map((q: Raw) => {
			const group = questGroup(q.id);
			const enabled = group === 'daedric' ? toggles.Daedric !== 0 : true;
			return {
				id: q.id,
				name: manual.questNames?.[q.id] ?? q.name ?? q.id,
				group,
				points: 1,
				enabled
			};
		}),
		...leveling.otherPerkPoints.map((o: Raw) => {
			const names = [...new Set<string>(o.sources.map((s: Raw) => s.name).filter(Boolean))];
			return {
				id: o.script,
				name: names[0] ?? o.script,
				group: 'other' as const,
				points: o.points,
				enabled: true,
				note: [o.note, names.length > 1 ? `Found on: ${names.join(', ')}.` : null].filter(Boolean).join(' ')
			};
		})
	];

	const ssl = leveling.staticSkillLeveling.General;
	const exp = leveling.experience.General;
	const unc = leveling.uncapper;
	const gs = leveling.gameSettings;

	const shoutList: Shout[] = shouts.shouts.map((s: Raw) => ({
		id: s.id,
		name: s.name,
		description: s.description,
		words: s.words.map((w: Raw) => ({ word: w.word, translation: w.translation, cooldown: w.cooldown })),
		meditation: s.meditation?.description ?? null
	}));

	return {
		skills,
		trees: [...skillTrees, ...trees.filter((t) => !t.skill)],
		perks,
		races: raceList,
		classes: classList,
		stones: stones.items.map((s: Raw) => ({
			id: s.id,
			name: s.name,
			description: s.description,
			abilities: s.abilities.map(spell)
		})),
		deities,
		perkSources,
		shouts: shoutList,
		maxMeditations: shouts.dragonbornSettings.maxMeditations,
		leveling: {
			xpBase: gs.fXPLevelUpBase.value,
			xpMult: gs.fXPLevelUpMult.value,
			skillStart: gs.iAVDSkillStart.value,
			classSkill: classes.skillBonus,
			skillPoints: {
				perLevel: ssl.iSkillPointsPerLevel,
				levelMult: ssl.fSkillPointsLevelMultiplier,
				cap: ssl.iSkillPointsCap,
				costs: [ssl.iSkillPointCost0, ssl.iSkillPointCost25, ssl.iSkillPointCost50, ssl.iSkillPointCost75]
			},
			maxSkillGainPerLevel: ssl.iMaxLevelsPerSkillPerPlayerLevel,
			skillCap: { base: exp.fSkillCapBase, mult: exp.fSkillCapMult, max: 100 },
			perksAtLevel: table(unc.PerksAtLevelUp),
			attributeAtLevel: table(unc.HealthAtLevelUp),
			maxLevel: 81
		},
		dataVersion: perksRaw.meta?.generatedAt ?? 'unknown'
	};
}

let cached: { model: GameModel; json: string } | null = null;

export function gameModel(): GameModel {
	cached ??= (() => {
		const model = build();
		return { model, json: JSON.stringify(model) };
	})();
	return cached.model;
}

export function gameModelJson(): string {
	gameModel();
	return cached!.json;
}
