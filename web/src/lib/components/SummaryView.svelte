<script lang="ts">
	import type { BuildEditor } from '#lib/editor.svelte.ts';
	import { rankChain, skillName } from '#lib/rules/engine.ts';
	import type { FormKey } from '#lib/types.ts';

	let { ed, ongoto }: { ed: BuildEditor; ongoto: (level: number, tree?: string) => void } = $props();

	// The whole open plan, independently of the level being edited.
	let last = $derived(ed.sim.levels[ed.reached - 1]);
	let issues = $derived(ed.sim.issues.filter((i) => i.level <= last.level));
	let race = $derived(ed.game.races.find((r) => r.id === ed.build.race));
	let cls = $derived(ed.game.classes.find((c) => c.id === ed.build.class));
	let stone = $derived(ed.game.stones.find((s) => s.id === ed.build.stone));
	let deity = $derived(ed.game.deities.find((d) => d.id === ed.build.deity));
	let topSkills = $derived(
		[...ed.game.skills]
			.filter((s) => last.skills[s.id] > ed.game.leveling.classSkill.base)
			.sort((a, b) => last.skills[b.id] - last.skills[a.id])
			.slice(0, 6)
	);
	let byLevel = $derived(ed.sim.levels.filter((st) => st.level <= last.level));
	let shouts = $derived(ed.game.shouts.filter((s) => (ed.build.shoutWords[s.id] ?? 0) > 0));
	let meditations = $derived(ed.game.shouts.filter((s) => s.meditation && ed.build.meditations.includes(s.id)));

	let ranks = $derived.by(() => {
		const labels = new Map<FormKey, string>();
		for (const tree of ed.game.trees) {
			for (const node of tree.nodes) {
				if (!node.perk) continue;
				const chain = rankChain(ed.game, node.perk);
				chain.forEach((key, i) => labels.set(key,
					`${ed.game.perks[key].name}${chain.length > 1 ? ` ${i + 1}/${chain.length}` : ''}`));
			}
		}
		return labels;
	});

	let perkGroups = $derived.by(() => {
		const shown = new Set<FormKey>();
		const groups = ed.game.trees.map((tree) => {
			const perks = tree.nodes.flatMap((node) => {
				if (!node.perk) return [];
				const chain = rankChain(ed.game, node.perk);
				const taken = chain.filter((key) => last.perksTaken.has(key) && !shown.has(key));
				if (!taken.length) return [];
				taken.forEach((key) => shown.add(key));
				return [{
					key: node.perk,
					name: ed.game.perks[node.perk].name,
					rank: chain.length > 1 ? `${taken.length}/${chain.length}` : ''
				}];
			});
			return { id: tree.id, name: tree.name, perks };
		}).filter((group) => group.perks.length);
		const other = [...last.perksTaken].filter((key) => !shown.has(key)).map((key) => ({
			key, name: ed.game.perks[key]?.name ?? key, rank: ''
		}));
		if (other.length) groups.push({ id: 'other', name: 'Other perks', perks: other });
		return groups;
	});

	function perkLabel(key: FormKey): string {
		return ranks.get(key) ?? ed.game.perks[key]?.name ?? key;
	}

	function treeFor(perk?: FormKey, skill?: string): string | undefined {
		return (perk ? ed.game.perks[perk]?.tree : null)
			?? ed.game.skills.find((s) => s.id === skill)?.tree;
	}
</script>

<div class="summary">
	<header>
		<p class="eyebrow num">Build overview · through level {last.level}</p>
		<h2>{ed.name}</h2>
		<p class="identity">
			<span><span class="muted">Race</span> {race?.name ?? 'Not chosen'}</span>
			<span><span class="muted">Class</span> {cls?.name ?? 'Not chosen'}</span>
			<span><span class="muted">Stone</span> {stone?.name ?? 'Not chosen'}</span>
			<span><span class="muted">Deity</span> {deity?.name ?? 'Not chosen'}</span>
		</p>
		{#if topSkills.length}
			<p class="main-skills num"><span class="muted">Main skills</span> {topSkills.map((s) => `${s.name} ${last.skills[s.id]}`).join(' · ')}</p>
		{/if}
	</header>
	<hr class="rule" />

	<section class="status" aria-label="Build validation">
		{#if issues.length === 0}
			<p class="ok">No planning problems through level {last.level}.</p>
		{:else}
			<p class="error-text">{issues.length} {issues.length === 1 ? 'problem' : 'problems'} to fix. Follow the marked levels below.</p>
		{/if}
	</section>

	<div class="cols">
		<section>
			<h3>Perks by tree</h3>
			{#if perkGroups.length === 0}
				<p class="muted">No perks planned yet.</p>
			{:else}
				<dl class="trees">
					{#each perkGroups as group (group.id)}
						<div>
							<dt>{group.name}</dt>
							<dd>
								{#each group.perks as perk, i (perk.key)}
									{#if i}, {/if}<span>{perk.name}{#if perk.rank}<span class="rank num">&nbsp;{perk.rank}</span>{/if}</span>
								{/each}
							</dd>
						</div>
					{/each}
				</dl>
			{/if}
		</section>

		<section>
			<h3>Level by level</h3>
			<ol class="timeline">
				{#each byLevel as row (row.level)}
					{@const plan = ed.build.levels[row.level]}
					{@const firstIssue = row.issues[0]}
					<li class:problem={row.issues.length > 0}>
						<button class="lvl num"
							aria-label={`Go to level ${row.level}${row.issues.length ? ', has planning problems' : ''}`}
							onclick={() => ongoto(row.level, treeFor(firstIssue?.perk, firstIssue?.skill) ?? treeFor(plan?.perks[0]))}
						>{row.level}</button>
						<div>
							{#if row.level === 1}<p class="muted">Character creation</p>{/if}
							{#if plan?.perks.length}<p>{plan.perks.map(perkLabel).join(', ')}</p>{/if}
							{#if plan?.attribute || Object.keys(plan?.skills ?? {}).length}
								<p class="muted small num">
									{[plan?.attribute,
										...Object.entries(plan?.skills ?? {}).map(([skill, gain]) => `${skillName(ed.game, skill)} +${gain}`)
									].filter(Boolean).join(' · ')}
								</p>
							{:else if row.level > 1 && !plan?.perks.length}
								<p class="muted small">No choices planned.</p>
							{/if}
							{#each row.issues as issue}
								<button class="issue small" onclick={() => ongoto(row.level, treeFor(issue.perk, issue.skill))}>{issue.message}</button>
							{/each}
						</div>
					</li>
				{/each}
			</ol>
		</section>
	</div>

	{#if shouts.length || meditations.length}
		<hr class="rule" />
		<div class="cols">
			{#if shouts.length}
				<section>
					<h3>Shouts</h3>
					<ul class="shout-list">
						{#each shouts as shout (shout.id)}
							<li>{shout.name} <span class="muted num">{ed.build.shoutWords[shout.id]}/{shout.words.length} words</span></li>
						{/each}
					</ul>
				</section>
			{/if}
			{#if meditations.length}
				<section>
					<h3>Meditations · {meditations.length} of {ed.game.maxMeditations}</h3>
					<ul class="meds">
						{#each meditations as shout (shout.id)}
							<li><p>{shout.name}</p><p class="muted">{shout.meditation}</p></li>
						{/each}
					</ul>
				</section>
			{/if}
		</div>
	{/if}

	<section class="notes">
		<h3><label for="build-notes">Notes</label></h3>
		<textarea id="build-notes" rows="6" value={ed.build.notes}
			oninput={(e) => ed.set('notes', e.currentTarget.value)}
			placeholder="Play style, quest order, gear to look for"></textarea>
	</section>
</div>

<style>
	.summary {
		padding: 1.8rem 2.2rem 2.5rem;
		overflow-y: auto;
		height: 100%;
		display: grid;
		gap: 1.4rem;
		align-content: start;
		background: rgba(0, 0, 0, 0.35);
		overflow-wrap: anywhere;
	}

	.eyebrow {
		color: var(--muted);
		font-size: var(--t-sm);
		margin-bottom: 0.4rem;
	}

	h2 {
		font-size: var(--t-xxl);
		margin-bottom: 0.8rem;
	}

	h3 {
		font-size: var(--t-sm);
		letter-spacing: 0.06em;
		color: var(--muted);
		margin-bottom: 0.85rem;
	}

	.identity { display: flex; flex-wrap: wrap; gap: 0.35rem 1.4rem; }
	.identity .muted { margin-right: 0.3rem; }
	.main-skills { margin-top: 0.65rem; font-size: var(--t-sm); }
	.main-skills > span { margin-right: 0.5rem; }
	.ok, .rank { color: var(--aurora); }
	.status, .small { font-size: var(--t-sm); }

	.cols {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
		gap: 2.5rem;
		max-width: 78rem;
	}

	.trees { margin: 0; display: grid; gap: 1rem; }
	.trees dt { color: var(--starlight); margin-bottom: 0.2rem; }
	.trees dd { margin: 0; color: var(--muted); line-height: 1.65; }
	.rank { white-space: nowrap; }

	.timeline, .shout-list, .meds {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.65rem;
	}

	.timeline li {
		display: grid;
		grid-template-columns: 2.8rem minmax(0, 1fr);
		gap: 0.7rem;
		align-items: baseline;
	}

	.lvl { padding: 0.05rem 0.4rem; border-color: var(--line-soft); }
	.problem .lvl { color: var(--error); border-color: var(--error); }
	.issue {
		display: block;
		text-align: left;
		color: var(--error);
		padding: 0;
		border: 0;
		margin-top: 0.2rem;
	}
	.issue:hover { text-decoration: underline; }
	.shout-list, .meds { font-size: var(--t-sm); }
	.shout-list .muted { margin-left: 0.4rem; white-space: nowrap; }
	.meds { gap: 0.8rem; }
	.notes { max-width: 78rem; }
	textarea { width: 100%; line-height: 1.5; }

	@media (max-width: 1200px) {
		.cols { grid-template-columns: minmax(0, 1fr); gap: 1.8rem; }
	}
	@media (max-width: 600px) {
		.summary { padding: 1.3rem 1rem 2rem; height: auto; }
		h2 { font-size: var(--t-xl); }
	}
</style>
