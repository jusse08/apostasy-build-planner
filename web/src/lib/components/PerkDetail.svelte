<script lang="ts">
	import type { BuildEditor } from '#lib/editor.svelte.ts';
	import { evalConditions, perkStatus, rankChain } from '#lib/rules/engine.ts';
	import type { FormKey } from '#lib/types.ts';

	let { ed, first }: { ed: BuildEditor; first: FormKey } = $props();

	let chain = $derived(rankChain(ed.game, first));
	let head = $derived(ed.game.perks[first]);
	let st = $derived(ed.current);
	let nextRank = $derived(chain.find((k) => ed.takenAt(k) === undefined) ?? null);
	let lastTaken = $derived([...chain].reverse().find((k) => ed.takenAt(k) !== undefined) ?? null);
	let nextStatus = $derived(nextRank ? perkStatus(ed.game, ed.sim, nextRank, ed.level) : null);
	// Only skill tree perks spend character perk points.
	let costsPoint = $derived(head.treeKind === 'skill');
	let perksLeft = $derived(costsPoint ? st.perkPointsTotal - st.perkPointsSpent : Infinity);
	let rankWord = (k: FormKey) => (chain.length > 1 ? `rank ${chain.indexOf(k) + 1}` : 'perk');
</script>

<article class="detail">
	<header>
		<h3>{head.name}</h3>
		<p class="meta">
			{#if head.stance}<span class="stance {head.stance.toLowerCase()}">{head.stance} stance</span>{/if}
			<span>{chain.length > 1 ? `${chain.length} ranks` : 'Single rank'}</span>
			<span class="muted">{head.plugin}</span>
		</p>
	</header>

	<ol class="ranks">
		{#each chain as key, i (key)}
			{@const p = ed.game.perks[key]}
			{@const at = ed.takenAt(key)}
			{@const req = evalConditions(ed.game, p.conditions, st.skills, st.perksTaken)}
			<li class:taken={at !== undefined}>
				{#if chain.length > 1 || at !== undefined}
					<p class="rank-head">
						{#if chain.length > 1}<span>Rank {i + 1}</span>{/if}
						{#if at !== undefined}<button class="link" onclick={() => ed.setLevel(at)}>taken at level {at}</button>{/if}
					</p>
				{/if}
				<p class="text">{p.description ?? 'The game has no description for this perk.'}</p>
				{#if p.conditions.length}
					<ul class="req" aria-label="Requirements at level {ed.level}">
						{#each req.groups as group}
							<li class:ok={group.some((r) => r.ok)} class:unknown={group.every((r) => !r.known)}>
								{group.map((r) => r.label).join(' or ')}
							</li>
						{/each}
					</ul>
				{/if}
			</li>
		{/each}
	</ol>

	<footer>
		{#if nextRank}
			<button class="primary" disabled={perksLeft <= 0 || nextStatus !== 'available'} onclick={() => ed.takeNode(first)}>
				Take {rankWord(nextRank)} at level {ed.level}
			</button>
		{/if}
		{#if lastTaken}
			<button onclick={() => ed.dropNode(first)}>Remove {rankWord(lastTaken)}</button>
		{/if}
		{#if nextRank && nextStatus !== 'available'}
			<p class="why">Requirements aren't met at level {ed.level} yet.</p>
		{:else if nextRank && perksLeft <= 0}
			<p class="why">No free perk points at level {ed.level}.</p>
		{/if}
	</footer>
</article>

<style>
	.detail {
		display: grid;
		gap: 1.1rem;
		align-content: start;
	}

	h3 {
		font-size: 2rem;
		color: var(--text);
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--line);
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.8rem;
		font-size: var(--t-sm);
		margin-top: 0.3rem;
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

	.ranks {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 1rem;
	}

	.ranks > li {
		padding-left: 0.9rem;
		border-left: 2px solid var(--line);
	}

	.ranks > li.taken {
		border-left-color: var(--starlight);
	}

	.rank-head {
		display: flex;
		gap: 0.6rem;
		font-size: var(--t-sm);
		color: var(--muted);
		margin-bottom: 0.2rem;
	}

	.text {
		font-family: var(--serif);
		font-size: 1rem;
		line-height: 1.6;
		color: rgba(255, 255, 255, 0.88);
	}

	.req {
		list-style: none;
		padding: 0;
		margin: 0.5rem 0 0;
		font-size: var(--t-sm);
		display: grid;
		gap: 0.15rem;
	}

	.req li {
		color: var(--error);
	}
	.req li::before {
		content: '✕';
		display: inline-block;
		width: 1.1rem;
	}
	.req li.ok {
		color: var(--aurora);
	}
	.req li.ok::before {
		content: '✓';
	}
	.req li.unknown {
		color: var(--muted);
	}
	.req li.unknown::before {
		content: '?';
	}

	.link {
		background: none;
		border: none;
		padding: 0;
		color: var(--starlight);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	footer {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}

	.why {
		font-size: var(--t-sm);
		color: var(--muted);
		flex-basis: 100%;
	}
</style>
