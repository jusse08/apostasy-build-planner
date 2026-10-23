<script lang="ts">
	import type { BuildEditor } from '#lib/editor.svelte.ts';

	let { ed, ongoto }: { ed: BuildEditor; ongoto: (level: number) => void } = $props();

	let last = $derived(ed.sim.levels.at(-1)!);
	let byLevel = $derived(
		ed.sim.levels
			.map((st) => ({ level: st.level, perks: ed.build.levels[st.level]?.perks ?? [], issues: st.issues }))
			.filter((x) => x.perks.length || x.issues.length)
	);
	let topSkills = $derived([...ed.game.skills].sort((a, b) => last.skills[b.id] - last.skills[a.id]));
	let meditations = $derived(ed.game.shouts.filter((s) => s.meditation && ed.build.meditations.includes(s.id)));
</script>

<div class="summary">
	<section class="status">
		<h2>At level {last.level}</h2>
		{#if ed.sim.issues.length === 0}
			<p class="ok">The build adds up: every level has the points it spends and every perk's requirements are met.</p>
		{:else}
			<p class="error-text">{ed.sim.issues.length} {ed.sim.issues.length === 1 ? 'problem' : 'problems'} to fix. Click a level to jump there.</p>
		{/if}
		<p class="num facts">
			<span><strong>{last.perkPointsSpent}</strong> of {last.perkPointsTotal} perk points used</span>
			<span>{last.perkPointsTotal - ed.sim.bonusPerkPoints} from levels, {ed.sim.bonusPerkPoints} from quests and abilities</span>
			<span><strong>{last.skillPointsLeft}</strong> skill points unspent</span>
		</p>
	</section>
	<hr class="rule" />

	<div class="cols">
		<section>
			<h3>Skills</h3>
			<ul class="skills num">
				{#each topSkills as s (s.id)}
					<li><span>{s.name}</span><span class="bar"><i style="width: {last.skills[s.id]}%"></i></span><span>{last.skills[s.id]}</span></li>
				{/each}
			</ul>
		</section>

		<section>
			<h3>Level by level</h3>
			{#if byLevel.length === 0}
				<p class="muted">No perks yet. Open Perks and pick a level on the strip at the top.</p>
			{/if}
			<ol class="timeline">
				{#each byLevel as row (row.level)}
					<li>
						<button class="lvl num" onclick={() => ongoto(row.level)}>{row.level}</button>
						<div>
							{#if row.perks.length}<p>{row.perks.map((k) => ed.game.perks[k]?.name ?? k).join(', ')}</p>{/if}
							{#each row.issues as i}<p class="error-text small">{i.message}</p>{/each}
						</div>
					</li>
				{/each}
			</ol>
		</section>
	</div>

	{#if meditations.length}
		<section>
			<h3>Meditations · {meditations.length} of {ed.game.maxMeditations}</h3>
			<ul class="meds">
				{#each meditations as s (s.id)}
					<li><span>{s.name}</span><span class="muted">{s.meditation}</span></li>
				{/each}
			</ul>
		</section>
	{/if}

	<section>
		<h3>Notes</h3>
		<textarea
			rows="6"
			value={ed.build.notes}
			oninput={(e) => ed.set('notes', e.currentTarget.value)}
			placeholder="Play style, quest order, gear to look for"
		></textarea>
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
	}

	h2 {
		font-size: var(--t-xxl);
		margin-bottom: 0.5rem;
	}

	h3 {
		font-size: var(--t-xs);
		letter-spacing: 0.08em;
		color: var(--faint);
		margin-bottom: 0.6rem;
	}

	.ok {
		color: var(--aurora);
	}

	.facts {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.4rem 1.6rem;
		margin-top: 0.6rem;
		color: var(--muted);
		font-size: var(--t-sm);
	}

	.facts strong {
		color: var(--text);
		font-weight: 400;
		font-size: var(--t-lg);
	}

	.cols {
		display: grid;
		grid-template-columns: minmax(16rem, 26rem) minmax(0, 1fr);
		gap: 3rem;
	}

	.skills {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.25rem;
		font-size: var(--t-sm);
	}

	.skills li {
		display: grid;
		grid-template-columns: 8.5rem 1fr 2.2rem;
		gap: 0.7rem;
		align-items: center;
	}

	.skills li span:last-child {
		text-align: right;
	}

	.bar {
		height: 3px;
		background: rgba(255, 255, 255, 0.08);
	}

	.bar i {
		display: block;
		height: 100%;
		background: var(--starlight);
	}

	.timeline {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.45rem;
	}

	.timeline li {
		display: grid;
		grid-template-columns: 2.8rem 1fr;
		gap: 0.7rem;
		align-items: baseline;
	}

	.lvl {
		padding: 0.05rem 0.4rem;
		border-color: var(--line-soft);
	}

	.small {
		font-size: var(--t-sm);
	}

	.meds {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.3rem;
		font-size: var(--t-sm);
		max-width: 60rem;
	}

	.meds li {
		display: grid;
		grid-template-columns: 11rem 1fr;
		gap: 0.7rem;
	}

	textarea {
		width: 100%;
		max-width: 60rem;
		line-height: 1.5;
	}

	@media (max-width: 900px) {
		.cols {
			grid-template-columns: 1fr;
		}
	}
</style>
