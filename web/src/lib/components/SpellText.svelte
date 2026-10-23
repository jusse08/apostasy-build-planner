<script lang="ts">
	import type { Spell } from '#lib/types.ts';

	let { spell, showName = true }: { spell: Spell | null; showName?: boolean } = $props();

	// Effects without text are usually hidden helpers; keep the ones a player would read.
	let lines = $derived(
		(spell?.effects ?? [])
			.map((e) => e.description ?? e.perk?.description ?? null)
			.filter((t, i, a): t is string => !!t && a.indexOf(t) === i)
	);
</script>

{#if spell}
	<div class="spell">
		{#if showName && spell.name}<p class="name">{spell.name}</p>{/if}
		{#if spell.description}<p>{spell.description}</p>{/if}
		{#each lines as line}<p>{line}</p>{/each}
		{#if !spell.description && !lines.length}<p class="muted">The game has no description for this.</p>{/if}
	</div>
{/if}

<style>
	.spell {
		display: grid;
		gap: 0.25rem;
		line-height: 1.6;
		max-width: 66ch;
	}

	.name {
		color: var(--gold);
	}
</style>
