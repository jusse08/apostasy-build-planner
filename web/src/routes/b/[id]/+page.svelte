<script lang="ts">
	import Planner from '#lib/components/Planner.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<!-- A new editor per build, so switching builds never reuses another build's state. -->
{#key data.record.id}
	<Planner game={data.game} record={data.record} />
{/key}
