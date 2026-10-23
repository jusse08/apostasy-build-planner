import { api } from '#lib/api.ts';
import { emptyLevel, rankChain, simulate, type Simulation } from '#lib/rules/engine.ts';
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

	private timer: ReturnType<typeof setTimeout> | null = null;

	constructor(game: GameModel, record: BuildRecord) {
		this.game = game;
		this.id = record.id;
		this.name = record.name;
		this.build = record.state;
		this.level = Math.min(2, record.state.targetLevel);
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
		this.level = Math.max(1, Math.min(this.build.targetLevel, level));
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

	setAttribute(attribute: Attribute | null) {
		if (this.level < 2) return;
		this.plan(this.level).attribute = attribute;
		this.changed();
	}

	/** Level at which a perk was taken, if it was. */
	takenAt(key: FormKey): number | undefined {
		return this.sim.takenAt.get(key);
	}

	/** Takes the next untaken rank of a tree node at the current level. */
	takeNode(first: FormKey) {
		const chain = rankChain(this.game, first);
		const next = chain.find((k) => this.takenAt(k) === undefined);
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

	rename(name: string) {
		this.name = name;
		this.changed();
	}
}
