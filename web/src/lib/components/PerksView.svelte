<script lang="ts">
	import type { BuildEditor } from '#lib/editor.svelte.ts';
	import { perkStatus, rankChain } from '#lib/rules/engine.ts';
	import type { FormKey, Tree, TreeNode } from '#lib/types.ts';
	import PerkPanel from './PerkPanel.svelte';
	import PerkSky from './PerkSky.svelte';

	let { ed, treeId = $bindable() }: { ed: BuildEditor; treeId: string } = $props();

	let selected = $state<FormKey | null>(null);
	let hovered = $state<FormKey | null>(null);
	let allNames = $state(false);
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

	// The game's nebula panorama runs blue (magic), red (combat), green (stealth); face the tree's part of it.
	let nebulaX = $derived(
		{ Combat: '50%', Stealth: '100%', Magic: '0%' }[groups.find((g) => g.skills.includes(tree.skill ?? ''))?.label ?? ''] ?? '30%'
	);

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
		hovered = null;
	});
</script>

<div class="perks">
	<section class="sky-wrap" style="--nebula-x: {nebulaX}">
		<header class="caption">
			<h2>{tree.name}</h2>
			{#if tree.skill}
				<p class="value num">{ed.current.skills[tree.skill]}<span> / {ed.current.skillCap}</span></p>
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
				{allNames}
				onselect={(n) => (selected = n?.perk ?? null)}
				onhover={(n) => (hovered = n?.perk ?? null)}
				ontake={(n) => ed.takeNode(n.perk!)}
				ondrop={(n) => ed.dropNode(n.perk!)}
			/>
		</div>

		<div class="caption-panel" aria-live="polite">
			{#if hovered ?? selected}
				{#key hovered ?? selected}<PerkPanel {ed} first={(hovered ?? selected)!} preview={!!hovered && hovered !== selected} />{/key}
			{/if}
		</div>

		<p class="legend">
			<label class="names"><input type="checkbox" bind:checked={allNames} />All names</label>
			<span class="keys" title="Keyboard: Enter takes the focused perk, Delete removes it.">
				<span><i class="icon" style="--icon: url(/icons/mouse1.png)"></i><i class="icon" style="--icon: url(/icons/mouse1.png)"></i> take</span>
				<span><i class="icon" style="--icon: url(/icons/mouse2.png)"></i> remove</span>
				<span><i class="icon wide" style="--icon: url(/icons/wheel.png)"></i> zoom</span>
				<span><i class="icon" style="--icon: url(/icons/mouse1.png)"></i> drag to move</span>
			</span>
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

</div>

<style>
	.perks {
		height: 100%;
		overflow-y: auto;
	}

	.sky-wrap {
		position: relative;
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto auto auto;
		min-height: 100%;
		isolation: isolate;
		background: rgba(0, 0, 0, 0.6);
	}

	/* The game's nebula, dimmed and desaturated so it sits behind the stars like the rest of the UI. */
	.sky-wrap::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		background: url('/sky/nebula.png') var(--nebula-x) 40% / auto 135% no-repeat;
		opacity: 0.3;
		filter: saturate(0.55);
		transition: background-position 600ms ease-out;
		mask-image: radial-gradient(ellipse 75% 70% at 50% 45%, #000 30%, transparent 85%);
	}

	/* Fixed height: the sky measures the space left, so a longer description must not resize it. */
	.caption-panel {
		height: 12rem;
		overflow-y: auto;
		padding: 0.6rem 1.8rem 0.4rem;
		display: grid;
		align-content: start;
		background: linear-gradient(transparent, rgba(0, 0, 0, 0.45));
	}

	.names {
		display: inline-flex;
		gap: 0.4rem;
		align-items: baseline;
		cursor: pointer;
		margin-left: 0.6rem;
	}

	.caption {
		position: absolute;
		top: 1.4rem;
		left: 1.8rem;
		z-index: 1;
		pointer-events: none;
	}

	.caption h2 {
		font-size: 2.4rem;
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

	/* The tree measures this box to decide how far to shrink, so it must not size itself to the tree. */
	.canvas {
		position: relative;
		min-height: 22rem;
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
		display: flex;
		gap: 1.1rem;
		margin-left: auto;
	}

	.keys > span {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}

	.keys .icon {
		width: 2.3em;
		height: 2.3em;
		vertical-align: middle;
	}

	/* The wheel image is 133x66 where the others are square: same height, its own width. */
	.keys .icon.wide {
		width: calc(2.3em * 133 / 66);
	}

	.keys .icon + .icon {
		margin-left: -0.3rem;
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


	@media (max-width: 1100px) {
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
