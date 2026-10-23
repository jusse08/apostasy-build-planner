<script lang="ts">
	import type { GameModel } from '#lib/types.ts';

	let { game }: { game: GameModel } = $props();
</script>

<div class="shouts">
	<header>
		<h2>Stormcrown shouts</h2>
		<p>
			Each shout's three words, cooldowns and its meditation at Paarthurnax. A meditation costs one dragon soul and
			needs all three words learned and unlocked. The Dragonborn perk tree is under Perks, in Other.
		</p>
	</header>
	<hr class="rule" />
	<table>
		<thead>
			<tr><th>Shout</th><th>Words</th><th class="cd">Cooldown, s</th><th>Meditation</th></tr>
		</thead>
		<tbody>
			{#each game.shouts as s (s.id)}
				<tr>
					<td>
						<p class="name">{s.name}</p>
						{#if s.description}<p class="desc">{s.description}</p>{/if}
					</td>
					<td class="words">{s.words.map((w) => w.translation ?? w.word).join(' · ')}</td>
					<td class="cd num">{s.words.map((w) => w.cooldown).join(' / ')}</td>
					<td class="med">{s.meditation ?? '—'}</td>
				</tr>
			{/each}
		</tbody>
	</table>
	<p class="src">Meditation text comes from the Stormcrown mod page; the game data has none.</p>
</div>

<style>
	.shouts {
		padding: 1.8rem 2.2rem 2.5rem;
		overflow-y: auto;
		height: 100%;
		background: rgba(0, 0, 0, 0.35);
	}

	header {
		max-width: 66ch;
		margin-bottom: 1rem;
	}

	h2 {
		font-size: var(--t-xl);
		margin-bottom: 0.5rem;
	}

	header p {
		color: var(--muted);
		line-height: 1.55;
	}

	table {
		border-collapse: collapse;
		width: 100%;
		margin-top: 1rem;
		font-size: var(--t-sm);
	}

	th {
		text-align: left;
		font-weight: 400;
		font-size: var(--t-xs);
		letter-spacing: 0.08em;
		color: var(--faint);
		padding: 0.3rem 1rem 0.5rem 0.4rem;
	}

	td {
		vertical-align: top;
		padding: 0.65rem 1rem 0.65rem 0.4rem;
		border-top: 1px solid var(--line-soft);
	}

	tr:hover td {
		background: var(--hover);
	}

	.name {
		font-size: var(--t-md);
	}

	.desc {
		color: var(--muted);
		max-width: 42ch;
		margin-top: 0.15rem;
	}

	.words {
		color: var(--muted);
		white-space: nowrap;
	}

	.cd {
		white-space: nowrap;
	}

	.med {
		max-width: 38ch;
		color: rgba(255, 255, 255, 0.85);
	}

	.src {
		font-size: var(--t-xs);
		color: var(--faint);
		margin-top: 1.2rem;
	}
</style>
