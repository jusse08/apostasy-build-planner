<script lang="ts">
	import type { BuildEditor } from '#lib/editor.svelte.ts';
	import { perkStatus, rankChain } from '#lib/rules/engine.ts';
	import type { FormKey, Tree, TreeNode } from '#lib/types.ts';
	import PerkDetail from './PerkDetail.svelte';
	import PerkSky from './PerkSky.svelte';

	let { ed, treeId = $bindable() }: { ed: BuildEditor; treeId: string } = $props();

	let selected = $state<FormKey | null>(null);
	let tree = $derived(ed.game.trees.find((t) => t.id === treeId) ?? ed.game.trees[0]);

	// The skills menu horizon: the three classic groups, then the separate trees.
	const groups: { label: string; skills: string[] }[] = [
		{ label: 'Combat', skills: ['OneHanded', 'TwoHanded', 'Marksman', 'Block', 'HeavyArmor', 'Smithing'] },
		{ label: 'Stealth', skills: ['LightArmor', 'Sneak', 'Lockpicking', 'Pickpocket', 'Speechcraft', 'Alchemy'] },
		{ label: 'Magic', skills: ['Illusion', 'Conjuration', 'Destruction', 'Restoration', 'Alteration', 'Enchanting'] }
	];
	let horizon = $derived(
		groups.map((g) => ({ label: g.label, trees: g.skills.map((s) => ed.game.trees.find((t) => t.skill === s)).filter((t): t is Tree => !!t) }))
	);
	let extra = $derived(ed.game.trees.filter((t) => t.kind !== 'skill'));

	function takenIn(t: Tree): number {
		let n = 0;
		for (const node of t.nodes)
			if (node.perk) for (const k of rankChain(ed.game, node.perk)) if (ed.current.perksTaken.has(k)) n++;
		return n;
	}

	function required(key: FormKey): number | null {
		const c = ed.game.perks[key]?.conditions.find((x) => x.fn === 'GetBaseActorValue' && x.args?.actorValue === tree.skill);
		return c?.value ?? null;
	}

	function nodeInfo(n: TreeNode) {
		const chain = rankChain(ed.game, n.perk!);
		const taken = chain.filter((k) => ed.current.perksTaken.has(k)).length;
		const next = chain[taken];
		const status = taken === chain.length ? 'taken' : perkStatus(ed.game, ed.sim, next, ed.level);
		return {
			status: taken > 0 && status !== 'available' ? ('taken' as const) : status,
			taken,
			ranks: chain.length,
			required: required(next ?? chain[0])
		};
	}

	$effect(() => {
		void tree.id; // reset the selection when switching trees
		selected = null;
	});
</script>

<div class="perks">
	<section class="sky-wrap">
		<header class="caption">
			<h2>{tree.name}</h2>
			{#if tree.skill}
				<p class="value num">{ed.current.skills[tree.skill]}<span> / {ed.current.skillCap}</span></p>
				<p class="sub">skill at level {ed.level} and its cap</p>
			{:else if tree.kind === 'dragonborn'}
				<p class="sub">Bought with absorbed dragon souls, not perk points.</p>
			{:else}
				<p class="sub">{tree.description} Separate from character perk points.</p>
			{/if}
		</header>

		<div class="canvas">
			<PerkSky
				game={ed.game}
				{tree}
				{nodeInfo}
				{selected}
				onselect={(n) => (selected = n.perk)}
				ontake={(n) => ed.takeNode(n.perk!)}
				ondrop={(n) => ed.dropNode(n.perk!)}
			/>
		</div>

		<p class="legend">
			<span><i class="dot taken"></i>taken</span>
			<span><i class="dot available"></i>available now</span>
			<span><i class="dot locked"></i>locked</span>
			<span><i class="ring wolf"></i>Wolf stance</span>
			<span><i class="ring hawk"></i>Hawk stance</span>
			<span><i class="ring bear"></i>Bear stance</span>
			<span class="keys">Double-click or Enter takes a perk, right-click or Delete removes it</span>
		</p>

		<nav class="horizon" aria-label="Perk trees">
			{#each horizon as g (g.label)}
				<div class="group">
					<p class="glabel">{g.label}</p>
					<ul>
						{#each g.trees as t (t.id)}
							{@const n = takenIn(t)}
							<li>
								<button class:on={t.id === tree.id} aria-pressed={t.id === tree.id} onclick={() => (treeId = t.id)}>
									<span class="tname">{t.name}</span>
									<span class="tval num">{ed.current.skills[t.skill!]}{#if n}<em>{n}</em>{/if}</span>
								</button>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
			<div class="group">
				<p class="glabel">Other</p>
				<ul class="single">
					{#each extra as t (t.id)}
						{@const n = takenIn(t)}
						<li>
							<button class:on={t.id === tree.id} aria-pressed={t.id === tree.id} onclick={() => (treeId = t.id)}>
								<span class="tname">{t.name}</span>
								<span class="tval num">{#if n}<em>{n}</em>{/if}</span>
							</button>
						</li>
					{/each}
				</ul>
			</div>
		</nav>
	</section>

	<aside class="side">
		{#if selected}
			{#key selected}<PerkDetail {ed} first={selected} />{/key}
		{:else}
			<div class="empty">
				<p>Pick a star to read the perk, its ranks and what it needs.</p>
				<p class="muted">
					Perks you take are placed at level {ed.level}. Move along the level strip above to plan another level.
				</p>
			</div>
		{/if}
	</aside>
</div>

<style>
	.perks {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 24rem;
		height: 100%;
		min-height: 0;
	}

	.sky-wrap {
		position: relative;
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto auto;
		min-height: 0;
		background:
			radial-gradient(ellipse 55% 45% at 55% 42%, rgba(160, 150, 130, 0.1), transparent 70%),
			rgba(0, 0, 0, 0.55);
	}

	.caption {
		position: absolute;
		top: 1.4rem;
		left: 1.8rem;
		z-index: 1;
		pointer-events: none;
	}

	.caption h2 {
		font-size: 3.4rem;
		font-weight: 400;
		color: var(--text);
		letter-spacing: 0.02em;
	}

	.value {
		font-size: var(--t-xl);
		color: var(--text);
		margin-top: 0.2rem;
	}

	.value span {
		color: var(--muted);
		font-size: var(--t-lg);
	}

	.sub {
		color: var(--muted);
		font-size: var(--t-sm);
		max-width: 34ch;
	}

	.canvas {
		min-height: 0;
		padding: 1rem 1rem 0;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1.1rem;
		padding: 0.4rem 1.8rem;
		font-size: var(--t-xs);
		color: var(--muted);
	}

	.keys {
		margin-left: auto;
	}

	.dot,
	.ring {
		display: inline-block;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		margin-right: 0.35rem;
		vertical-align: -1px;
	}
	.dot.taken {
		background: var(--starlight);
		box-shadow: 0 0 6px var(--starlight);
	}
	.dot.available {
		border: 2px solid var(--aurora);
	}
	.dot.locked {
		background: #6f6b65;
		transform: scale(0.7);
	}
	.ring {
		border: 1px dotted;
	}
	.ring.wolf {
		border-color: var(--wolf);
	}
	.ring.hawk {
		border-color: var(--hawk);
	}
	.ring.bear {
		border-color: var(--bear);
	}

	.horizon {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr)) minmax(0, 0.55fr);
		gap: 1.6rem;
		padding: 0.9rem 1.8rem 1.1rem;
		background: var(--surface);
		border-top: 1px solid var(--line-soft);
	}

	.glabel {
		font-family: var(--serif);
		color: var(--faint);
		font-size: var(--t-xs);
		letter-spacing: 0.08em;
		margin-bottom: 0.25rem;
	}

	.horizon ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.1rem 0.9rem;
	}

	.horizon button {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.4rem;
		background: none;
		border: none;
		border-radius: 0;
		padding: 0.15rem 0.35rem;
		border-bottom: 1px solid transparent;
		color: var(--muted);
		text-align: left;
	}

	.horizon button:hover {
		color: var(--text);
	}

	.horizon button.on {
		color: var(--text);
		background: linear-gradient(90deg, transparent, var(--selected) 15%, var(--selected) 85%, transparent);
		border-bottom-color: var(--line);
	}

	.tname {
		min-width: 0;
		font-family: var(--serif);
		font-size: var(--t-sm);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tval {
		font-size: var(--t-sm);
		white-space: nowrap;
	}

	.tval em {
		font-style: normal;
		color: var(--starlight);
		margin-left: 0.4rem;
	}

	.tval em::before {
		content: '✦';
		font-size: 0.7em;
		margin-right: 0.15rem;
		vertical-align: 0.1em;
	}

	.side {
		background: var(--surface);
		padding: 1.6rem 1.5rem;
		overflow-y: auto;
	}

	.empty {
		display: grid;
		gap: 0.8rem;
		font-family: var(--serif);
		font-size: var(--t-lg);
		line-height: 1.5;
	}

	.empty .muted {
		font-size: var(--t-md);
	}

	@media (max-width: 1100px) {
		.perks {
			grid-template-columns: minmax(0, 1fr);
		}
		.sky-wrap {
			min-height: 640px;
		}
		.horizon {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}
	}

	@media (max-width: 600px) {
		.sky-wrap {
			min-height: 520px;
		}
		.caption h2 {
			font-size: 2.2rem;
		}
		.horizon {
			grid-template-columns: minmax(0, 1fr);
			padding: 0.8rem 1rem;
		}
		.keys {
			margin-left: 0;
		}
	}
</style>
