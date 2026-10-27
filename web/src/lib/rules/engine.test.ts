import { describe, expect, it } from 'vitest';
import { gameModel } from '#lib/server/data.ts';
import {
	atLevel,
	evalConditions,
	newBuildState,
	perksGained,
	raiseCost,
	simulate,
	skillCap,
	skillPointsGained,
	startingSkills,
	trainCost,
	xpTotal
} from './engine';

const game = gameModel();
const l = game.leveling;

describe('leveling formulas (values documented in Apostasy GAMEPLAY.md)', () => {
	// GAMEPLAY.md lists 3,500 / 37,500 / 125,000 for "L10 / L50 / L100": those sums run through
	// that level-up, i.e. they are the totals for reaching L11 / L51 / L101.
	it('XP curve: 240 + 20 x level', () => {
		expect(xpTotal(l, 2)).toBe(260);
		expect(xpTotal(l, 11)).toBe(3500);
		expect(xpTotal(l, 51)).toBe(37500);
		expect(xpTotal(l, 101)).toBe(125000);
	});

	it('skill cap: 18 + 2.75 x level, max 100', () => {
		expect(skillCap(l, 1)).toBe(20);
		expect(skillCap(l, 10)).toBe(45);
		expect(skillCap(l, 20)).toBe(73);
		expect(skillCap(l, 30)).toBe(100);
		expect(skillCap(l, 60)).toBe(100);
	});

	it('skill points: 15 + level, capped at 60', () => {
		expect(skillPointsGained(l, 1)).toBe(0);
		expect(skillPointsGained(l, 2)).toBe(17);
		expect(skillPointsGained(l, 45)).toBe(60);
		expect(skillPointsGained(l, 70)).toBe(60);
	});

	it('skill cost brackets 1/2/4/6', () => {
		expect(raiseCost(l, 0, 25)).toBe(25);
		expect(raiseCost(l, 25, 1)).toBe(2);
		expect(raiseCost(l, 50, 1)).toBe(4);
		expect(raiseCost(l, 75, 25)).toBe(150);
	});

	it('perks per level from Skyrim Uncapper: 2 every fifth level, none after 50', () => {
		expect(perksGained(l, 1)).toBe(0);
		expect(perksGained(l, 2)).toBe(1);
		expect(perksGained(l, 5)).toBe(2);
		expect(perksGained(l, 50)).toBe(2);
		expect(perksGained(l, 51)).toBe(0);
		let total = 0;
		for (let i = 2; i <= 50; i++) total += perksGained(l, i);
		expect(total).toBe(59);
		expect(atLevel(l.attributeAtLevel, 2)).toBe(20);
		expect(atLevel(l.attributeAtLevel, 3)).toBe(10);
	});
});

describe('character creation', () => {
	it('class script sets all skills to base and raises major/minor', () => {
		const b = { ...newBuildState(), race: 'Nord', class: 'Assassin' };
		const s = startingSkills(game, b);
		expect(s.Alchemy).toBe(20);
		expect(s.Sneak).toBe(15);
		expect(s.TwoHanded).toBe(10); // Nord boost is overwritten
	});

	it('Crusader keeps the mod bug: no major skill', () => {
		const b = { ...newBuildState(), class: 'Crusader' };
		const s = startingSkills(game, b);
		expect(s.Restoration).toBe(15);
		expect(s.Destruction).toBe(10);
		expect(game.classes.find((c) => c.id === 'Crusader')!.warnings.length).toBeGreaterThan(0);
	});

	it('starting attributes add the Player record offsets to the race', () => {
		const start = (id: string) => game.races.find((r) => r.id === id)!.start;
		expect(start('Nord')).toEqual({ Health: 100, Magicka: 100, Stamina: 100 });
		expect(start('HighElf').Magicka).toBe(150);
	});

	it('Imperial and Prisoner start with an extra perk point', () => {
		expect(game.races.find((r) => r.id === 'Imperial')!.startingPerkPoints).toBe(1);
		expect(game.classes.find((c) => c.id === 'Prisoner')!.startingPerkPoints).toBe(1);
	});
});

describe('perk requirements', () => {
	const tree = game.trees.find((t) => t.skill === 'OneHanded')!;
	const byName = (n: string) => Object.values(game.perks).find((p) => p.name === n && tree.nodes.some((x) => x.perk === p.key))!;

	it('Skirmisher needs One-handed 10', () => {
		const p = byName('Skirmisher');
		expect(evalConditions(game, p.conditions, { OneHanded: 9 }, new Set()).ok).toBe(false);
		expect(evalConditions(game, p.conditions, { OneHanded: 10 }, new Set()).ok).toBe(true);
	});

	it('simulation flags a perk taken before its skill requirement', () => {
		const p = byName('Skirmisher');
		const b = { ...newBuildState(), class: 'Mage', targetLevel: 2, levels: { 2: { skills: {}, perks: [p.key], attribute: null } } };
		const sim = simulate(game, b);
		expect(sim.issues.some((i) => i.kind === 'perkRequirement')).toBe(false); // base 10 meets 10
		const b2 = { ...b, levels: { 2: { skills: {}, perks: [byName('Overrun').key], attribute: null } } };
		expect(simulate(game, b2).issues.some((i) => i.kind === 'perkRequirement')).toBe(true);
	});

	it('simulation tracks skill point budget and caps', () => {
		const b = { ...newBuildState(), class: 'Rogue', targetLevel: 2, levels: { 2: { skills: { OneHanded: 5 }, perks: [], attribute: 'Health' as const } } };
		const st = simulate(game, b).levels[1];
		expect(st.skills.OneHanded).toBe(25);
		expect(st.skillPointsSpent).toBe(5);
		expect(st.skillPointsLeft).toBe(12);
		expect(st.attributes.Health).toBe(120); // no race: 100, +20 below level 3
		const over = { ...b, levels: { 2: { skills: { OneHanded: 10 }, perks: [], attribute: null } } };
		expect(simulate(game, over).issues.some((i) => i.kind === 'skillCap')).toBe(true);
	});

	it('skill points reach only the previous level cap, trainers the current one', () => {
		const at = (level: number, skills: Record<string, number>, trained: Record<string, number> = {}) => {
			const levels = { [level]: { skills, trained, perks: [], attribute: null } };
			return simulate(game, { ...newBuildState(), class: 'Rogue', targetLevel: level, levels });
		};
		expect(at(2, {}).levels[1].skillPointCap).toBe(20);
		expect(at(2, { OneHanded: 1 }).issues.some((i) => i.kind === 'skillCap')).toBe(true); // 21 > 20
		expect(at(2, {}, { OneHanded: 3 }).issues).toEqual([]); // 23, the level 2 cap
		expect(at(3, { OneHanded: 3 }).issues).toEqual([]); // 23, the level 2 cap
	});

	it('trainers: priced from the current level, five sessions a level, on top of skill points', () => {
		expect(trainCost(20, 30)).toBe(11850); // UESP's worked example, 20 to 50
		expect(trainCost(51, 1)).toBe(30 * 51 + 50);
		expect(trainCost(80, 1)).toBe(50 * 80 + 50);
		const b = { ...newBuildState(), class: 'Rogue', targetLevel: 2, levels: { 2: { skills: { Sneak: 1 }, trained: { OneHanded: 3 }, perks: [], attribute: null } } };
		const st = simulate(game, b).levels[1];
		expect(st.skills.OneHanded).toBe(23); // 20 + 3 sessions, the level 2 cap
		expect(st.skillPointsSpent).toBe(1);
		expect(st.trainingGold).toBe(trainCost(20, 3));
		expect(simulate(game, b).issues).toEqual([]);
		const many = { ...b, levels: { 2: { skills: {}, trained: { OneHanded: 3, Sneak: 3 }, perks: [], attribute: null } } };
		expect(simulate(game, many).issues.some((i) => i.kind === 'training')).toBe(true);
	});

	it('stances are tagged and inherited down the branch', () => {
		expect(byName('Grievous Wounds').stance).toBe('Wolf');
		expect(byName('Carve and Spit').stance).toBe('Wolf');
		expect(byName('Skirmisher').stance).toBeNull();
	});
});
