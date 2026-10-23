<script lang="ts">
	import type { BuildEditor } from '#lib/editor.svelte.ts';
	import { evalConditions, perkStatus, rankChain } from '#lib/rules/engine.ts';
	import type { FormKey } from '#lib/types.ts';

	// The game's perk caption under the sky: name, rank, the rank's text and what it needs.
	let { ed, first, preview = false }: { ed: BuildEditor; first: FormKey; preview?: boolean } = $props();

	let chain = $derived(rankChain(ed.game, first));
	let head = $derived(ed.game.perks[first]);
	let taken = $derived(chain.filter((k) => ed.takenAt(k) !== undefined).length);
	let nextRank = $derived(chain[taken] ?? null);
	let lastTaken = $derived(taken ? chain[taken - 1] : null);
	// Show the rank you would take next; once all are taken, the last one.
	let shown = $derived(nextRank ?? chain.at(-1)!);
	let perk = $derived(ed.game.perks[shown]);
	let req = $derived(evalConditions(ed.game, perk.conditions, ed.current.skills, ed.current.perksTaken));
	let nextStatus = $derived(nextRank ? perkStatus(ed.game, ed.sim, nextRank, ed.level) : null);
	// Only skill tree perks spend character perk points.
	let perksLeft = $derived(
		head.treeKind === 'skill' ? ed.current.perkPointsTotal - ed.current.perkPointsSpent : Infinity
	);
	let takenAt = $derived(chain.map((k) => ed.takenAt(k)).filter((l): l is number => l !== undefined));
</script>

<article class="panel">
	<h3>
		{head.name}{#if chain.length > 1}<span class="rank num">{nextRank ? `Rank ${taken + 1}` : 'All ranks'} / {chain.length}</span>{/if}
	</h3>
	<p class="text">{perk.description ?? 'The game has no description for this perk.'}</p>
	<p class="meta">
		{#if head.stance}<span class="stance {head.stance.toLowerCase()}">{head.stance} stance</span>{/if}
		{#if nextRank && perk.conditions.length}
			<span class="req">
				Requires
				{#each req.groups as group, i}
					{#if i}{', '}{/if}<span class:ok={group.some((r) => r.ok)} class:unknown={group.every((r) => !r.known)}
						>{group.map((r) => r.label).join(' or ')}</span
					>
				{/each}
			</span>
		{/if}
		{#if takenAt.length}
			<span>
				Taken at level
				{#each takenAt as l, i}{#if i}, {/if}<button class="link num" onclick={() => ed.setLevel(l)}>{l}</button>{/each}
			</span>
		{/if}
	</p>
	{#if !preview}
		<p class="actions">
			{#if nextRank}
				<button class="primary" disabled={perksLeft <= 0 || nextStatus !== 'available'} onclick={() => ed.takeNode(first)}>
					Take {chain.length > 1 ? `rank ${taken + 1}` : 'perk'} at level {ed.level}
				</button>
			{/if}
			{#if lastTaken}
				<button onclick={() => ed.dropNode(first)}>Remove {chain.length > 1 ? `rank ${taken}` : 'perk'}</button>
			{/if}
			{#if nextRank && nextStatus !== 'available'}
				<span class="why">Requirements aren't met at level {ed.level} yet.</span>
			{:else if nextRank && perksLeft <= 0}
				<span class="why">No free perk points at level {ed.level}.</span>
			{/if}
		</p>
	{/if}
</article>

<style>
	.panel {
		display: grid;
		justify-items: center;
		gap: 0.35rem;
		text-align: center;
	}

	h3 {
		font-size: var(--t-xl);
		letter-spacing: 0.04em;
	}

	.rank {
		margin-left: 0.8rem;
		font-size: var(--t-sm);
		color: var(--muted);
		letter-spacing: 0.02em;
	}

	.text {
		max-width: 62ch;
		line-height: 1.5;
		color: rgba(255, 255, 255, 0.88);
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.2rem 1.4rem;
		font-size: var(--t-sm);
		color: var(--muted);
	}

	.req span {
		color: var(--error);
	}
	.req span.ok {
		color: var(--aurora);
	}
	.req span.unknown {
		color: var(--muted);
	}

	.stance.wolf {
		color: var(--wolf);
	}
	.stance.hawk {
		color: var(--hawk);
	}
	.stance.bear {
		color: var(--bear);
	}

	.link {
		background: none;
		border: none;
		padding: 0;
		color: var(--starlight);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: 0.5rem 0.8rem;
		margin-top: 0.3rem;
	}

	.actions button {
		font-size: var(--t-sm);
		padding: 0.2rem 0.8rem;
	}

	.why {
		font-size: var(--t-sm);
		color: var(--muted);
	}
</style>
