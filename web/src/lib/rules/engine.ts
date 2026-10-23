// Level-by-level simulation of a build under Apostasy's rules:
// Experience (XP curve, skill cap), Static Skill Leveling (skill points), Skyrim Uncapper
// (perks and attributes per level) and Nirn's Chosen (starting skills from the class).

import type {
	Attribute,
	BuildState,
	Condition,
	FormKey,
	GameModel,
	LevelPlan,
	Leveling,
	Perk,
	SkillId
} from '#lib/types.ts';

export const ATTRIBUTES: Attribute[] = ['Health', 'Magicka', 'Stamina'];

export function emptyLevel(): LevelPlan {
	return { skills: {}, perks: [], attribute: null };
}

export function newBuildState(): BuildState {
	return {
		race: null,
		class: null,
		stone: null,
		deity: null,
		targetLevel: 30,
		levels: {},
		perkSources: [],
		notes: ''
	};
}

/** Value of a "from level N" table ([[0,1],[5,2],[6,1]...]) at a level. */
export function atLevel(table: [number, number][], level: number): number {
	let v = 0;
	for (const [from, value] of table) if (level >= from) v = value;
	return v;
}

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(l: Leveling, level: number): number {
	return l.xpBase + l.xpMult * level;
}

/** Total XP needed to reach `level` from level 1. */
export function xpTotal(l: Leveling, level: number): number {
	let t = 0;
	for (let i = 1; i < level; i++) t += xpToNext(l, i);
	return t;
}

/** Highest base skill allowed at a character level (Experience's level-based cap). */
export function skillCap(l: Leveling, level: number): number {
	return Math.min(l.skillCap.max, Math.floor(l.skillCap.base + l.skillCap.mult * level));
}

/** Skill points gained on reaching `level` (none at level 1). */
export function skillPointsGained(l: Leveling, level: number): number {
	if (level < 2) return 0;
	return Math.min(l.skillPoints.cap, Math.floor(l.skillPoints.perLevel + l.skillPoints.levelMult * level));
}

/** Cost of raising a skill from `value` to `value + 1`. Brackets: 0-25, 26-50, 51-75, 76-100. */
export function stepCost(l: Leveling, value: number): number {
	const [c0, c25, c50, c75] = l.skillPoints.costs;
	const next = value + 1;
	if (next <= 25) return c0;
	if (next <= 50) return c25;
	if (next <= 75) return c50;
	return c75;
}

export function raiseCost(l: Leveling, from: number, by: number): number {
	let c = 0;
	for (let v = from; v < from + by; v++) c += stepCost(l, v);
	return c;
}

/** Perk points gained on reaching `level` (none at level 1). */
export function perksGained(l: Leveling, level: number): number {
	return level < 2 ? 0 : atLevel(l.perksAtLevel, level);
}

export function startingSkills(game: GameModel, build: BuildState): Record<SkillId, number> {
	const out: Record<SkillId, number> = {};
	const cls = game.classes.find((c) => c.id === build.class);
	const race = game.races.find((r) => r.id === build.race);
	const { base, major, minor } = game.leveling.classSkill;
	for (const s of game.skills) {
		// With a class the controller script SETS skills, overwriting racial boosts.
		if (cls) out[s.id] = base;
		else out[s.id] = game.leveling.skillStart + (race?.skillBoosts[s.id] ?? 0);
	}
	if (cls) {
		if (cls.majorSkill && cls.majorSkill in out) out[cls.majorSkill] = base + major;
		for (const m of cls.minorSkills) if (m in out) out[m] = base + minor;
	}
	return out;
}

export type IssueKind = 'skillPoints' | 'skillCap' | 'skillGain' | 'perkPoints' | 'perkRequirement' | 'perkRank' | 'perkUnknown';

export interface Issue {
	level: number;
	kind: IssueKind;
	message: string;
	skill?: SkillId;
	perk?: FormKey;
}

export interface LevelState {
	level: number;
	xpTotal: number;
	skills: Record<SkillId, number>; // after this level's increases
	skillCap: number;
	skillPointsGained: number;
	skillPointsAvailable: number; // carried + gained, before spending
	skillPointsSpent: number;
	skillPointsLeft: number;
	perkPointsGained: number;
	perkPointsTotal: number; // cumulative earned up to this level
	perksTaken: Set<FormKey>; // cumulative, including this level
	perkPointsSpent: number; // cumulative
	attributes: Record<Attribute, number>;
	issues: Issue[];
}

export interface Simulation {
	levels: LevelState[];
	issues: Issue[];
	bonusPerkPoints: number;
	/** Level at which each perk was taken. */
	takenAt: Map<FormKey, number>;
}

/** Perk points that don't come from leveling: race/class abilities and checked quests/items. */
export function bonusPerkPoints(game: GameModel, build: BuildState): number {
	const race = game.races.find((r) => r.id === build.race);
	const cls = game.classes.find((c) => c.id === build.class);
	let n = (race?.startingPerkPoints ?? 0) + (cls?.startingPerkPoints ?? 0);
	for (const id of build.perkSources) {
		const src = game.perkSources.find((s) => s.id === id);
		if (src?.enabled) n += src.points;
	}
	return n;
}

/** Rank chain of a tree node perk: [rank1, rank2, ...]. */
export function rankChain(game: GameModel, first: FormKey): FormKey[] {
	const chain: FormKey[] = [];
	let k: FormKey | null = first;
	while (k && game.perks[k] && !chain.includes(k)) {
		chain.push(k);
		k = game.perks[k].nextPerk;
	}
	return chain;
}

/** Previous rank of a perk, if it is rank 2+ of some chain. */
export function previousRank(game: GameModel, key: FormKey): FormKey | null {
	for (const p of Object.values(game.perks)) if (p.nextPerk === key) return p.key;
	return null;
}

export interface ConditionResult {
	condition: Condition;
	ok: boolean;
	/** False for functions the planner can't evaluate (assumed satisfied). */
	known: boolean;
	label: string;
}

function compare(a: number, op: string, b: number): boolean {
	switch (op) {
		case '==': return a === b;
		case '!=': return a !== b;
		case '>': return a > b;
		case '>=': return a >= b;
		case '<': return a < b;
		case '<=': return a <= b;
		default: return true;
	}
}

export function describeCondition(game: GameModel, c: Condition): string {
	const v = c.value ?? 0;
	if (c.fn === 'GetBaseActorValue') {
		const skill = String(c.args?.actorValue ?? '');
		const name = game.skills.find((s) => s.id === skill)?.name ?? skill;
		return `${name} ${c.op} ${v}`;
	}
	if (c.fn === 'HasPerk') {
		const key = String(c.args?.perk ?? '');
		const name = game.perks[key]?.name ?? c.argNames?.perk ?? key;
		return v >= 1 && c.op === '==' ? `Has ${name}` : `Lacks ${name}`;
	}
	const args = Object.values(c.argNames ?? c.args ?? {}).join(', ');
	return `${c.fn}(${args}) ${c.op} ${v}`;
}

export function evalCondition(
	game: GameModel,
	c: Condition,
	skills: Record<SkillId, number>,
	perks: Set<FormKey>
): ConditionResult {
	const label = describeCondition(game, c);
	if (c.fn === 'GetBaseActorValue') {
		const skill = String(c.args?.actorValue ?? '');
		if (!(skill in skills)) return { condition: c, ok: true, known: false, label };
		return { condition: c, ok: compare(skills[skill], c.op, c.value ?? 0), known: true, label };
	}
	if (c.fn === 'HasPerk') {
		const has = perks.has(String(c.args?.perk ?? '')) ? 1 : 0;
		return { condition: c, ok: compare(has, c.op, c.value ?? 0), known: true, label };
	}
	return { condition: c, ok: true, known: false, label };
}

/**
 * Skyrim condition lists: an OR flag joins a condition with the next one; OR groups are then
 * ANDed together ((a OR b) AND c ...).
 */
export function evalConditions(
	game: GameModel,
	conditions: Condition[],
	skills: Record<SkillId, number>,
	perks: Set<FormKey>
): { ok: boolean; groups: ConditionResult[][] } {
	const groups: ConditionResult[][] = [];
	let current: ConditionResult[] = [];
	for (const c of conditions) {
		current.push(evalCondition(game, c, skills, perks));
		if (!c.or) {
			groups.push(current);
			current = [];
		}
	}
	if (current.length) groups.push(current);
	return { ok: groups.every((g) => g.some((r) => r.ok)), groups };
}

export function simulate(game: GameModel, build: BuildState): Simulation {
	const l = game.leveling;
	const bonus = bonusPerkPoints(game, build);
	const skills = startingSkills(game, build);
	const race = game.races.find((r) => r.id === build.race);
	const attributes: Record<Attribute, number> = {
		Health: race?.start.Health ?? 100,
		Magicka: race?.start.Magicka ?? 100,
		Stamina: race?.start.Stamina ?? 100
	};
	const taken = new Set<FormKey>();
	const takenAt = new Map<FormKey, number>();
	const levels: LevelState[] = [];
	const all: Issue[] = [];
	let carry = 0;
	let perkTotal = bonus;
	let perkSpent = 0;

	for (let level = 1; level <= build.targetLevel; level++) {
		const plan = build.levels[level] ?? emptyLevel();
		const issues: Issue[] = [];
		const cap = skillCap(l, level);

		// Attribute chosen on reaching this level.
		if (level >= 2 && plan.attribute) attributes[plan.attribute] += atLevel(l.attributeAtLevel, level);

		// Skill points: gained on level-up, unspent points carry over up to the cap.
		const gained = skillPointsGained(l, level);
		const available = Math.min(l.skillPoints.cap, carry + gained);
		let spent = 0;
		for (const [skill, by] of Object.entries(plan.skills)) {
			if (!by || !(skill in skills)) continue;
			spent += raiseCost(l, skills[skill], by);
			skills[skill] += by;
			if (by > l.maxSkillGainPerLevel)
				issues.push({ level, kind: 'skillGain', skill, message: `${skillName(game, skill)}: more than +${l.maxSkillGainPerLevel} in one level` });
			if (skills[skill] > cap)
				issues.push({ level, kind: 'skillCap', skill, message: `${skillName(game, skill)} ${skills[skill]} is above the level ${level} cap of ${cap}` });
		}
		if (spent > available)
			issues.push({ level, kind: 'skillPoints', message: `Spent ${spent} skill points, only ${available} available` });
		carry = Math.max(0, available - spent);

		// Perks: earned points are cumulative; requirements use skills after this level's raises.
		const perkGained = perksGained(l, level);
		perkTotal += perkGained;
		for (const key of plan.perks) {
			taken.add(key);
			takenAt.set(key, level);
		}
		for (const key of plan.perks) {
			const perk = game.perks[key];
			// Dragonborn / Vampire Lord / Werewolf perks have their own currencies.
			if (!perk || perk.treeKind === 'skill' || perk.treeKind === null) perkSpent += 1;
			if (!perk) {
				issues.push({ level, kind: 'perkUnknown', perk: key, message: `Perk ${key} is not in the game data` });
				continue;
			}
			const prev = previousRank(game, key);
			if (prev && !taken.has(prev))
				issues.push({ level, kind: 'perkRank', perk: key, message: `${perk.name}: take the previous rank first` });
			const res = evalConditions(game, perk.conditions, skills, taken);
			if (!res.ok) {
				const failed = res.groups.filter((g) => !g.some((r) => r.ok)).map((g) => g.map((r) => r.label).join(' or '));
				issues.push({ level, kind: 'perkRequirement', perk: key, message: `${perk.name} at level ${level} needs ${failed.join(', ')}` });
			}
		}
		if (perkSpent > perkTotal)
			issues.push({ level, kind: 'perkPoints', message: `${perkSpent} perks taken by level ${level}, only ${perkTotal} perk points earned` });

		const state: LevelState = {
			level,
			xpTotal: xpTotal(l, level),
			skills: { ...skills },
			skillCap: cap,
			skillPointsGained: gained,
			skillPointsAvailable: available,
			skillPointsSpent: spent,
			skillPointsLeft: carry,
			perkPointsGained: perkGained,
			perkPointsTotal: perkTotal,
			perksTaken: new Set(taken),
			perkPointsSpent: perkSpent,
			attributes: { ...attributes },
			issues
		};
		levels.push(state);
		all.push(...issues);
	}
	return { levels, issues: all, bonusPerkPoints: bonus, takenAt };
}

export function skillName(game: GameModel, id: SkillId): string {
	return game.skills.find((s) => s.id === id)?.name ?? id;
}

export type NodeStatus = 'taken' | 'available' | 'locked';

/** Status of a perk at a level, for drawing: taken by then, takeable now, or not yet. */
export function perkStatus(game: GameModel, sim: Simulation, key: FormKey, level: number): NodeStatus {
	const st = sim.levels[level - 1];
	if (!st) return 'locked';
	if (st.perksTaken.has(key)) return 'taken';
	const perk: Perk | undefined = game.perks[key];
	if (!perk) return 'locked';
	const prev = previousRank(game, key);
	if (prev && !st.perksTaken.has(prev)) return 'locked';
	return evalConditions(game, perk.conditions, st.skills, st.perksTaken).ok ? 'available' : 'locked';
}
