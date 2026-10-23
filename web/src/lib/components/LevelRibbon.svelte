<script lang="ts">
	import type { BuildEditor } from '#lib/editor.svelte.ts';

	let { ed }: { ed: BuildEditor } = $props();

	let levels = $derived(ed.sim.levels);
</script>

<nav class="ribbon" aria-label="Levels">
	<button class="step" onclick={() => ed.setLevel(ed.level - 1)} disabled={ed.level <= 1} aria-label="Previous level">‹</button>
	<ol>
		{#each levels as st (st.level)}
			{@const plan = ed.build.levels[st.level]}
			{@const perks = plan?.perks.length ?? 0}
			<li>
				<button
					class="cell"
					class:current={st.level === ed.level}
					class:issue={st.issues.length > 0}
					class:planned={perks > 0 || Object.keys(plan?.skills ?? {}).length > 0}
					onclick={() => ed.setLevel(st.level)}
					aria-label="Level {st.level}{st.issues.length ? ', has problems' : ''}"
					aria-current={st.level === ed.level ? 'step' : undefined}
				>
					<span class="n num">{st.level}</span>
					<span class="dots" aria-hidden="true">{#each Array(Math.min(perks, 3)) as _}<i></i>{/each}</span>
				</button>
			</li>
		{/each}
	</ol>
	<button class="step" onclick={() => ed.setLevel(ed.level + 1)} disabled={ed.level >= ed.build.targetLevel} aria-label="Next level">›</button>
	<label class="target">
		<span>Plan to level</span>
		<input
			type="number"
			min="1"
			max="81"
			value={ed.build.targetLevel}
			onchange={(e) => ed.set('targetLevel', Math.max(1, Math.min(81, Number(e.currentTarget.value) || 1)))}
		/>
	</label>
</nav>

<style>
	.ribbon {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 1.2rem;
		background: rgba(0, 0, 0, 0.45);
		border-bottom: 1px solid var(--line-soft);
	}

	.step {
		background: none;
		border: none;
		font-size: 1.3rem;
		line-height: 1;
		color: var(--muted);
		padding: 0.2rem 0.4rem;
	}

	ol {
		display: flex;
		list-style: none;
		margin: 0;
		padding: 0.15rem 0;
		overflow-x: auto;
		flex: 1;
		min-width: 0;
		scrollbar-width: thin;
	}

	.cell {
		position: relative;
		display: grid;
		justify-items: center;
		min-width: 2rem;
		padding: 0.25rem 0.2rem 0.3rem;
		background: none;
		border: none;
		border-radius: 0;
		color: var(--faint);
		font-size: var(--t-sm);
	}

	.cell:hover {
		color: var(--text);
	}

	.cell.planned {
		color: var(--text);
	}

	.cell.current {
		color: var(--text);
		background: var(--selected);
		box-shadow: inset 0 -2px 0 var(--gold);
	}

	.cell.issue .n {
		color: var(--error);
	}

	.cell.current.issue .n {
		color: var(--error);
	}

	.dots {
		display: flex;
		gap: 2px;
		height: 4px;
		margin-top: 2px;
	}

	.dots i {
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: var(--starlight);
	}


	.target {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: var(--t-sm);
		color: var(--muted);
		white-space: nowrap;
	}

	.target input {
		width: 4rem;
	}
</style>
