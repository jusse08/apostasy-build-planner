<script lang="ts">
	// Jost is the free fallback when Futura Book BT isn't copied in (npm run fonts).
	import '@fontsource/jost/400.css';
	import '@fontsource/jost/500.css';
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Apostasy planner</title>
</svelte:head>

{@render children()}
