import { api } from '#lib/api.ts';
import { emptyLevel, perkStatus, rankChain, simulate, type Simulation } from '#lib/rules/engine.ts';
import type { Attribute, BuildRecord, BuildState, FormKey, GameModel, LevelPlan, SkillId } from '#lib/types.ts';

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error';

/** Editing session of one build: state, derived simulation and debounced autosave. */
export class BuildEditor {
	readonly game: GameModel;
	readonly id: string;
	name = $state('');
	build = $state<BuildState>() as BuildState;
	level = $state(1); // level the user is planning right now
	saveStatus = $state<SaveStatus>('saved');
	saveError = $state<string | null>(null);

	sim: Simulation = $derived.by(() => simulate(this.game, this.build));
	current = $derived(this.sim.levels[this.level - 1] ?? this.sim.levels.at(-1)!);
	before = $derived(this.level > 1 ? this.sim.levels[this.level - 2] : null);
	/** Last open level: the stored one, but never below a level that already has choices (older builds). */
	reached = $derived.by(() => {
		const planned = Object.entries(this.build.levels)
			.filter(([, p]) => p.perks.length || p.attribute || Object.keys(p.skills).length || Object.keys(p.trained ?? {}).length || p.books?.length)
			.map(([l]) => Number(l));
		return Math.min(this.build.targetLevel, Math.max(this.build.reachedLevel ?? 2, 2, ...planned));
	});

	private timer: ReturnType<typeof setTimeout> | null = null;

	constructor(game: GameModel, record: BuildRecord) {
		this.game = game;
		this.id = record.id;
		this.name = record.name;
		this.build = record.state;
		// Without a race and class there is nothing to plan yet: start at character creation.
		this.level = record.state.race && record.state.class ? this.reached : 1;
	}

	private plan(level: number): LevelPlan {
		this.build.levels[level] ??= emptyLevel();
		return this.build.levels[level];
	}

	changed() {
		this.saveStatus = 'pending';
		if (this.timer) clearTimeout(this.timer);
		this.timer = setTimeout(() => this.save(), 800);
	}

	async save() {
		this.timer = null;
		this.saveStatus = 'saving';
		try {
			await api.save(this.id, this.name, $state.snapshot(this.build) as BuildState);
			this.saveStatus = this.timer ? 'pending' : 'saved';
			this.saveError = null;
		} catch (e) {
			this.saveStatus = 'error';
			this.saveError = (e as Error).message;
		}
	}

	set<K extends keyof BuildState>(key: K, value: BuildState[K]) {
		this.build[key] = value;
		if (key === 'targetLevel' && this.level > (value as number)) this.level = value as number;
		this.changed();
	}

	setLevel(level: number) {
		this.level = Math.max(1, Math.min(this.reached, level));
	}

	/** Next level: moves within the open ones, past the last it levels up. */
	nextLevel() {
		if (this.level < this.reached) this.setLevel(this.level + 1);
		else this.levelUp();
	}

	/** Opens the next level and moves to it. */
	levelUp() {
		if (this.reached >= this.build.targetLevel) return;
		this.build.reachedLevel = this.reached + 1;
		this.level = this.build.reachedLevel;
		this.changed();
	}

	/** Buy (+) or refund (-) skill increases at the current level. */
	addSkill(skill: SkillId, delta: number) {
		if (this.level < 2) return;
		const p = this.plan(this.level);
		const next = Math.max(0, (p.skills[skill] ?? 0) + delta);
		if (next === 0) delete p.skills[skill];
		else p.skills[skill] = next;
		this.changed();
	}

	/** Add (+) or remove (-) trainer sessions at the current level; training works from level 1. */
	addTraining(skill: SkillId, delta: number) {
		const p = this.plan(this.level);
		const t = (p.trained ??= {});
		const next = Math.max(0, (t[skill] ?? 0) + delta);
		if (next === 0) delete t[skill];
		else t[skill] = next;
		this.changed();
	}

	/** Level at which a skill book was read, if it was. */
	readAt(key: FormKey): number | undefined {
		return this.sim.readAt.get(key);
	}

	/** Reads a skill book at the current level, or unreads it wherever it was read. */
	toggleBook(key: FormKey) {
		const at = this.readAt(key);
		const p = this.plan(at ?? this.level);
		const books = (p.books ?? []).filter((k) => k !== key);
		if (at === undefined) books.push(key);
		if (books.length) p.books = books;
		else delete p.books;
		this.changed();
	}

	setAttribute(attribute: Attribute | null) {
		if (this.level < 2) return;
		this.plan(this.level).attribute = attribute;
		this.changed();
	}

	/** Level at which a perk was taken, if it was. */
	takenAt(key: FormKey): number | undefined {
		return this.sim.takenAt.get(key);
	}

	/** Perk points left at the current level for a node's tree; only skill trees spend them. */
	perksLeft(first: FormKey): number {
		if (this.game.perks[first]?.treeKind !== 'skill') return Infinity;
		return this.current.perkPointsTotal - this.current.perkPointsSpent;
	}

	/** Next untaken rank of a tree node, if its requirements are met and a perk point is free now. */
	takeable(first: FormKey): FormKey | null {
		const next = rankChain(this.game, first).find((k) => this.takenAt(k) === undefined);
		if (!next || this.perksLeft(first) <= 0) return null;
		return perkStatus(this.game, this.sim, next, this.level) === 'available' ? next : null;
	}

	/** Takes the next untaken rank of a tree node at the current level. */
	takeNode(first: FormKey) {
		const next = this.takeable(first);
		if (!next) return;
		this.plan(this.level).perks.push(next);
		this.changed();
	}

	/** Removes the highest taken rank of a tree node, wherever it was taken. */
	dropNode(first: FormKey) {
		const chain = rankChain(this.game, first);
		const last = [...chain].reverse().find((k) => this.takenAt(k) !== undefined);
		if (!last) return;
		const at = this.takenAt(last)!;
		const p = this.plan(at);
		p.perks = p.perks.filter((k) => k !== last);
		this.changed();
	}

	toggleSource(id: string) {
		const s = this.build.perkSources;
		this.build.perkSources = s.includes(id) ? s.filter((x) => x !== id) : [...s, id];
		this.changed();
	}

	/** Words are learned in order: ticking word n marks 1..n, unticking it leaves 1..n-1. */
	toggleWord(shout: string, n: number) {
		const have = this.build.shoutWords[shout] ?? 0;
		const next = have >= n ? n - 1 : n;
		if (next === 0) delete this.build.shoutWords[shout];
		else this.build.shoutWords[shout] = next;
		this.changed();
	}

	toggleMeditation(shout: string) {
		const m = this.build.meditations;
		this.build.meditations = m.includes(shout) ? m.filter((x) => x !== shout) : [...m, shout];
		this.changed();
	}

	rename(name: string) {
		this.name = name;
		this.changed();
	}
}
