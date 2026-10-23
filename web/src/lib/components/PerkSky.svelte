<script lang="ts">
	import type { NodeStatus } from '#lib/rules/engine.ts';
	import type { FormKey, GameModel, Tree, TreeNode } from '#lib/types.ts';

	interface Props {
		game: GameModel;
		tree: Tree;
		/** Status per tree node (rank 1 key) and how many ranks are taken. */
		nodeInfo: (node: TreeNode) => { status: NodeStatus; taken: number; ranks: number; required: number | null };
		selected?: FormKey | null;
		interactive?: boolean;
		onselect?: (node: TreeNode) => void;
		ontake?: (node: TreeNode) => void;
		ondrop?: (node: TreeNode) => void;
	}

	let { game, tree, nodeInfo, selected = null, interactive = true, onselect, ontake, ondrop }: Props = $props();

	// Skyrim's perk grid is tall and narrow; spread it sideways so names don't collide.
	const UX = 118;
	const UY = 78;

	// The root node (index 0) is the invisible origin the game draws lines from; skip it.
	let stars = $derived(tree.nodes.filter((n) => n.index !== 0 && n.perk));
	let pos = $derived(new Map(stars.map((n) => [n.index, { x: n.x * UX, y: -n.y * UY }])));

	let box = $derived.by(() => {
		const ps = [...pos.values()];
		if (!ps.length) return { x: 0, y: 0, w: 100, h: 100 };
		const xs = ps.map((p) => p.x);
		const ys = ps.map((p) => p.y);
		const padX = 100;
		const padY = 40;
		const x = Math.min(...xs) - padX;
		const y = Math.min(...ys) - padY;
		return { x, y, w: Math.max(...xs) - x + padX, h: Math.max(...ys) - y + padY + 20 };
	});

	// Background dust: deterministic per tree so it doesn't shimmer on every render.
	let dust = $derived.by(() => {
		let seed = [...tree.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
		const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
		const n = Math.round((box.w * box.h) / 5200);
		return Array.from({ length: n }, () => ({
			x: box.x + rnd() * box.w,
			y: box.y + rnd() * box.h,
			r: rnd() < 0.08 ? 1.4 : 0.6 + rnd() * 0.5,
			o: 0.15 + rnd() * 0.45
		}));
	});

	let edges = $derived(
		stars.flatMap((n) => n.links.filter((i) => pos.has(i)).map((i) => ({ from: n.index, to: i })))
	);

	let info = $derived(new Map(stars.map((n) => [n.index, nodeInfo(n)])));

	function onkey(e: KeyboardEvent, n: TreeNode) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			if (e.shiftKey) ondrop?.(n);
			else ontake?.(n);
		} else if (e.key === 'Delete' || e.key === 'Backspace') {
			e.preventDefault();
			ondrop?.(n);
		}
	}
</script>

<svg
	class="sky"
	class:interactive
	viewBox="{box.x} {box.y} {box.w} {box.h}"
	preserveAspectRatio="xMidYMid meet"
	role="group"
	aria-label="{tree.name} perk tree"
>
	<defs>
		<filter id="glow-{tree.id}" x="-200%" y="-200%" width="500%" height="500%">
			<feGaussianBlur stdDeviation="6" result="b" />
			<feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
		</filter>
	</defs>

	<g class="dust" aria-hidden="true">
		{#each dust as d}<circle cx={d.x} cy={d.y} r={d.r} opacity={d.o} />{/each}
	</g>

	{#each edges as e (e.from + '-' + e.to)}
		{@const a = pos.get(e.from)!}
		{@const b = pos.get(e.to)!}
		{@const lit = info.get(e.from)!.taken > 0 && info.get(e.to)!.taken > 0}
		<line x1={a.x} y1={a.y} x2={b.x} y2={b.y} class="edge" class:lit />
	{/each}

	{#each stars as n (n.index)}
		{@const p = pos.get(n.index)!}
		{@const s = info.get(n.index)!}
		{@const perk = game.perks[n.perk!]}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex (role is "button" whenever tabindex is set) -->
		<g
			class="star {s.status}"
			class:selected={selected === n.perk}
			transform="translate({p.x} {p.y})"
			role={interactive ? 'button' : undefined}
			tabindex={interactive ? 0 : undefined}
			aria-label="{perk?.name}, {s.taken} of {s.ranks} taken"
			onclick={() => onselect?.(n)}
			ondblclick={() => ontake?.(n)}
			oncontextmenu={(e) => {
				if (!interactive) return;
				e.preventDefault();
				ondrop?.(n);
			}}
			onkeydown={(e) => onkey(e, n)}
		>
			<circle r="26" class="hit" />
			{#if perk?.stance}
				<circle r="17" class="stance {perk.stance.toLowerCase()}" />
			{/if}
			{#if s.status === 'taken'}
				<circle r="9" class="halo" filter="url(#glow-{tree.id})" />
			{/if}
			<circle r={s.status === 'taken' ? 6.5 : s.status === 'available' ? 6 : 4} class="core" />
			{#if s.ranks > 1}
				{#each Array(s.ranks) as _, i}
					<circle cx={(i - (s.ranks - 1) / 2) * 8} cy="24" r="2.4" class="pip" class:on={i < s.taken} />
				{/each}
			{/if}
			<text y={s.ranks > 1 ? 44 : 36} class="label">{perk?.name}</text>
			{#if s.required !== null && s.status !== 'taken'}
				<text y={s.ranks > 1 ? 58 : 50} class="req">{s.required}</text>
			{/if}
		</g>
	{/each}
</svg>

<style>
	.sky {
		width: 100%;
		height: 100%;
		display: block;
	}

	.dust circle {
		fill: #f3efe6;
	}

	.edge {
		stroke: rgba(145, 138, 129, 0.5);
		stroke-width: 1;
	}

	.edge.lit {
		stroke: var(--starlight);
		stroke-opacity: 0.7;
		stroke-width: 1.6;
	}

	.star {
		outline: none;
	}

	.interactive .star {
		cursor: pointer;
	}

	.hit {
		fill: transparent;
	}

	.core {
		fill: #6f6b65;
		transition: r 400ms ease-out, fill 400ms ease-out;
	}

	.available .core {
		fill: var(--sky-deep);
		stroke: var(--aurora);
		stroke-width: 2;
	}

	.taken .core {
		fill: #fffaf0;
	}

	.halo {
		fill: var(--starlight);
		opacity: 0.55;
		animation: ignite 700ms ease-out;
	}

	@keyframes ignite {
		from {
			opacity: 1;
			r: 22px;
		}
	}

	.interactive .star:hover .core {
		stroke: var(--text);
		stroke-width: 1.5;
	}

	.selected .hit,
	.star:focus-visible .hit {
		stroke: var(--aurora);
		stroke-width: 1;
		stroke-dasharray: 2 4;
	}

	.stance {
		fill: none;
		stroke-width: 1.2;
		stroke-dasharray: 1 4;
		stroke-linecap: round;
	}

	.stance.wolf {
		stroke: var(--wolf);
	}
	.stance.hawk {
		stroke: var(--hawk);
	}
	.stance.bear {
		stroke: var(--bear);
	}

	.pip {
		fill: rgba(145, 138, 129, 0.5);
	}

	.pip.on {
		fill: var(--starlight);
	}

	.label {
		font-family: var(--serif);
		font-size: 16px;
		fill: rgba(255, 255, 255, 0.55);
		text-anchor: middle;
		pointer-events: none;
		paint-order: stroke;
		stroke: var(--sky-deep);
		stroke-width: 4px;
		stroke-linejoin: round;
	}

	.available .label {
		fill: var(--text);
	}

	.taken .label,
	.selected .label {
		fill: var(--starlight);
	}

	.req {
		font-family: var(--sans);
		font-size: 12px;
		fill: rgba(255, 255, 255, 0.35);
		text-anchor: middle;
		pointer-events: none;
	}
</style>
