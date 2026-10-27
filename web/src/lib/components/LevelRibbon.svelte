<script lang="ts">
	import type { BuildEditor } from '#lib/editor.svelte.ts';

	let { ed }: { ed: BuildEditor } = $props();

	let levels = $derived(ed.sim.levels);
</script>

<nav class="ribbon" aria-label="Levels">
	<button class="step" onclick={() => ed.setLevel(ed.level - 1)} disabled={ed.level <= 1} aria-label="Previous level"
		><i class="icon" style="--icon: url(/icons/stepper-left.png)"></i></button
	>
	<ol>
		{#each levels as st (st.level)}
			{@const plan = ed.build.levels[st.level]}
			{@const perks = plan?.perks.length ?? 0}
			{@const next = st.level === ed.reached + 1}
			<li>
				<button
					class="cell"
					class:next
					class:closed={st.level > ed.reached}
					disabled={st.level > ed.reached + 1}
					title={next ? `Level up to ${st.level}` : undefined}
					class:current={st.level === ed.level}
					class:flash={st.level === ed.leveledUp}
					class:issue={st.issues.length > 0}
					class:planned={perks > 0 || Object.keys(plan?.skills ?? {}).length > 0}
					onclick={() => (next ? ed.levelUp() : ed.setLevel(st.level))}
					aria-label={next ? `Level up to ${st.level}` : `Level ${st.level}${st.issues.length ? ', has problems' : ''}`}
					aria-current={st.level === ed.level ? 'step' : undefined}
				>
					<span class="n num">{st.level}</span>
				</button>
			</li>
		{/each}
	</ol>
	<button
		class="step"
		onclick={() => ed.nextLevel()}
		disabled={ed.level >= ed.build.targetLevel}
		aria-label={ed.level < ed.reached ? 'Next level' : 'Level up'}
		title={ed.level < ed.reached ? 'Next level' : 'Level up'}
		><i class="icon" style="--icon: url(/icons/stepper-right.png)"></i></button
	>
	<label class="target" title="Plan to level">
		<input
			aria-label="Plan to level"
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
		font-size: 0.8rem;
		display: flex;
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
	}

	.cell {
		position: relative;
		display: grid;
		justify-items: center;
		min-width: 2rem;
		padding: 0.4rem 0.2rem;
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

	.cell.closed {
		color: rgba(255, 255, 255, 0.15);
		cursor: default;
	}

	/* The first closed level is the "level up" button. */
	.cell.next {
		color: var(--muted);
		cursor: pointer;
		box-shadow: inset 0 0 0 1px var(--line-soft);
	}

	.cell.next .n::before {
		content: '+';
	}

	.cell.next:hover {
		color: var(--gold);
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

	/* A level just reached glows gold and settles. */
	.cell.flash {
		animation: level-flash 900ms ease-out;
	}

	@keyframes level-flash {
		from {
			color: var(--gold);
			background: color-mix(in srgb, var(--gold) 22%, transparent);
			box-shadow: inset 0 -2px 0 var(--gold), 0 0 14px color-mix(in srgb, var(--gold) 45%, transparent);
		}
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
