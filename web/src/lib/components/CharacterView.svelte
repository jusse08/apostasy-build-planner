<script lang="ts">
	import type { BuildEditor } from '#lib/editor.svelte.ts';
	import { describeConditionGroup, groupConditions, skillName, startingSkills } from '#lib/rules/engine.ts';
	import SpellText from './SpellText.svelte';

	let { ed }: { ed: BuildEditor } = $props();

	type Part = 'race' | 'class' | 'stone' | 'deity';
	let part = $state<Part>('race');

	const parts: { id: Part; label: string }[] = [
		{ id: 'race', label: 'Race' },
		{ id: 'class', label: 'Class' },
		{ id: 'stone', label: 'Standing stone' },
		{ id: 'deity', label: 'Deity' }
	];

	let g = $derived(ed.game);
	let race = $derived(g.races.find((r) => r.id === ed.build.race));
	let cls = $derived(g.classes.find((c) => c.id === ed.build.class));
	let stone = $derived(g.stones.find((s) => s.id === ed.build.stone));
	let deity = $derived(g.deities.find((d) => d.id === ed.build.deity));
	let start = $derived(startingSkills(g, ed.build));
	let deityGroups = $derived([...new Set(g.deities.map((d) => d.group))]);
	let cs = $derived(g.leveling.classSkill);

	function chosenName(p: Part): string | undefined {
		return { race: race?.name, class: cls?.name, stone: stone?.name, deity: deity?.name }[p];
	}

	function pick(p: Part, id: string) {
		ed.set(p, ed.build[p] === id ? null : id);
	}
</script>

<div class="character">
	<nav class="parts" aria-label="Character choices">
		{#each parts as p (p.id)}
			<button class:on={part === p.id} aria-pressed={part === p.id} onclick={() => (part = p.id)}>
				<span class="label">{p.label}</span>
				<span class="value" class:unset={!chosenName(p.id)}>{chosenName(p.id) ?? 'Not chosen'}</span>
			</button>
		{/each}
	</nav>

	<div class="body">
		<div class="options">
			{#if part === 'deity'}
				{#each deityGroups as group}
					<p class="group">{group}</p>
					<ul>
						{#each g.deities.filter((d) => d.group === group) as d (d.id)}
							<li><button class:on={d.id === ed.build.deity} onclick={() => pick('deity', d.id)}>{d.name}</button></li>
						{/each}
					</ul>
				{/each}
			{:else}
				<ul>
					{#each part === 'race' ? g.races : part === 'class' ? g.classes : g.stones as o (o.id)}
						<li>
							<button class:on={o.id === ed.build[part]} onclick={() => pick(part, o.id)}>
								{o.name}{#if 'warnings' in o && o.warnings.length}<span class="flag" title="The class script differs from its description">!</span>{/if}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<section class="about">
			{#if part === 'race'}
				{#if race}
					<h2>{race.name}</h2>
					<p class="stats num">
						<span>Health {race.start.Health}</span><span>Magicka {race.start.Magicka}</span><span>Stamina {race.start.Stamina}</span>
						{#if race.startingPerkPoints}<span class="gold">+{race.startingPerkPoints} perk point at start</span>{/if}
					</p>
					<hr class="rule" />
					{#each race.abilities as a (a.formKey)}<SpellText spell={a} />{/each}
					{#if cls}
						<p class="note">
							Racial skill bonuses ({Object.entries(race.skillBoosts).map(([k, v]) => `${skillName(g, k)} +${v}`).join(', ')}) are overwritten by the class script at level 1.
						</p>
					{/if}
					<p class="lore">{race.description}</p>
				{:else}
					<p class="empty">Choose a race. Its abilities and starting attributes show up here.</p>
				{/if}
			{:else if part === 'class'}
				{#if cls}
					<h2>{cls.name}</h2>
					{#if cls.warnings.length}
						<div class="warn">
							<p>The class script doesn't match the class description. The planner follows the script, since that is what the game applies:</p>
							<ul>{#each cls.warnings as w}<li>{w}</li>{/each}</ul>
						</div>
					{/if}
					<dl class="skills">
						<div><dt>Major skill, {cs.base + cs.major}</dt><dd>{cls.majorSkill ? skillName(g, cls.majorSkill) : 'None'}</dd></div>
						<div><dt>Minor skills, {cs.base + cs.minor}</dt><dd>{cls.minorSkills.map((s) => skillName(g, s)).join(', ') || 'None'}</dd></div>
						<div><dt>Every other skill</dt><dd class="num">{cs.base}</dd></div>
						{#if cls.startingGear}<div><dt>Starts with</dt><dd>{cls.startingGear}</dd></div>{/if}
					</dl>
					<hr class="rule" />
					<SpellText spell={cls.ability} />
					<p class="lore">{cls.description}</p>
				{:else}
					<p class="empty">Choose a class. It sets every skill to {cs.base} at level 1, then raises one major and five minor skills.</p>
				{/if}
			{:else if part === 'stone'}
				{#if stone}
					<h2>{stone.name}</h2>
					<p class="lore">{stone.description}</p>
					<hr class="rule" />
					{#each stone.abilities as a (a.formKey)}<SpellText spell={a} />{/each}
				{:else}
					<p class="empty">Every Stones of Sacrifice stone has a blessing and a price. Choose one to see both.</p>
				{/if}
			{:else if deity}
				<h2>{deity.name}</h2>
				<p class="muted">{deity.group}</p>
				<hr class="rule" />
				<div class="tier">
					<h3>Blessing</h3>
					<p class="when">Pray at a shrine.</p>
					<SpellText spell={deity.blessing} showName={false} />
				</div>
				<div class="tier">
					<h3>Acolyte</h3>
					<p class="when">Grows with the number of quests completed.</p>
					<SpellText spell={deity.acolyte} showName={false} />
				</div>
				<div class="tier">
					<h3>Champion</h3>
					<SpellText spell={deity.champion} showName={false} />
					{#if deity.championRequirements.length}
						<p class="when">Unlocks once all of these are true:</p>
						<ul class="req">
							{#each groupConditions(deity.championRequirements) as grp}
								{@const d = describeConditionGroup(g, grp)}
								<li>
									{d.text}
									{#if d.note}<span class="journal">“{d.note}”</span>{/if}
									{#if d.options.length}
										<ul>
											{#each d.options as o}
												<li>{o.text}{#if o.note}<span class="journal">“{o.note}”</span>{/if}</li>
											{/each}
										</ul>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{:else}
				<p class="empty">Archon gives every deity three tiers: Blessing, Acolyte and Champion. Choose one to see them.</p>
			{/if}
		</section>
	</div>

	<footer class="start">
		<p class="title">Skills at level 1</p>
		<p class="list num">
			{#each g.skills as s (s.id)}<span class:hi={start[s.id] > cs.base}>{s.name} {start[s.id]}</span>{/each}
		</p>
	</footer>
</div>

<style>
	.character {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		height: 100%;
		min-height: 0;
		background: rgba(0, 0, 0, 0.35);
	}

	.parts {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		background: var(--surface);
		border-bottom: 1px solid var(--line-soft);
	}

	.parts button {
		display: grid;
		text-align: left;
		border: none;
		padding: 0.7rem 1.4rem;
		border-bottom: 2px solid transparent;
	}

	.parts button.on {
		background: var(--selected);
		border-bottom-color: var(--gold);
	}

	.label {
		font-size: var(--t-xs);
		letter-spacing: 0.08em;
		color: var(--faint);
	}

	.value {
		font-size: var(--t-lg);
	}

	.value.unset {
		color: var(--muted);
	}

	.body {
		display: grid;
		grid-template-columns: 15rem minmax(0, 1fr);
		min-height: 0;
	}

	.options {
		padding: 1rem 0;
		background: var(--surface);
		overflow-y: auto;
	}

	.options ul {
		list-style: none;
		margin: 0 0 0.6rem;
		padding: 0;
	}

	.group {
		font-size: var(--t-xs);
		letter-spacing: 0.08em;
		color: var(--faint);
		padding: 0.6rem 1.4rem 0.2rem;
	}

	.options button {
		width: 100%;
		text-align: left;
		border: none;
		padding: 0.4rem 1.4rem;
		font-size: var(--t-md);
		color: var(--muted);
	}

	.options button:hover {
		color: var(--text);
	}

	.options button.on {
		color: var(--text);
		background: linear-gradient(90deg, var(--selected), var(--selected) 70%, transparent);
		box-shadow: inset 2px 0 0 var(--gold);
	}

	.flag {
		color: var(--error);
		margin-left: 0.5rem;
	}

	.about {
		padding: 1.8rem 2.2rem;
		overflow-y: auto;
		display: grid;
		gap: 1rem;
		align-content: start;
		max-width: 54rem;
	}

	h2 {
		font-size: var(--t-xxl);
	}

	h3 {
		font-size: var(--t-lg);
		margin-bottom: 0.2rem;
	}

	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: 1.2rem;
		color: var(--muted);
	}

	.gold {
		color: var(--gold);
	}

	.lore {
		color: var(--muted);
		line-height: 1.65;
		max-width: 68ch;
	}

	.note,
	.when {
		font-size: var(--t-sm);
		color: var(--muted);
		line-height: 1.55;
	}

	.empty {
		font-size: var(--t-lg);
		color: var(--muted);
		max-width: 40ch;
		line-height: 1.5;
	}

	.warn {
		border-left: 2px solid var(--error);
		padding: 0.2rem 0 0.2rem 0.9rem;
		font-size: var(--t-sm);
	}

	.warn ul {
		margin: 0.4rem 0 0;
		padding-left: 1.1rem;
		color: var(--muted);
	}

	.skills {
		display: grid;
		gap: 0.4rem;
		margin: 0;
	}

	.skills div {
		display: grid;
		grid-template-columns: 11rem 1fr;
	}

	dt {
		color: var(--muted);
		font-size: var(--t-sm);
	}

	dd {
		margin: 0;
	}

	.tier {
		display: grid;
		gap: 0.3rem;
	}

	.req {
		margin: 0;
		padding-left: 1.1rem;
		font-size: var(--t-sm);
		line-height: 1.55;
	}

	.req ul {
		padding-left: 1.1rem;
		color: var(--muted);
	}

	.journal {
		display: block;
		font-size: var(--t-xs);
		font-style: italic;
		color: var(--muted);
		margin-bottom: 0.3rem;
	}

	.start {
		background: var(--surface);
		border-top: 1px solid var(--line-soft);
		padding: 0.9rem 2.2rem 1rem;
		display: grid;
		gap: 0.35rem;
	}

	.title {
		font-size: var(--t-xs);
		letter-spacing: 0.08em;
		color: var(--faint);
	}

	.list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem 1rem;
		font-size: var(--t-sm);
		color: var(--muted);
	}

	.hi {
		color: var(--gold);
	}

	@media (max-width: 760px) {
		.body {
			grid-template-columns: minmax(0, 1fr);
		}
		.about {
			padding: 1.2rem 1rem;
		}
		.skills div {
			grid-template-columns: 1fr;
		}
		.parts {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
