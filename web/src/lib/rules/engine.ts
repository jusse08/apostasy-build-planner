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
	SkillId,
	Spell
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
		reachedLevel: 2,
		levels: {},
		perkSources: [],
		shoutWords: {},
		meditations: [],
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

/**
 * Gold for one trainer session at skill level `value` (the level before training). Vanilla formula, which
 * nothing in Apostasy changes; Speech and Barter don't affect it (UESP Skyrim:Trainers).
 */
export function trainingCost(value: number): number {
	if (value <= 50) return 10 * value + 50;
	if (value <= 75) return 30 * value + 50;
	return 50 * value + 50;
}

export function trainCost(from: number, by: number): number {
	let c = 0;
	for (let v = from; v < from + by; v++) c += trainingCost(v);
	return c;
}

export type IssueKind = 'skillPoints' | 'skillCap' | 'skillGain' | 'training' | 'book' | 'perkPoints' | 'perkRequirement' | 'perkRank' | 'perkUnknown';

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
	/** Highest skill that skill points reach at this level: the previous level's cap. */
	skillPointCap: number;
	skillPointsGained: number;
	skillPointsAvailable: number; // carried + gained, before spending
	skillPointsSpent: number;
	skillPointsLeft: number;
	/** Skill levels from trainers at this level, per skill. */
	trained: Record<SkillId, number>;
	trainingSessions: number;
	trainingGold: number;
	trainingGoldTotal: number; // cumulative
	/** Skill books read at this level, per skill. */
	booksRead: Record<SkillId, number>;
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
	/** Level at which each skill book was read. */
	readAt: Map<FormKey, number>;
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

/**
 * For yes/no functions (quest completed, has spell...): true if the condition asks for "yes",
 * false if it asks for "no", null if the comparison doesn't reduce to either.
 */
function asksYes(c: Condition): boolean | null {
	const v = c.value ?? 0;
	const yes = compare(1, c.op, v);
	const no = compare(0, c.op, v);
	return yes === no ? null : yes;
}

/** Spells whose presence means something better said in words. */
const STATE_SPELLS: Record<FormKey, [string, string]> = {
	'0F5BA0:Skyrim.esm': ['Be a werewolf', 'Not be a werewolf'],
	'10FB30:Skyrim.esm': ['Be a vampire', 'Not be a vampire']
};

/** Globals with a known meaning, keyed by editor id. */
const STATE_GLOBALS: Record<string, [string, string]> = {
	OghmaInfiniumBookHasBeenRead: ['Read the Oghma Infinium', 'Not read the Oghma Infinium']
};

function argName(c: Condition, arg: string): string {
	return c.argNames?.[arg] ?? String(c.args?.[arg] ?? '?');
}

export function describeCondition(game: GameModel, c: Condition): string {
	const v = c.value ?? 0;
	const yes = asksYes(c);
	if (c.fn === 'GetBaseActorValue') {
		const skill = String(c.args?.actorValue ?? '');
		const name = game.skills.find((s) => s.id === skill)?.name ?? skill;
		return `${name} ${c.op} ${v}`;
	}
	if (c.fn === 'HasPerk') {
		const key = String(c.args?.perk ?? '');
		const name = game.perks[key]?.name ?? c.argNames?.perk ?? key;
		return v >= 1 && c.op === '==' ? name : `no ${name}`;
	}
	if (c.fn === 'GetQuestCompleted' && yes !== null) {
		return `${yes ? 'Complete' : "Don't complete"} ${argName(c, 'quest')}`;
	}
	if (c.fn === 'GetStageDone' && yes !== null) {
		// With the stage's journal entry shown below, the number adds nothing.
		const where = c.stageLog ? 'this point in' : `stage ${c.args?.stage} of`;
		return `${yes ? 'Reach' : "Don't reach"} ${where} ${argName(c, 'quest')}`;
	}
	if (c.fn === 'HasSpell' && yes !== null) {
		const state = STATE_SPELLS[String(c.args?.spell)];
		if (state) return state[yes ? 0 : 1];
		return `${yes ? 'Know' : "Don't know"} ${argName(c, 'spell')}`;
	}
	if (c.fn === 'GetGlobalValue') {
		const state = STATE_GLOBALS[c.argNames?.global ?? ''];
		if (state && yes !== null) return state[yes ? 0 : 1];
	}
	if (c.fn === 'GetItemCount') {
		const item = argName(c, 'itemOrList');
		if (c.op === '==' && v === 0) return `Don't carry ${item}`;
		if ((c.op === '>=' && v === 1) || (c.op === '>' && v === 0)) return `Carry ${item}`;
		return `Carry ${item}: count ${c.op} ${v}`;
	}
	const args = Object.values(c.argNames ?? c.args ?? {}).join(', ');
	return `${c.fn}(${args}) ${c.op} ${v}`;
}

/**
 * Skyrim condition lists: an OR flag joins a condition with the next one; OR groups are then
 * ANDed together ((a OR b) AND c ...).
 */
export function groupConditions(conditions: Condition[]): Condition[][] {
	const groups: Condition[][] = [];
	let current: Condition[] = [];
	for (const c of conditions) {
		current.push(c);
		if (!c.or) {
			groups.push(current);
			current = [];
		}
	}
	if (current.length) groups.push(current);
	return groups;
}

export interface ConditionLine {
	text: string;
	/** The journal entry of a checked quest stage, which says what the stage number means. */
	note?: string;
}

/**
 * Words for one OR group: a single line, or a lead-in plus the options.
 * "Complete one of" when every option is finishing a quest.
 */
export function describeConditionGroup(game: GameModel, group: Condition[]): ConditionLine & { options: ConditionLine[] } {
	const line = (c: Condition): ConditionLine => ({ text: describeCondition(game, c), note: c.stageLog });
	if (group.length === 1) return { ...line(group[0]), options: [] };
	if (group.every((c) => c.fn === 'GetQuestCompleted' && asksYes(c) === true))
		return { text: 'Complete one of:', options: group.map((c) => ({ text: argName(c, 'quest') })) };
	return { text: 'One of:', options: group.map(line) };
}

// Misc stats (the game's General Stats page) in words, plural, as "N+ <stat>" reads.
const MISC_STATS: Record<string, string> = {
	QuestsCompleted: 'quests completed',
	UndeadKilled: 'undead killed',
	Persuasions: 'persuasions',
	SpellsLearned: 'spells learned',
	LocationsDiscovered: 'locations discovered',
	DungeonsCleared: 'dungeons cleared',
	DaedraKilled: 'daedra killed',
	DragonSoulsCollected: 'dragon souls absorbed',
	Barters: 'barters',
	SoulGemsUsed: 'soul gems used',
	PeopleKilled: 'people killed',
	BooksRead: 'books read',
	CreaturesKilled: 'creatures killed',
	Murders: 'murders',
	SoulsTrapped: 'souls trapped',
	PocketsPicked: 'pockets picked',
	AutomationsKilled: 'Dwarven automatons killed',
	BrawlsWon: 'brawls won',
	WingsPlucked: 'wings plucked',
	SneakAttacks: 'sneak attacks'
};

export function miscStatName(stat: string): string {
	return MISC_STATS[stat] ?? stat.replace(/(?<=[a-z])(?=[A-Z])/g, ' ').toLowerCase();
}

export interface StatTier {
	/** Lowest stat value the tier needs. */
	from: number;
	stat: string;
	text: string;
}

/**
 * Tiers of a spell whose effects switch on by a misc stat (Archon's Acolyte: "more than 4
 * quests completed, less than 10"), lowest first. Empty when the effects aren't built that way.
 */
export function statTiers(spell: Spell | null): StatTier[] {
	const tiers: StatTier[] = [];
	for (const e of spell?.effects ?? []) {
		const low = e.conditions?.find((c) => c.fn === 'GetPCMiscStat' && (c.op === '>' || c.op === '>='));
		const text = e.description ?? e.perk?.description;
		if (!low || !text) return [];
		const from = (low.value ?? 0) + (low.op === '>' ? 1 : 0);
		tiers.push({ from, stat: miscStatName(String(low.args?.miscStat ?? '')), text });
	}
	return tiers.sort((x, y) => x.from - y.from);
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

export function evalConditions(
	game: GameModel,
	conditions: Condition[],
	skills: Record<SkillId, number>,
	perks: Set<FormKey>
): { ok: boolean; groups: ConditionResult[][] } {
	const groups = groupConditions(conditions).map((g) => g.map((c) => evalCondition(game, c, skills, perks)));
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
	const readAt = new Map<FormKey, number>();
	const books = new Map(game.books.map((b) => [b.key, b]));
	const levels: LevelState[] = [];
	const all: Issue[] = [];
	let carry = 0;
	let perkTotal = bonus;
	let perkSpent = 0;
	let goldTotal = 0;

	for (let level = 1; level <= build.targetLevel; level++) {
		const plan = build.levels[level] ?? emptyLevel();
		const issues: Issue[] = [];
		const cap = skillCap(l, level);
		// The level-up menu stops at the cap of the level being left; trainers and books reach the new one.
		const pointCap = skillCap(l, Math.max(1, level - 1));

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
			if (skills[skill] > pointCap && skills[skill] <= cap)
				issues.push({ level, kind: 'skillCap', skill, message: `${skillName(game, skill)}: skill points reach only ${pointCap} at level ${level}, the rest needs trainers or books` });
		}
		if (spent > available)
			issues.push({ level, kind: 'skillPoints', message: `Spent ${spent} skill points, only ${available} available` });
		carry = Math.max(0, available - spent);

		// Trainers, during the level and so after the level-up's skill points; priced from the level reached.
		const trained: Record<SkillId, number> = {};
		let sessions = 0;
		let gold = 0;
		for (const [skill, by] of Object.entries(plan.trained ?? {})) {
			if (!by || !(skill in skills)) continue;
			gold += trainCost(skills[skill], by);
			skills[skill] += by;
			trained[skill] = by;
			sessions += by;
			const max = l.training.maxLevel[skill] ?? 0;
			if (skills[skill] > max)
				issues.push({ level, kind: 'training', skill, message: `${skillName(game, skill)}: trainers teach only up to ${max}` });
		}
		if (sessions > l.training.sessionsPerLevel)
			issues.push({ level, kind: 'training', message: `${sessions} trainer sessions at level ${level}, only ${l.training.sessionsPerLevel} allowed` });
		goldTotal += gold;

		// Skill books, after the trainers: +1 each, once per book.
		const booksRead: Record<SkillId, number> = {};
		for (const key of plan.books ?? []) {
			const book = books.get(key);
			if (!book || !(book.skill in skills)) {
				issues.push({ level, kind: 'book', message: `Book ${key} is not in the game data` });
				continue;
			}
			if (readAt.has(key)) {
				issues.push({ level, kind: 'book', skill: book.skill, message: `${book.name} was already read at level ${readAt.get(key)}` });
				continue;
			}
			readAt.set(key, level);
			skills[book.skill] += 1;
			booksRead[book.skill] = (booksRead[book.skill] ?? 0) + 1;
		}

		for (const skill of new Set([...Object.keys(plan.skills), ...Object.keys(trained), ...Object.keys(booksRead)]))
			if (skills[skill] > cap)
				issues.push({ level, kind: 'skillCap', skill, message: `${skillName(game, skill)} ${skills[skill]} is above the level ${level} cap of ${cap}` });

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
			skillPointCap: pointCap,
			skillPointsGained: gained,
			skillPointsAvailable: available,
			skillPointsSpent: spent,
			skillPointsLeft: carry,
			trained,
			trainingSessions: sessions,
			trainingGold: gold,
			trainingGoldTotal: goldTotal,
			booksRead,
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
	return { levels, issues: all, bonusPerkPoints: bonus, takenAt, readAt };
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
