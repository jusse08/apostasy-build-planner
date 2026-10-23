<script lang="ts">
	/** One line for the planner's bottom strip, two centred lines on the home page. */
	let { inline = false }: { inline?: boolean } = $props();
</script>

<footer class:inline>
	<p>An unofficial fan-made planner, not affiliated with the Apostasy team.</p>
	<p>
		Thanks to aljo for
		<a href="https://www.nexusmods.com/skyrimspecialedition/mods/118893" target="_blank" rel="noopener noreferrer">Apostasy</a>.
	</p>
</footer>

<style>
	footer {
		display: grid;
		justify-items: center;
		gap: 0.2rem;
		padding: 1.5rem 1.5rem 1.8rem;
		font-size: var(--t-xs);
		color: var(--faint);
		text-align: center;
	}

	footer.inline {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0 0.5rem;
		padding: 0.3rem 1.2rem;
		background: var(--surface);
		border-top: 1px solid var(--line-soft);
	}

	footer.inline p + p::before {
		content: '·';
		margin-right: 0.5rem;
	}

	a {
		color: var(--muted);
		text-underline-offset: 2px;
	}

	a:hover {
		color: var(--gold);
	}
</style>
