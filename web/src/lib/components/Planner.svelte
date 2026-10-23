<script lang="ts">
	import CharacterView from './CharacterView.svelte';
	import CombatView from './CombatView.svelte';
	import LevelRibbon from './LevelRibbon.svelte';
	import PerksView from './PerksView.svelte';
	import ShoutsView from './ShoutsView.svelte';
	import SkillLedger from './SkillLedger.svelte';
	import SourcesView from './SourcesView.svelte';
	import SummaryView from './SummaryView.svelte';
	import { BuildEditor } from '#lib/editor.svelte.ts';
	import type { BuildRecord, GameModel } from '#lib/types.ts';

	let { game, record }: { game: GameModel; record: BuildRecord } = $props();

	// The page re-creates this component per build ({#key}), so reading props once is intended.
	// svelte-ignore state_referenced_locally
	const ed = new BuildEditor(game, record);

	type View = 'perks' | 'character' | 'sources' | 'shouts' | 'combat' | 'summary';
	let view = $state<View>(ed.build.race ? 'perks' : 'character');
	let treeId = $state(ed.game.trees.find((t) => t.skill === 'OneHanded')?.id ?? ed.game.trees[0].id);

	const views: { id: View; label: string }[] = [
		{ id: 'character', label: 'Character' },
		{ id: 'perks', label: 'Perks' },
		{ id: 'sources', label: 'Quest perk points' },
		{ id: 'shouts', label: 'Shouts' },
		{ id: 'combat', label: 'Combat' },
		{ id: 'summary', label: 'Summary' }
	];

	const saveText = { saved: 'Saved', pending: 'Unsaved changes', saving: 'Saving…', error: 'Not saved' };

	let who = $derived(
		[game.races.find((r) => r.id === ed.build.race)?.name, game.classes.find((c) => c.id === ed.build.class)?.name]
			.filter(Boolean)
			.join(' ')
	);

	function pickSkill(skill: string) {
		const t = ed.game.trees.find((x) => x.skill === skill);
		if (t) treeId = t.id;
		view = 'perks';
	}

	function onkey(e: KeyboardEvent) {
		if ((e.target as HTMLElement).closest('input, textarea, select')) return;
		if (e.key === '[') ed.setLevel(ed.level - 1);
		if (e.key === ']') ed.setLevel(ed.level + 1);
	}
</script>

<svelte:window
	onkeydown={onkey}
	onbeforeunload={(e) => {
		if (ed.saveStatus !== 'saved') e.preventDefault();
	}}
/>
<svelte:head><title>{ed.name} · Apostasy planner</title></svelte:head>

<div class="planner">
	<header class="top">
		<a href="/" class="home" aria-label="All builds">✦</a>
		<div class="ident">
			<input class="title" value={ed.name} oninput={(e) => ed.rename(e.currentTarget.value)} aria-label="Build name" />
			<p class="who">{who || 'No race or class yet'}</p>
		</div>
		<nav class="views" aria-label="Sections">
			{#each views as v (v.id)}
				<button class:on={view === v.id} aria-pressed={view === v.id} onclick={() => (view = v.id)}>
					{v.label}{#if v.id === 'summary' && ed.sim.issues.length}<span class="badge num">{ed.sim.issues.length}</span>{/if}
				</button>
			{/each}
		</nav>
		<p class="save {ed.saveStatus}" role="status" title={ed.saveError ?? ''}>
			{saveText[ed.saveStatus]}{#if ed.saveStatus === 'error'}
				<button class="retry" onclick={() => ed.save()}>Retry</button>{/if}
		</p>
	</header>

	<LevelRibbon {ed} />

	<div class="work">
		<SkillLedger {ed} onpick={pickSkill} />
		<main>
			{#if view === 'perks'}
				<PerksView {ed} bind:treeId />
			{:else if view === 'character'}
				<CharacterView {ed} />
			{:else if view === 'sources'}
				<SourcesView {ed} />
			{:else if view === 'shouts'}
				<ShoutsView game={ed.game} />
			{:else if view === 'combat'}
				<CombatView game={ed.game} />
			{:else}
				<SummaryView
					{ed}
					ongoto={(l) => {
						ed.setLevel(l);
						view = 'perks';
					}}
				/>
			{/if}
		</main>
	</div>
</div>

<style>
	.planner {
		display: grid;
		grid-template-rows: auto auto 1fr;
		height: 100vh;
	}

	.top {
		display: flex;
		align-items: center;
		gap: 1.2rem;
		padding: 0.55rem 1.2rem;
		background: var(--surface);
		border-bottom: 1px solid var(--line-soft);
	}

	.home {
		font-size: 1.3rem;
		color: var(--gold);
		text-decoration: none;
		opacity: 0.8;
	}

	.home:hover {
		opacity: 1;
	}

	.ident {
		display: grid;
		min-width: 12rem;
	}

	.title {
		font-family: var(--serif);
		font-size: var(--t-lg);
		background: none;
		border-color: transparent;
		padding: 0 0.3rem;
		margin-left: -0.3rem;
	}

	.title:hover,
	.title:focus {
		border-color: var(--line);
	}

	.who {
		font-size: var(--t-xs);
		color: var(--muted);
	}

	.views {
		display: flex;
		gap: 1.2rem;
		flex: 1;
		justify-content: center;
	}

	.views button {
		background: none;
		border: none;
		border-radius: 0;
		padding: 0.3rem 0;
		color: var(--muted);
		border-bottom: 2px solid transparent;
	}

	.views button:hover {
		color: var(--text);
	}

	.views button.on {
		color: var(--text);
		border-bottom-color: var(--gold);
	}

	.badge {
		margin-left: 0.35rem;
		color: var(--error);
	}

	.save {
		font-size: var(--t-xs);
		color: var(--muted);
		white-space: nowrap;
		min-width: 7rem;
		text-align: right;
	}

	.save.error {
		color: var(--error);
	}

	.retry {
		font-size: var(--t-xs);
		padding: 0 0.4rem;
	}

	.work {
		display: grid;
		grid-template-columns: 23rem minmax(0, 1fr);
		min-height: 0;
	}

	main {
		min-height: 0;
		overflow: hidden;
	}

	@media (max-width: 900px) {
		.planner {
			height: auto;
		}
		.work {
			grid-template-columns: 1fr;
		}
		.top {
			flex-wrap: wrap;
		}
		.views {
			justify-content: flex-start;
			flex-basis: 100%;
			order: 3;
			overflow-x: auto;
		}
		main {
			overflow: visible;
		}
	}
</style>
