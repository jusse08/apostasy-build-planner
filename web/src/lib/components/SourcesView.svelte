<script lang="ts">
	import type { BuildEditor } from '#lib/editor.svelte.ts';
	import type { PerkPointSource } from '#lib/types.ts';

	let { ed }: { ed: BuildEditor } = $props();

	const groups: { id: PerkPointSource['group']; label: string }[] = [
		{ id: 'main', label: 'Main quest' },
		{ id: 'guild', label: 'Guilds and the civil war' },
		{ id: 'side', label: 'Side quests' },
		{ id: 'dlc', label: 'Dawnguard, Dragonborn and Wyrmstooth' },
		{ id: 'other', label: 'Items and other sources' },
		{ id: 'daedric', label: 'Daedric quests' }
	];

	let total = $derived(
		ed.build.perkSources.reduce((n, id) => {
			const s = ed.game.perkSources.find((x) => x.id === id);
			return n + (s?.enabled ? s.points : 0);
		}, 0)
	);

	function setAll(group: PerkPointSource['group'], on: boolean) {
		for (const s of ed.game.perkSources.filter((x) => x.group === group && x.enabled))
			if (ed.build.perkSources.includes(s.id) !== on) ed.toggleSource(s.id);
	}
</script>

<div class="sources">
	<header>
		<h2>Perk points from quests and items</h2>
		<p>
			Tick what this character will finish or find. Ticked points join the perk budget from level 1.
			Counted now: <strong class="num">{total}</strong>.
		</p>
	</header>
	<hr class="rule" />

	<div class="cols">
		{#each groups as g (g.id)}
			{@const items = ed.game.perkSources.filter((s) => s.group === g.id)}
			{#if items.length}
				<section>
					<div class="head">
						<h3>{g.label}</h3>
						{#if g.id !== 'daedric'}
							<button class="mini" onclick={() => setAll(g.id, true)}>All</button>
							<button class="mini" onclick={() => setAll(g.id, false)}>None</button>
						{/if}
					</div>
					{#if g.id === 'daedric'}
						<p class="note">Apostasy turns these awards off in Quests Award Perk Points.</p>
					{/if}
					<ul>
						{#each items as s (s.id)}
							{@const on = ed.build.perkSources.includes(s.id)}
							<li class:off={!s.enabled} class:on>
								<label>
									<input type="checkbox" checked={on} disabled={!s.enabled} onchange={() => ed.toggleSource(s.id)} />
									<span class="name">{s.name}</span>
									<span class="pts num">+{s.points}</span>
								</label>
								{#if s.note}<p class="note indent">{s.note}</p>{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		{/each}
	</div>
</div>

<style>
	.sources {
		padding: 1.8rem 2.2rem 2.5rem;
		overflow-y: auto;
		height: 100%;
		background: rgba(0, 0, 0, 0.35);
	}

	header {
		max-width: 62ch;
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

	header strong {
		color: var(--gold);
		font-weight: 400;
	}

	.cols {
		columns: 3 19rem;
		column-gap: 2.4rem;
		margin-top: 1.4rem;
	}

	section {
		break-inside: avoid;
		margin-bottom: 1.8rem;
	}

	.head {
		display: flex;
		gap: 0.4rem;
		align-items: baseline;
		padding-bottom: 0.35rem;
		margin-bottom: 0.4rem;
		border-bottom: 1px solid var(--line-soft);
	}

	h3 {
		font-size: var(--t-md);
		flex: 1;
	}

	.mini {
		font-size: var(--t-xs);
		padding: 0.05rem 0.5rem;
		border-color: var(--line-soft);
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	li {
		padding: 0.1rem 0.3rem;
	}

	li:hover {
		background: linear-gradient(90deg, transparent, var(--hover) 10%, var(--hover) 90%, transparent);
	}

	li.off {
		opacity: 0.45;
	}

	label {
		display: flex;
		gap: 0.6rem;
		align-items: baseline;
		cursor: pointer;
	}

	input {
		accent-color: #d9c48a;
	}

	.name {
		flex: 1;
		color: var(--muted);
	}

	li.on .name {
		color: var(--text);
	}

	.pts {
		color: var(--faint);
		font-size: var(--t-sm);
	}

	li.on .pts {
		color: var(--gold);
	}

	.note {
		font-size: var(--t-xs);
		color: var(--muted);
		line-height: 1.5;
	}

	.indent {
		margin-left: 1.6rem;
	}
</style>
