<script lang="ts">
	import CharacterView from './CharacterView.svelte';
	import Credits from './Credits.svelte';
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

	type View = 'perks' | 'character' | 'sources' | 'shouts' | 'summary';
	let view = $state<View>('character');
	let treeId = $state(ed.game.trees.find((t) => t.skill === 'OneHanded')?.id ?? ed.game.trees[0].id);

	const views: { id: View; label: string }[] = [
		{ id: 'character', label: 'Character' },
		{ id: 'perks', label: 'Perks' },
		{ id: 'sources', label: 'Quest perk points' },
		{ id: 'shouts', label: 'Shouts' },
		{ id: 'summary', label: 'Summary' }
	];

	const saveText = { saved: 'Saved', pending: 'Unsaved changes', saving: 'Saving…', error: 'Not saved' };
	let summaryProblems = $derived(ed.sim.issues.filter((issue) => issue.level <= ed.reached).length);


	function pickSkill(skill: string) {
		const t = ed.game.trees.find((x) => x.skill === skill);
		if (t) treeId = t.id;
		view = 'perks';
	}

	function onkey(e: KeyboardEvent) {
		if ((e.target as HTMLElement).closest('input, textarea, select')) return;
		if (e.key === '[') ed.setLevel(ed.level - 1);
		if (e.key === ']') ed.nextLevel();
	}
</script>

<svelte:window
	onkeydown={onkey}
	onbeforeunload={(e) => {
		if (ed.saveStatus !== 'saved') e.preventDefault();
	}}
/>
<svelte:head><title>{ed.name} · Apostasy Build Planner</title></svelte:head>

<div class="planner">
	<header class="top">
		<a href="/" class="home" aria-label="All builds"><img src="/logo.svg" alt="Apostasy Build Planner" /></a>
		<nav class="views" aria-label="Sections">
			{#each views as v (v.id)}
				<button class:on={view === v.id} aria-pressed={view === v.id} onclick={() => (view = v.id)}>
						{v.label}{#if v.id === 'summary' && summaryProblems}<span class="badge num">{summaryProblems}</span>{/if}
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
				<ShoutsView {ed} />
			{:else}
				<SummaryView
					{ed}
					ongoto={(l, tree) => {
						ed.setLevel(l);
						if (tree) treeId = tree;
						view = l === 1 ? 'character' : 'perks';
					}}
				/>
			{/if}
		</main>
	</div>

	<Credits inline />
</div>

<style>
	.planner {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: auto auto 1fr auto;
		height: 100vh;
	}

	.top {
		display: flex;
		align-items: center;
		gap: 1.2rem;
		padding: 0.95rem 1.2rem 0.95rem 1.8rem;
		background: var(--surface);
		border-bottom: 1px solid var(--line-soft);
	}

	.home {
		display: flex;
		opacity: 0.85;
		margin-right: 1.2rem;
	}

	.home img {
		height: 2.4rem;
		width: auto;
	}

	.home:hover {
		opacity: 1;
	}


	.views {
		display: flex;
		gap: 1.2rem;
		flex: 1;
		justify-content: center;
	}

	.views button {
		font-family: var(--display);
		letter-spacing: 0.04em;
		background: none;
		border: none;
		border-radius: 0;
		padding: 0.3rem 0;
		color: var(--muted);
		white-space: nowrap;
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

	/* Each tab's view mounts afresh, so it fades in on every switch. */
	main > :global(*) {
		animation: view-in 160ms ease-out;
	}

	@keyframes view-in {
		from {
			opacity: 0;
		}
	}

	@media (max-width: 900px) {
		.planner {
			height: auto;
		}
		.work {
			grid-template-columns: minmax(0, 1fr);
		}
		.save {
			min-width: 0;
			margin-left: auto;
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
