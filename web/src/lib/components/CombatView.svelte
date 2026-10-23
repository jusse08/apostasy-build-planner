<script lang="ts">
	import type { GameModel } from '#lib/types.ts';

	let { game }: { game: GameModel } = $props();
</script>

<div class="combat">
	<header>
		<h2>What else shapes combat</h2>
		<p>
			Mods in the modlist that change how fights play out without being perks. Each note says what the mod does and
			what it means for a build. These are summaries written for the planner, not the mod authors' text.
		</p>
	</header>
	<hr class="rule" />

	{#each game.combat as g (g.group)}
		<section>
			<h3>{g.group}</h3>
			<dl>
				{#each g.items as it (it.mod)}
					<div class="item">
						<dt>
							{#if it.url}<a href={it.url} target="_blank" rel="noreferrer">{it.mod}</a>{:else}{it.mod}{/if}
						</dt>
						<dd class="what">{it.what}</dd>
						<dd class="build">{it.build}</dd>
					</div>
				{/each}
			</dl>
		</section>
	{/each}
</div>

<style>
	.combat {
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

	section {
		margin-top: 1.8rem;
	}

	h3 {
		font-size: var(--t-xs);
		letter-spacing: 0.08em;
		color: var(--faint);
		padding-bottom: 0.35rem;
		border-bottom: 1px solid var(--line-soft);
		margin-bottom: 0.4rem;
	}

	dl {
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(24rem, 1fr));
		gap: 0 2.4rem;
	}

	.item {
		padding: 0.7rem 0.4rem;
		border-bottom: 1px solid rgba(145, 138, 129, 0.12);
	}

	.item:hover {
		background: linear-gradient(90deg, transparent, var(--hover) 8%, var(--hover) 92%, transparent);
	}

	dt {
		font-size: var(--t-md);
		margin-bottom: 0.25rem;
	}

	dt a {
		text-decoration: none;
	}

	dt a:hover {
		color: var(--gold);
	}

	dd {
		margin: 0;
		line-height: 1.55;
		font-size: var(--t-sm);
	}

	.what {
		color: var(--muted);
	}

	.build {
		margin-top: 0.3rem;
		padding-left: 0.7rem;
		border-left: 2px solid var(--aurora);
		color: rgba(255, 255, 255, 0.9);
	}
</style>
