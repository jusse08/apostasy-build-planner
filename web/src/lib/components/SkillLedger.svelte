<script lang="ts">
	import type { BuildEditor } from '#lib/editor.svelte.ts';
	import { ATTRIBUTES, atLevel, stepCost, trainingCost } from '#lib/rules/engine.ts';
	import type { SkillId } from '#lib/types.ts';
	import type { Attachment } from 'svelte/attachments';

	let { ed, onpick }: { ed: BuildEditor; onpick: (skill: SkillId) => void } = $props();

	let who = $derived(
		[ed.game.races.find((r) => r.id === ed.build.race)?.name, ed.game.classes.find((c) => c.id === ed.build.class)?.name]
			.filter(Boolean)
			.join(' ')
	);

	const groups: { label: string; skills: SkillId[] }[] = [
		{ label: 'Combat', skills: ['OneHanded', 'TwoHanded', 'Marksman', 'Block', 'HeavyArmor', 'Smithing'] },
		{ label: 'Stealth', skills: ['LightArmor', 'Sneak', 'Lockpicking', 'Pickpocket', 'Speechcraft', 'Alchemy'] },
		{ label: 'Magic', skills: ['Illusion', 'Conjuration', 'Destruction', 'Restoration', 'Alteration', 'Enchanting'] }
	];

	let st = $derived(ed.current);
	let plan = $derived(ed.build.levels[ed.level]);
	let canBuy = $derived(ed.level >= 2);
	// The +/− buttons and the wheel spend skill points, book trainer sessions or read skill books.
	let mode = $state<'points' | 'train' | 'books'>('points');
	let training = $derived(mode === 'train');
	let reading = $derived(mode === 'books');
	let editable = $derived(training || reading || canBuy);
	// Skill whose books are listed in Books mode.
	let open = $state<SkillId | null>(null);
	const booksOf = (skill: SkillId) => ed.game.books.filter((b) => b.skill === skill);
	const unread = (skill: SkillId) => booksOf(skill).filter((b) => ed.readAt(b.key) === undefined);
	const readHere = (skill: SkillId) => (plan?.books ?? []).filter((k) => ed.game.books.some((b) => b.key === k && b.skill === skill));
	let booksHere = $derived(Object.values(st.booksRead).reduce((a, n) => a + n, 0));
	let tr = $derived(ed.game.leveling.training);
	let sessionsLeft = $derived(tr.sessionsPerLevel - st.trainingSessions);
	const gold = (n: number) => n.toLocaleString('en-US');
	let attrGain = $derived(atLevel(ed.game.leveling.attributeAtLevel, ed.level));
	let perksLeft = $derived(st.perkPointsTotal - st.perkPointsSpent);
	let name = (id: SkillId) => ed.game.skills.find((s) => s.id === id)?.name ?? id;

	function canRaise(skill: SkillId): boolean {
		const v = st.skills[skill];
		if (training) return sessionsLeft > 0 && v < st.skillCap && v < (tr.maxLevel[skill] ?? 0);
		if (reading) return v < st.skillCap && unread(skill).length > 0;
		// Skill points go in before this level's trainer sessions.
		const before = v - (st.trained[skill] ?? 0) - (st.booksRead[skill] ?? 0);
		return canBuy && before < st.skillPointCap && st.skillPointsLeft >= stepCost(ed.game.leveling, before);
	}
	let tick = $derived(mode === 'points' ? st.skillPointCap : st.skillCap);

	const added = (skill: SkillId) => (reading ? readHere(skill).length : (training ? plan?.trained?.[skill] : plan?.skills[skill]) ?? 0);

	function change(skill: SkillId, delta: number) {
		if (reading) {
			// + reads the next unread book, − unreads the last one read at this level.
			const key = delta > 0 ? unread(skill)[0]?.key : readHere(skill).at(-1);
			if (key) ed.toggleBook(key);
		} else if (training) ed.addTraining(skill, delta);
		else ed.addSkill(skill, delta);
	}

	// Wheel over a skill's bar, value or buttons raises (up) or lowers (down) it. Attached by hand
	// because the listener must be non-passive to keep the ledger from scrolling meanwhile.
	function wheel(skill: SkillId): Attachment<HTMLElement> {
		return (node) => {
			const on = (e: WheelEvent) => {
				if (!e.deltaY) return;
				e.preventDefault();
				if (e.deltaY < 0 && canRaise(skill)) change(skill, 1);
				if (e.deltaY > 0 && added(skill) > 0) change(skill, -1);
			};
			node.addEventListener('wheel', on, { passive: false });
			return () => node.removeEventListener('wheel', on);
		};
	}
</script>

<aside class="ledger">
	<header>
		<div class="ident">
			<input class="title" value={ed.name} oninput={(e) => ed.rename(e.currentTarget.value)} aria-label="Build name" />
			<p class="who">{who || 'No race or class yet'}</p>
		</div>
		<div class="where">
			<p class="lvl"><span class="word">Level</span> <span class="num">{ed.level}</span></p>
			<p class="xp num">{st.xpTotal.toLocaleString('en-US')} XP</p>
		</div>
	</header>

	<div class="budget">
		{#if reading}
			<div>
				<p class="big num">{booksHere}</p>
				<p class="what">books read this level<br /><span class="num">{ed.sim.readAt.size} of {ed.game.books.length} so far</span></p>
			</div>
		{:else if training}
			<div class:bad={sessionsLeft < 0} title="{gold(st.trainingGold)} gold at this level, {gold(st.trainingGoldTotal)} by level {ed.level}">
				<p class="big num">{sessionsLeft}</p>
				<p class="what">trainer sessions left<br /><span class="num">of {tr.sessionsPerLevel} this level</span></p>
			</div>
		{:else}
			<div class:bad={st.skillPointsSpent > st.skillPointsAvailable}>
				<p class="big num">{st.skillPointsLeft}</p>
				<p class="what">skill points left<br /><span class="num">of {st.skillPointsAvailable}{st.skillPointsGained ? `, +${st.skillPointsGained} now` : ''}</span></p>
			</div>
		{/if}
		<div class:bad={perksLeft < 0}>
			<p class="big num">{perksLeft}</p>
			<p class="what">perk points free<br /><span class="num">{st.perkPointsSpent} of {st.perkPointsTotal} used{st.perkPointsGained ? `, +${st.perkPointsGained} now` : ''}</span></p>
		</div>
	</div>

	{#if canBuy}
		<div class="attr" role="group" aria-label="Attribute raised at this level">
			{#each ATTRIBUTES as a}
				<button class={a.toLowerCase()} class:on={plan?.attribute === a} aria-pressed={plan?.attribute === a} onclick={() => ed.setAttribute(plan?.attribute === a ? null : a)}>
					<span>{a}</span>
					<span class="num">{st.attributes[a]}</span>
				</button>
			{/each}
		</div>
		<p class="hint">Pick one attribute for this level, +{attrGain}.</p>
	{:else}
		<p class="attrs num">
			{#each ATTRIBUTES as a}<span class={a.toLowerCase()}>{a} {st.attributes[a]}</span>{/each}
		</p>
		<p class="hint">Level 1 is set by race and class. Skill and perk points arrive with each level up.</p>
	{/if}

	<div class="mode" role="group" aria-label="What the skill buttons do">
		<button class:on={mode === 'points'} aria-pressed={mode === 'points'} onclick={() => (mode = 'points')}>Skill points</button>
		<button class:on={training} aria-pressed={training} onclick={() => (mode = 'train')}>Trainers</button>
		<button class:on={reading} aria-pressed={reading} onclick={() => (mode = 'books')}>Books</button>
	</div>

	{#each groups as g (g.label)}
		<section class="group">
			<h3>{g.label}</h3>
			<ul>
				{#each g.skills as id (id)}
					{@const bought = plan?.skills[id] ?? 0}
					{@const taught = st.trained[id] ?? 0}
					{@const read = st.booksRead[id] ?? 0}
					{@const v = st.skills[id]}
					<!-- The bar shows every source; the number only the current mode's. -->
					{@const gain = reading ? read : training ? taught : bought}
					<li class:bought={bought + taught + read > 0} class:over={v > st.skillCap}>
						{#if reading}
							<button class="name toggle" class:on={open === id} aria-expanded={open === id} onclick={() => (open = open === id ? null : id)}>
								<span class="caret" aria-hidden="true"></span>{name(id)}
							</button>
						{:else}
							<button class="name" onclick={() => onpick(id)}>{name(id)}</button>
						{/if}
						<span class="dial" {@attach editable && wheel(id)}>
							<span class="bar" aria-hidden="true">
								<i class="was" style="width: {v - bought - taught - read}%"></i>
								<i class="add" style="width: {bought}%"></i>
								<i class="taught" style="width: {taught}%"></i>
								<i class="read" style="width: {read}%"></i>
								<b style="left: {tick}%"></b>
							</span>
							<span class="v num">{v}{#if gain}<small class:taught={training} class:read={reading}>+{gain}</small>{/if}</span>
							{#if editable}
								<span class="ctl">
									<button onclick={() => change(id, -1)} disabled={!added(id)} aria-label="{reading ? 'Unread a book for' : training ? 'Untrain' : 'Lower'} {name(id)}">−</button>
									{#if reading}
										<button onclick={() => change(id, 1)} disabled={!canRaise(id)} aria-label="Read a {name(id)} book" title={unread(id)[0]?.name}>+</button>
									{:else if training}
										<button onclick={() => change(id, 1)} disabled={!canRaise(id)} aria-label="Train {name(id)}" title="{gold(trainingCost(v))} gold">+</button>
									{:else}
										<button onclick={() => change(id, 1)} disabled={!canRaise(id)} aria-label="Raise {name(id)}, costs {stepCost(ed.game.leveling, v - taught)}">+</button>
									{/if}
								</span>
							{/if}
						</span>
					</li>
					{#if reading && open === id}
						<li class="books">
							{#each booksOf(id) as b (b.key)}
								{@const at = ed.readAt(b.key)}
								<button class:here={at === ed.level} class:earlier={at !== undefined && at !== ed.level} disabled={at === undefined && v >= st.skillCap} onclick={() => ed.toggleBook(b.key)} title={b.plugin}>
									<span>{b.name}</span>
									{#if at !== undefined}<span class="num">level {at}</span>{/if}
								</button>
							{/each}
						</li>
					{/if}
				{/each}
			</ul>
		</section>
	{/each}

	{#if reading}
		<p class="hint">
			Each book gives +1 the first time it is read, up to the level {ed.level} cap ({st.skillCap}).
		</p>
	{:else if training}
		<p class="hint">
			Up to {tr.sessionsPerLevel} trainer sessions per level, up to skill {Math.max(...Object.values(tr.maxLevel))}. They don't spend skill points; hover + for the price in gold.
		</p>
	{:else if canBuy}
		<p class="hint">
			One skill level costs {ed.game.leveling.skillPoints.costs.join(' / ')} points in the 0–25 / 26–50 / 51–75 / 76–100 ranges.
			Skill points raise a skill up to the level {ed.level - 1} cap ({st.skillPointCap}), the tick on each bar; trainers and books reach {st.skillCap}.
			Unspent points carry over, up to {ed.game.leveling.skillPoints.cap}.
		</p>
	{/if}
</aside>

<style>
	/* Build name on the left, the level being planned on the right. */
	header {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding-bottom: 0.9rem;
		border-bottom: 1px solid var(--line-soft);
	}

	.ident {
		display: grid;
		gap: 0.1rem;
		flex: 1;
		min-width: 0;
	}

	.where {
		text-align: right;
		white-space: nowrap;
	}

	.title {
		font-family: var(--serif);
		font-size: var(--t-lg);
		background: none;
		border-color: transparent;
		padding: 0.1rem 0.3rem;
		margin-left: -0.3rem;
		width: calc(100% + 0.3rem);
	}

	.title:hover,
	.title:focus {
		border-color: var(--line);
	}

	.who {
		font-size: var(--t-xs);
		color: var(--muted);
	}

	.ledger {
		display: grid;
		gap: 1.1rem;
		align-content: start;
		padding: 1.4rem 1.3rem 2rem;
		background: var(--surface);
		overflow-y: auto;
	}

	.lvl {
		font-family: var(--serif);
		font-size: 2.6rem;
		line-height: 1;
		color: var(--text);
	}

	.lvl .word {
		font-size: 1.3rem;
		color: var(--muted);
	}

	.xp {
		color: var(--muted);
		font-size: var(--t-sm);
		margin-top: 0.3rem;
	}

	.budget {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.8rem;
	}

	.budget > div {
		display: flex;
		gap: 0.55rem;
		align-items: center;
	}

	.big {
		font-size: 2rem;
		line-height: 1;
		color: var(--text);
		min-width: 2ch;
	}

	.bad .big {
		color: var(--error);
	}

	.what {
		font-size: var(--t-xs);
		color: var(--text);
		line-height: 1.3;
	}

	.what span {
		color: var(--muted);
	}

	.attr {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.35rem;
	}

	.attr button {
		display: grid;
		text-align: left;
		padding: 0.35rem 0.55rem;
		background: var(--surface-2);
		border: 1px solid transparent;
		font-size: var(--t-xs);
		color: var(--muted);
	}

	.attr button .num {
		font-size: var(--t-lg);
		color: var(--text);
	}

	.attr button.on.health {
		border-color: #d08a8a;
	}
	.attr button.on.magicka {
		border-color: #8aa8d8;
	}
	.attr button.on.stamina {
		border-color: #9cc48d;
	}

	.mode {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.35rem;
	}

	.mode button {
		padding: 0.3rem 0.5rem;
		font-size: var(--t-xs);
		background: var(--surface-2);
		border: 1px solid transparent;
		color: var(--muted);
	}

	.mode button.on {
		border-color: var(--line);
		color: var(--text);
	}

	.attrs {
		display: flex;
		gap: 1rem;
		font-size: var(--t-sm);
	}

	.hint {
		font-size: var(--t-xs);
		color: var(--muted);
		line-height: 1.5;
	}

	.group h3 {
		font-size: var(--t-xs);
		letter-spacing: 0.08em;
		color: var(--faint);
		padding-bottom: 0.3rem;
		border-bottom: 1px solid var(--line-soft);
		margin-bottom: 0.3rem;
	}

	.group ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.group li:hover {
		background: linear-gradient(90deg, transparent, var(--hover) 12%, var(--hover) 88%, transparent);
	}

	.group li {
		display: grid;
		grid-template-columns: 7.2rem minmax(0, 1fr) 4.4rem auto;
		gap: 0.6rem;
		align-items: center;
		min-height: 1.75rem;
	}

	/* Groups the wheel target without adding a grid cell. */
	.dial {
		display: contents;
	}

	.name {
		background: none;
		border: none;
		padding: 0;
		text-align: left;
		font-family: var(--serif);
		font-size: var(--t-md);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.name:hover {
		color: var(--starlight);
	}

	.bar {
		position: relative;
		display: flex;
		height: 6px;
		background: rgba(255, 255, 255, 0.06);
		border-radius: 3px;
	}

	.bar i {
		display: block;
		height: 100%;
	}

	.bar .was {
		background: rgba(255, 255, 255, 0.55);
		border-radius: 3px 0 0 3px;
	}

	.bar .add {
		background: var(--aurora);
	}

	.bar .taught {
		background: var(--gold);
	}

	.bar .read {
		background: var(--starlight);
	}

	.bar b {
		position: absolute;
		top: -3px;
		width: 1px;
		height: 12px;
		background: var(--starlight);
		opacity: 0.5;
	}

	.v {
		text-align: right;
		font-size: var(--t-md);
	}

	.v small {
		font-size: var(--t-xs);
		color: var(--aurora);
		margin-left: 0.15rem;
	}

	.v small.taught {
		color: var(--gold);
	}

	.v small.read {
		color: var(--starlight);
	}

	.name.on {
		color: var(--starlight);
	}

	/* Books mode: the name opens the skill's book list. */
	.toggle {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.caret {
		flex: none;
		width: 0;
		height: 0;
		border-left: 5px solid currentColor;
		border-top: 4px solid transparent;
		border-bottom: 4px solid transparent;
		opacity: 0.7;
		transition: transform 120ms;
	}

	.toggle.on .caret {
		transform: rotate(90deg);
	}

	/* The open skill's books, read ones lit. */
	.group li.books {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0;
		padding: 0.15rem 0 0.45rem 0.8rem;
		background: none;
	}

	.books button {
		display: flex;
		justify-content: space-between;
		gap: 0.6rem;
		padding: 0.15rem 0.4rem;
		background: none;
		border: none;
		text-align: left;
		font-size: var(--t-sm);
		color: var(--muted);
	}

	.books button:hover:not(:disabled) {
		background: var(--hover);
		color: var(--text);
	}

	.books button.here {
		color: var(--starlight);
	}

	.books button.earlier {
		color: var(--faint);
	}

	.books button:disabled {
		opacity: 0.4;
	}

	.books .num {
		font-size: var(--t-xs);
		white-space: nowrap;
	}

	.over .v {
		color: var(--error);
	}

	.ctl {
		display: flex;
		gap: 2px;
		opacity: 0.35;
		transition: opacity 120ms;
	}

	li:hover .ctl,
	li:focus-within .ctl,
	li.bought .ctl {
		opacity: 1;
	}

	.ctl button {
		width: 1.55rem;
		height: 1.55rem;
		padding: 0;
		line-height: 1;
		background: var(--surface-2);
		border-color: transparent;
	}
</style>
