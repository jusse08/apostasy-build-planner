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
		/** Name every star, not only taken, available, selected and hovered ones. */
		allNames?: boolean;
		onselect?: (node: TreeNode) => void;
		onhover?: (node: TreeNode | null) => void;
		ontake?: (node: TreeNode) => void;
		ondrop?: (node: TreeNode) => void;
	}

	let {
		game,
		tree,
		nodeInfo,
		selected = null,
		interactive = true,
		allNames = false,
		onselect,
		onhover,
		ontake,
		ondrop
	}: Props = $props();

	// Skyrim's perk grid is tall and narrow; spread it sideways so names don't collide.
	// Units are screen pixels: an interactive tree is drawn at this size and only shrinks to fit.
	const UX = 120;
	const UY = 88;

	// The root node (index 0) is the invisible origin the game draws lines from; skip it.
	let stars = $derived(tree.nodes.filter((n) => n.index !== 0 && n.perk));
	let pos = $derived(new Map(stars.map((n) => [n.index, { x: n.x * UX, y: -n.y * UY }])));

	let box = $derived.by(() => {
		const ps = [...pos.values()];
		if (!ps.length) return { x: 0, y: 0, w: 100, h: 100 };
		const xs = ps.map((p) => p.x);
		const ys = ps.map((p) => p.y);
		const padX = 90;
		const padY = 34;
		const x = Math.min(...xs) - padX;
		const y = Math.min(...ys) - padY;
		return { x, y, w: Math.max(...xs) - x + padX, h: Math.max(...ys) - y + padY + 26 };
	});

	let cw = $state(0);
	let ch = $state(0);
	let scale = $derived(cw && ch ? Math.min(1, cw / box.w, ch / box.h) : 1);

	// Background dust: deterministic per tree so it doesn't shimmer on every render.
	let dust = $derived.by(() => {
		let seed = [...tree.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
		const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
		const n = Math.round((box.w * box.h) / 4200);
		return Array.from({ length: n }, () => ({
			x: box.x + rnd() * box.w,
			y: box.y + rnd() * box.h,
			r: rnd() < 0.08 ? 1.1 : 0.4 + rnd() * 0.4,
			o: 0.15 + rnd() * 0.45
		}));
	});

	let info = $derived(new Map(stars.map((n) => [n.index, nodeInfo(n)])));

	// Each link is the game's line texture stretched between two stars.
	let edges = $derived(
		stars.flatMap((n) =>
			n.links
				.filter((i) => pos.has(i))
				.map((i) => {
					const a = pos.get(n.index)!;
					const b = pos.get(i)!;
					return {
						key: `${n.index}-${i}`,
						a,
						len: Math.hypot(b.x - a.x, b.y - a.y),
						angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI - 90,
						lit: info.get(n.index)!.taken > 0 && info.get(i)!.taken > 0
					};
				})
		)
	);

	const SPRITE = { taken: 64, available: 42, locked: 30 };

	// Wheel zooms around the cursor, dragging pans; both reset when the tree changes.
	let frame = $state<HTMLDivElement>();
	let svgEl = $state<SVGSVGElement>();
	let view = $state({ z: 1, x: 0, y: 0 });
	let drag: { id: number; sx: number; sy: number; x: number; y: number; moved: boolean } | null = null;
	let dragging = $state(false);

	$effect(() => {
		void tree.id;
		view = { z: 1, x: 0, y: 0 };
	});

	$effect(() => {
		if (!interactive || !frame) return;
		const el = frame;
		// Listeners added by hand: the wheel one has to be non-passive to stop the page scrolling.
		const wheel = (e: WheelEvent) => {
			e.preventDefault();
			// One wheel notch is about 100; cap each event at roughly 16% so mice and touchpads feel alike.
			const step = Math.max(-100, Math.min(100, e.deltaY));
			const z = Math.min(4, Math.max(0.5, view.z * Math.exp(-step * 0.0015)));
			const r = svgEl!.getBoundingClientRect(); // includes the current transform (origin 0 0)
			const qx = (e.clientX - r.left) / view.z;
			const qy = (e.clientY - r.top) / view.z;
			const left = r.left - view.x;
			const top = r.top - view.y;
			view = { z, x: e.clientX - left - qx * z, y: e.clientY - top - qy * z };
		};
		el.addEventListener('wheel', wheel, { passive: false });
		return () => el.removeEventListener('wheel', wheel);
	});

	function down(e: PointerEvent) {
		if (e.button !== 0) return;
		drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: view.x, y: view.y, moved: false };
	}

	function move(e: PointerEvent) {
		if (!drag || e.pointerId !== drag.id) return;
		const dx = e.clientX - drag.sx;
		const dy = e.clientY - drag.sy;
		// A few pixels of slack so a click on a star stays a click.
		if (!drag.moved && Math.hypot(dx, dy) < 4) return;
		if (!drag.moved) {
			drag.moved = dragging = true;
			frame!.setPointerCapture(e.pointerId);
		}
		view = { ...view, x: drag.x + dx, y: drag.y + dy };
	}

	function up(e: PointerEvent) {
		if (!drag || e.pointerId !== drag.id) return;
		if (drag.moved) frame!.releasePointerCapture(e.pointerId);
		dragging = false;
		// Keep the flag until the click that ends the drag has been swallowed.
		setTimeout(() => (drag = null));
	}

	function swallowAfterDrag(e: MouseEvent) {
		if (drag?.moved) {
			e.stopPropagation();
			e.preventDefault();
		}
	}

	function resetOnEmpty(e: MouseEvent) {
		if (!(e.target as Element).closest('.star')) view = { z: 1, x: 0, y: 0 };
	}

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

<div
	class="frame"
	class:interactive
	class:dragging
	bind:this={frame}
	bind:clientWidth={cw}
	bind:clientHeight={ch}
	role="presentation"
	onpointerdown={interactive ? down : undefined}
	onpointermove={interactive ? move : undefined}
	onpointerup={interactive ? up : undefined}
	onpointercancel={interactive ? up : undefined}
	onclickcapture={swallowAfterDrag}
	ondblclick={interactive ? resetOnEmpty : undefined}
>
	<svg
		bind:this={svgEl}
		class="sky"
		class:all-names={allNames}
		style:transform={interactive ? `translate(${view.x}px, ${view.y}px) scale(${view.z})` : undefined}
		viewBox="{box.x} {box.y} {box.w} {box.h}"
		width={interactive ? box.w * scale : undefined}
		height={interactive ? box.h * scale : undefined}
		preserveAspectRatio="xMidYMid meet"
		role="group"
		aria-label="{tree.name} perk tree"
	>
		<g class="dust" aria-hidden="true">
			{#each dust as d}<circle cx={d.x} cy={d.y} r={d.r} opacity={d.o} />{/each}
		</g>

		{#each edges as e (e.key)}
			<image
				href="/sky/lines.png"
				x="-6"
				y="0"
				width="12"
				height={e.len}
				preserveAspectRatio="none"
				transform="translate({e.a.x} {e.a.y}) rotate({e.angle})"
				class="edge"
				class:lit={e.lit}
			/>
		{/each}

		{#each stars as n (n.index)}
			{@const p = pos.get(n.index)!}
			{@const s = info.get(n.index)!}
			{@const perk = game.perks[n.perk!]}
			{@const size = SPRITE[s.status]}
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
				onpointerenter={() => onhover?.(n)}
				onpointerleave={() => onhover?.(null)}
				onfocus={() => onhover?.(n)}
				onblur={() => onhover?.(null)}
				oncontextmenu={(e) => {
					if (!interactive) return;
					e.preventDefault();
					ondrop?.(n);
				}}
				onkeydown={(e) => onkey(e, n)}
			>
				<circle r="20" class="hit" />
				{#if perk?.stance}
					<circle r="12" class="stance {perk.stance.toLowerCase()}" />
				{/if}
				<image href="/sky/stars.png" x={-size / 2} y={-size / 2} width={size} height={size} class="sprite" />
				{#if s.status === 'available'}
					<circle r="5.5" class="ring" />
				{/if}
				{#if s.ranks > 1}
					{#each Array(s.ranks) as _, i}
						<circle cx={(i - (s.ranks - 1) / 2) * 6} cy="15" r="1.7" class="pip" class:on={i < s.taken} />
					{/each}
				{/if}
				<text y={s.ranks > 1 ? 30 : 25} class="label">{perk?.name}</text>
				{#if s.required !== null && s.status !== 'taken'}
					<text y={s.ranks > 1 ? 42 : 37} class="req">{s.required}</text>
				{/if}
			</g>
		{/each}
	</svg>
</div>

<style>
	.frame {
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	.frame.interactive {
		position: absolute;
		inset: 1rem 1rem 0;
		width: auto;
		height: auto;
		display: grid;
		place-items: center;
	}

	.sky {
		display: block;
		overflow: visible;
		transform-origin: 0 0;
	}

	.frame.interactive {
		cursor: grab;
		touch-action: none;
		user-select: none;
	}

	.frame.dragging,
	.frame.dragging .star {
		cursor: grabbing;
	}

	.frame:not(.interactive) .sky {
		width: 100%;
		height: 100%;
	}

	.dust circle {
		fill: #f3efe6;
	}

	.edge {
		opacity: 0.22;
	}

	.edge.lit {
		opacity: 0.8;
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

	.sprite {
		transform-box: fill-box;
		transform-origin: center;
		transition:
			opacity 300ms ease-out,
			filter 300ms ease-out;
	}

	.locked .sprite {
		opacity: 0.55;
		filter: grayscale(1);
	}

	.available .sprite {
		opacity: 0.85;
		filter: grayscale(0.4);
	}

	.taken .sprite {
		animation: ignite 700ms ease-out;
	}

	@keyframes ignite {
		from {
			opacity: 0.4;
			transform: scale(1.8);
		}
	}

	.interactive .star:hover .sprite {
		opacity: 1;
		filter: none;
	}

	.ring {
		fill: none;
		stroke: var(--aurora);
		stroke-width: 1.2;
	}

	.selected .hit,
	.star:focus-visible .hit {
		stroke: var(--aurora);
		stroke-width: 1;
		stroke-dasharray: 2 4;
	}

	.stance {
		fill: none;
		stroke-width: 1;
		stroke-dasharray: 1 3;
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

	/* Names stay quiet: shown for stars that matter now, the rest on hover or with "all names". */
	.label {
		font-family: var(--serif);
		font-size: 12.5px;
		letter-spacing: 0.02em;
		fill: rgba(255, 255, 255, 0.7);
		text-anchor: middle;
		pointer-events: none;
		paint-order: stroke;
		stroke: rgba(10, 11, 13, 0.85);
		stroke-width: 3px;
		stroke-linejoin: round;
		opacity: 0;
		transition: opacity 150ms;
	}

	.all-names .label,
	.taken .label,
	.available .label,
	.selected .label,
	.star:hover .label,
	.star:focus-visible .label {
		opacity: 1;
	}

	.locked .label {
		fill: rgba(255, 255, 255, 0.5);
	}

	.taken .label,
	.selected .label,
	.star:hover .label {
		fill: var(--starlight);
	}

	.req {
		font-family: var(--sans);
		font-size: 10.5px;
		fill: rgba(255, 255, 255, 0.4);
		text-anchor: middle;
		pointer-events: none;
		opacity: 0;
	}

	.all-names .req,
	.star:hover .req {
		opacity: 1;
	}

	@media (prefers-reduced-motion: reduce) {
		.taken .sprite {
			animation: none;
		}
	}
</style>
