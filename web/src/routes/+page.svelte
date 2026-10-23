<script lang="ts">
	import { goto } from '$app/navigation';
	import { api, loadGame } from '#lib/api.ts';
	import Credits from '#lib/components/Credits.svelte';
	import { forgetBuild, myBuildIds } from '#lib/myBuilds.ts';
	import { newBuildState } from '#lib/rules/engine.ts';
	import type { BuildSummary, GameModel } from '#lib/types.ts';

	let builds = $state<BuildSummary[]>([]);
	let game = $state<GameModel | null>(null);
	let error = $state<string | null>(null);
	let name = $state('');
	let creating = $state(false);

	$effect(() => {
		const ids = myBuildIds();
		if (ids.length) api.list(ids).then((b) => (builds = b)).catch((e) => (error = e.message));
		loadGame().then((g) => (game = g)).catch((e) => (error = e.message));
	});

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
		try {
			await api.remove(b.id);
		} catch (err) {
			error = (err as Error).message;
			return;
		}
		forgetBuild(b.id);
		builds = builds.filter((x) => x.id !== b.id);
	}

	// Star dust over the nebula, the same recipe as the perk sky; fixed seed so it never shifts.
	let seed = 7;
	const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
	const dust = Array.from({ length: 260 }, () => ({
		x: rnd() * 1600,
		y: rnd() * 1000,
		r: rnd() < 0.08 ? 1.1 : 0.4 + rnd() * 0.4,
		o: 0.15 + rnd() * 0.45
	}));

	const raceName = (id: string | null) => game?.races.find((r) => r.id === id)?.name;
	const className = (id: string | null) => game?.classes.find((c) => c.id === id)?.name;
	const date = (iso: string) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
</script>

<svelte:head><title>Apostasy Build Planner</title></svelte:head>

<div class="sky" aria-hidden="true">
	<svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
		{#each dust as d}<circle cx={d.x} cy={d.y} r={d.r} opacity={d.o} />{/each}
	</svg>
</div>

<div class="page">
	<main class:alone={!builds.length}>
		<h1><img src="/logo-full.svg" alt="The Elder Scrolls V: Skyrim. Apostasy Build Planner" /></h1>

		<form onsubmit={create}>
			<input bind:value={name} placeholder="Build name" aria-label="Build name" maxlength="120" />
			<button class="primary" disabled={creating}>Create build</button>
		</form>
		{#if error}<p class="error-text">{error}</p>{/if}

		{#if builds.length}
			<section class="builds">
				<h2>Your builds</h2>
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
			</section>
		{/if}
	</main>

	<Credits />
</div>

<style>
	/* The perk sky's backdrop: darkened, with the game's nebula dimmed and desaturated. */
	.sky {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		pointer-events: none;
	}

	.sky::before {
		content: '';
		position: absolute;
		inset: 0;
		background: url('/sky/nebula.png') 50% 40% / auto 135% no-repeat;
		opacity: 0.3;
		filter: saturate(0.55);
		mask-image: radial-gradient(ellipse 75% 70% at 50% 45%, #000 30%, transparent 85%);
	}

	.sky svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.sky circle {
		fill: #f3efe6;
	}

	main {
		position: relative;
		display: grid;
		justify-items: center;
		align-content: start;
		gap: 2.6rem;
		width: 100%;
		max-width: 1120px;
		flex: 1;
		margin: 0 auto;
		padding: 18vh 1.5rem 4rem;
	}

	/* Page column: content fills the screen, the credits sit at the bottom. */
	.page {
		position: relative;
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}


	/* Nothing listed: logo and form sit in the middle of the screen. */
	main.alone {
		align-content: center;
		padding-top: 4rem;
	}

	h1 {
		margin: 0;
		width: min(560px, 100%);
	}

	h1 img {
		display: block;
		width: 100%;
		height: auto;
	}

	form {
		display: flex;
		gap: 0.5rem;
		width: min(30rem, 100%);
	}

	form input {
		flex: 1;
		padding: 0.55rem 0.75rem;
	}

	.builds {
		justify-self: stretch;
		margin-top: 2rem;
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
		main {
			padding-top: 10vh;
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
