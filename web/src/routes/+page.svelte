<script lang="ts">
	import { goto } from '$app/navigation';
	import { api, loadGame } from '#lib/api.ts';
	import PerkSky from '#lib/components/PerkSky.svelte';
	import { newBuildState } from '#lib/rules/engine.ts';
	import type { BuildSummary, GameModel } from '#lib/types.ts';

	let builds = $state<BuildSummary[] | null>(null);
	let game = $state<GameModel | null>(null);
	let error = $state<string | null>(null);
	let name = $state('');
	let creating = $state(false);

	$effect(() => {
		api.list().then((b) => (builds = b)).catch((e) => (error = e.message));
		loadGame().then((g) => (game = g)).catch((e) => (error = e.message));
	});

	// One real constellation as the page's picture: Stormcrown's Dragonborn tree.
	let tree = $derived(game?.trees.find((t) => t.kind === 'dragonborn') ?? game?.trees[0] ?? null);

	async function create(e: SubmitEvent) {
		e.preventDefault();
		creating = true;
		try {
			const b = await api.create(name.trim() || 'New build', newBuildState());
			await goto(`/b/${b.id}`);
		} catch (err) {
			error = (err as Error).message;
			creating = false;
		}
	}

	async function remove(b: BuildSummary) {
		if (!confirm(`Delete “${b.name}”? This can't be undone.`)) return;
		await api.remove(b.id);
		builds = builds?.filter((x) => x.id !== b.id) ?? null;
	}

	const raceName = (id: string | null) => game?.races.find((r) => r.id === id)?.name;
	const className = (id: string | null) => game?.classes.find((c) => c.id === id)?.name;
	const date = (iso: string) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
</script>

<main>
	<section class="intro">
		<div class="copy">
			<h1>Apostasy character planner</h1>
			<hr class="rule" />
			<p class="lede">
				Plan a character level by level: race, class, standing stone, deity, skills and perks. The planner counts
				points by the modlist's own rules and shows where a build doesn't add up.
			</p>
			<form onsubmit={create}>
				<input bind:value={name} placeholder="Build name" aria-label="Build name" maxlength="120" />
				<button class="primary" disabled={creating}>Create build</button>
			</form>
			{#if error}<p class="error-text">{error}</p>{/if}
		</div>
		{#if game && tree}
			<figure class="picture" aria-hidden="true">
				<PerkSky
					{game}
					{tree}
					interactive={false}
					nodeInfo={(n) => ({ status: n.index % 3 === 0 ? 'available' : n.index % 2 ? 'taken' : 'locked', taken: n.index % 2, ranks: 1, required: null })}
				/>
			</figure>
		{/if}
	</section>

	<section class="builds">
		<h2>Builds</h2>
		{#if builds === null}
			<p class="muted">Loading…</p>
		{:else if builds.length === 0}
			<p class="muted">No builds yet. Create one above; everyone on the network will see it here.</p>
		{:else}
			<ul>
				{#each builds as b (b.id)}
					<li>
						<a href="/b/{b.id}" class="name">{b.name}</a>
						<span class="what">{[raceName(b.race), className(b.class)].filter(Boolean).join(' ') || 'No race or class yet'}</span>
						<span class="num level">to level {b.targetLevel}</span>
						<span class="when">{date(b.updatedAt)}</span>
						<button class="ghost" onclick={() => remove(b)} aria-label="Delete {b.name}">Delete</button>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</main>

<style>
	main {
		max-width: 1120px;
		margin: 0 auto;
		padding: 4rem 1.5rem;
	}

	.intro {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 2.5rem;
		align-items: center;
		min-height: 50vh;
	}

	.copy {
		display: grid;
		gap: 1.2rem;
	}

	h1 {
		font-size: 3rem;
		max-width: 13ch;
	}

	.lede {
		font-size: var(--t-lg);
		line-height: 1.6;
		color: var(--muted);
		max-width: 44ch;
	}

	form {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.8rem;
		max-width: 30rem;
	}

	form input {
		flex: 1;
		padding: 0.55rem 0.75rem;
	}

	.picture {
		margin: 0;
		height: 400px;
		background: radial-gradient(ellipse 60% 60% at 50% 50%, rgba(0, 0, 0, 0.55), transparent 75%);
	}

	.builds {
		margin-top: 3rem;
		background: var(--surface);
		padding: 1.6rem 1.8rem;
	}

	h2 {
		font-size: var(--t-xl);
		margin-bottom: 0.9rem;
	}

	ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	li {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(0, 2fr) 7rem 10rem auto;
		gap: 1rem;
		align-items: baseline;
		padding: 0.65rem 0.6rem;
		border-top: 1px solid var(--line-soft);
	}

	li:hover {
		background: linear-gradient(90deg, transparent, var(--hover) 8%, var(--hover) 92%, transparent);
	}

	.name {
		font-size: var(--t-lg);
		text-decoration: none;
	}

	.name:hover {
		color: var(--gold);
	}

	.what,
	.level,
	.when {
		color: var(--muted);
		font-size: var(--t-sm);
	}

	.ghost {
		border-color: transparent;
		color: var(--faint);
		font-size: var(--t-sm);
	}

	.ghost:hover {
		color: var(--error);
		border-color: var(--error);
	}

	@media (max-width: 760px) {
		.intro {
			grid-template-columns: 1fr;
			min-height: 0;
		}
		.picture {
			height: 280px;
		}
		li {
			grid-template-columns: 1fr auto;
		}
		.what,
		.level,
		.when {
			grid-column: 1;
		}
	}
</style>
