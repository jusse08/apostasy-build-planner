<script lang="ts">
	import type { BuildEditor } from '#lib/editor.svelte.ts';

	let { ed }: { ed: BuildEditor } = $props();

	let words = $derived(Object.values(ed.build.shoutWords).reduce((n, w) => n + w, 0));
	let full = $derived(ed.game.shouts.filter((s) => (ed.build.shoutWords[s.id] ?? 0) === 3).length);
	let meditated = $derived(ed.build.meditations.length);
	let capped = $derived(meditated >= ed.game.maxMeditations);
</script>

<div class="shouts">
	<header>
		<h2>Shouts</h2>
		<p>
			Tick words as you learn them and the meditations you take at Paarthurnax. Stormcrown reworks the vanilla and DLC
			shouts and adds a few; a meditation needs all three words and costs one dragon soul.
		</p>
		<p class="num facts">
			<span><strong>{words}</strong> of {ed.game.shouts.length * 3} words</span>
			<span><strong>{full}</strong> shouts complete</span>
			<span class:over={meditated > ed.game.maxMeditations}><strong>{meditated}</strong> of {ed.game.maxMeditations} meditations</span>
		</p>
	</header>
	<hr class="rule" />
	<table>
		<thead>
			<tr><th>Shout</th><th>Words</th><th class="cd">Cooldown, s</th><th>Meditation</th></tr>
		</thead>
		<tbody>
			{#each ed.game.shouts as s (s.id)}
				{@const have = ed.build.shoutWords[s.id] ?? 0}
				{@const med = ed.build.meditations.includes(s.id)}
				<tr class:known={have > 0}>
					<td>
						<p class="name">{s.name}</p>
						{#if s.description}<p class="desc">{s.description}</p>{/if}
					</td>
					<td class="words">
						{#each s.words as w, i (i)}
							<label class:on={have > i} title={w.word ?? ''}>
								<input type="checkbox" checked={have > i} onchange={() => ed.toggleWord(s.id, i + 1)} />
								{w.translation ?? w.word}
							</label>
						{/each}
					</td>
					<td class="cd num">{s.words.map((w) => w.cooldown).join(' / ')}</td>
					<td class="med">
						{#if s.meditation}
							<label class:on={med}>
								<input
									type="checkbox"
									checked={med}
									disabled={!med && capped}
									onchange={() => ed.toggleMeditation(s.id)}
								/>
								<span>{s.meditation}</span>
							</label>
							{#if med && have < 3}<p class="warn">Needs all three words.</p>{/if}
						{:else}
							<span class="faint">—</span>
						{/if}
					</td>
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

	.facts {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.4rem 1.6rem;
		margin-top: 0.6rem;
		font-size: var(--t-sm);
	}

	.facts strong {
		color: var(--gold);
		font-weight: 400;
		font-size: var(--t-lg);
	}

	.facts .over strong {
		color: var(--error);
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
		color: var(--muted);
	}

	tr.known .name {
		color: var(--text);
	}

	.desc {
		color: var(--muted);
		max-width: 42ch;
		margin-top: 0.15rem;
	}

	label {
		display: flex;
		gap: 0.5rem;
		align-items: baseline;
		cursor: pointer;
		color: var(--muted);
	}

	label.on {
		color: var(--text);
	}

	input:disabled + span {
		opacity: 0.5;
	}

	.words {
		white-space: nowrap;
	}

	.words label + label {
		margin-top: 0.15rem;
	}

	.cd {
		white-space: nowrap;
	}

	.med {
		max-width: 38ch;
	}

	.warn {
		font-size: var(--t-xs);
		color: var(--error);
		margin: 0.2rem 0 0 1.6rem;
	}

	.faint,
	.src {
		color: var(--faint);
	}

	.src {
		font-size: var(--t-xs);
		margin-top: 1.2rem;
	}

	@media (max-width: 900px) {
		.shouts {
			padding: 1.2rem 1rem 2rem;
		}
		.cd {
			display: none;
		}
	}
</style>
