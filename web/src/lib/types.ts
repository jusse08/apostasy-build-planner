// Shapes shared by server and client. The server turns the extractor's JSON files into a
// GameModel; a Build is what users edit and what is stored in SQLite.

export type SkillId = string; // Papyrus actor value name: OneHanded, Marksman, Speechcraft, ...
export type FormKey = string; // "000800:Skyrim.esm"
export type Attribute = 'Health' | 'Magicka' | 'Stamina';

export interface Condition {
	fn: string;
	op: string;
	or: boolean;
	value?: number;
	global?: string;
	args?: Record<string, string | number | boolean>;
	argNames?: Record<string, string>;
}

export interface Perk {
	key: FormKey;
	editorId: string;
	name: string;
	description: string | null;
	plugin: string;
	nextPerk: FormKey | null;
	conditions: Condition[];
	/** Stances NG stance the perk works in ("While in Wolf Stance, ..."), if any. */
	stance: Stance | null;
	/** Tree the perk (or its rank chain) sits in; only skill tree perks cost perk points. */
	tree: string | null;
	treeKind: Tree['kind'] | null;
}

export type Stance = 'Wolf' | 'Hawk' | 'Bear';

export interface TreeNode {
	index: number;
	perk: FormKey | null;
	x: number;
	y: number;
	links: number[];
}

export interface Tree {
	id: string;
	name: string;
	skill: SkillId | null;
	description: string | null;
	kind: 'skill' | 'transformation' | 'dragonborn';
	nodes: TreeNode[];
}

export interface Effect {
	name: string | null;
	description: string | null;
	magnitude?: number;
	duration?: number;
	conditions?: Condition[];
	perk?: { name: string | null; description: string | null };
}

export interface Spell {
	formKey: FormKey;
	name: string | null;
	description: string | null;
	effects: Effect[];
}

export interface Race {
	id: string;
	name: string;
	description: string | null;
	start: Record<Attribute, number>;
	skillBoosts: Record<SkillId, number>;
	abilities: Spell[];
	startingPerkPoints: number;
}

export interface CharClass {
	id: string;
	name: string;
	description: string;
	majorSkill: SkillId | null;
	minorSkills: SkillId[];
	startingGear: string | null;
	ability: Spell | null;
	warnings: string[];
	startingPerkPoints: number;
}

export interface Stone {
	id: string;
	name: string;
	description: string | null;
	abilities: Spell[];
}

export interface Deity {
	id: string;
	name: string;
	group: string;
	blessing: Spell | null;
	acolyte: Spell | null;
	champion: Spell | null;
	championRequirements: Condition[];
}

export interface PerkPointSource {
	id: string;
	name: string;
	group: 'main' | 'guild' | 'side' | 'daedric' | 'dlc' | 'other';
	points: number;
	/** False when the modlist switches the award off (Daedric quests). */
	enabled: boolean;
	note?: string;
}

export interface ShoutWord {
	word: string | null;
	translation: string | null;
	cooldown: number;
}

export interface Shout {
	id: string;
	name: string;
	description: string | null;
	words: ShoutWord[];
	meditation: string | null;
}

export interface Leveling {
	xpBase: number;
	xpMult: number;
	skillStart: number;
	classSkill: { base: number; major: number; minor: number };
	skillPoints: { perLevel: number; levelMult: number; cap: number; costs: [number, number, number, number] };
	maxSkillGainPerLevel: number;
	skillCap: { base: number; mult: number; max: number };
	perksAtLevel: [number, number][]; // [fromLevel, perks], value applies until the next key
	attributeAtLevel: [number, number][];
	maxLevel: number;
}

export interface GameModel {
	skills: { id: SkillId; name: string; tree: string }[];
	trees: Tree[];
	perks: Record<FormKey, Perk>;
	races: Race[];
	classes: CharClass[];
	stones: Stone[];
	deities: Deity[];
	perkSources: PerkPointSource[];
	shouts: Shout[];
	traits: Spell[];
	leveling: Leveling;
	/** Hand-written notes on combat-related mods (data/combat.json). */
	combat: { group: string; items: { mod: string; what: string; build: string; url: string | null }[] }[];
	defaultPerks: string[];
	dataVersion: string;
}

export interface LevelPlan {
	skills: Record<SkillId, number>; // skill increases bought at this level
	perks: FormKey[]; // perks (or perk ranks) taken at this level
	attribute: Attribute | null; // attribute raised on reaching this level
}

export interface BuildState {
	race: string | null;
	class: string | null;
	stone: string | null;
	deity: string | null;
	targetLevel: number;
	levels: Record<number, LevelPlan>;
	perkSources: string[]; // ids of quests / items whose perk points are counted
	notes: string;
}

export interface BuildRecord {
	id: string;
	name: string;
	state: BuildState;
	dataVersion: string;
	createdAt: string;
	updatedAt: string;
}

export interface BuildSummary {
	id: string;
	name: string;
	race: string | null;
	class: string | null;
	targetLevel: number;
	updatedAt: string;
}
