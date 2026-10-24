<script lang="ts">
	// Jost is the free fallback when Futura Book BT isn't copied in (npm run fonts).
	import '@fontsource/jost/400.css';
	import '@fontsource/jost/500.css';
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import { afterNavigate } from '$app/navigation';
	import { PUBLIC_GOATCOUNTER } from '$app/env/public';
	import { onMount } from 'svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// Visit counting with a self-hosted GoatCounter (cookie-less), only where PUBLIC_GOATCOUNTER is set
	// to its endpoint, e.g. https://stats.example.com/count. count.js counts the first page itself;
	// later in-app navigations are counted here.
	const counter = PUBLIC_GOATCOUNTER;
	onMount(() => {
		if (!counter) return;
		const s = document.createElement('script');
		s.async = true;
		s.dataset.goatcounter = counter;
		s.src = new URL('/count.js', counter).href;
		document.head.append(s);
	});
	afterNavigate(({ type }) => {
		if (counter && type !== 'enter') window.goatcounter?.count?.({ path: location.pathname });
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Apostasy Build Planner</title>
</svelte:head>

{@render children()}
