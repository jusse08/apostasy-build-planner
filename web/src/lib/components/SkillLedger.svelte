<script lang="ts">
	import type { BuildEditor } from '#lib/editor.svelte.ts';
	import { ATTRIBUTES, atLevel, stepCost } from '#lib/rules/engine.ts';
	import type { SkillId } from '#lib/types.ts';

	let { ed, onpick }: { ed: BuildEditor; onpick: (skill: SkillId) => void } = $props();

	const groups: { label: string; skills: SkillId[] }[] = [
		{ label: 'Combat', skills: ['OneHanded', 'TwoHanded', 'Marksman', 'Block', 'HeavyArmor', 'Smithing'] },
		{ label: 'Stealth', skills: ['LightArmor', 'Sneak', 'Lockpicking', 'Pickpocket', 'Speechcraft', 'Alchemy'] },
		{ label: 'Magic', skills: ['Illusion', 'Conjuration', 'Destruction', 'Restoration', 'Alteration', 'Enchanting'] }
	];

	let st = $derived(ed.current);
	let plan = $derived(ed.build.levels[ed.level]);
	let canBuy = $derived(ed.level >= 2);
	let attrGain = $derived(atLevel(ed.game.leveling.attributeAtLevel, ed.level));
	let perksLeft = $derived(st.perkPointsTotal - st.perkPointsSpent);
	let name = (id: SkillId) => ed.game.skills.find((s) => s.id === id)?.name ?? id;

	function canRaise(skill: SkillId): boolean {
		return canBuy && st.skills[skill] < st.skillCap && st.skillPointsLeft >= stepCost(ed.game.leveling, st.skills[skill]);
	}
</script>

<aside class="ledger">
	<header>
		<p class="lvl"><span class="word">Level</span> <span class="num">{ed.level}</span></p>
		<p class="xp num">{st.xpTotal.toLocaleString('en-US')} XP from level 1</p>
	</header>

	<div class="budget">
		<div class:bad={st.skillPointsSpent > st.skillPointsAvailable}>
			<p class="big num">{st.skillPointsLeft}</p>
			<p class="what">skill points left<br /><span class="num">of {st.skillPointsAvailable}{st.skillPointsGained ? `, +${st.skillPointsGained} now` : ''}</span></p>
		</div>
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

	{#each groups as g (g.label)}
		<section class="group">
			<h3>{g.label}</h3>
			<ul>
				{#each g.skills as id (id)}
					{@const bought = plan?.skills[id] ?? 0}
					{@const v = st.skills[id]}
					<li class:bought={bought > 0} class:over={v > st.skillCap}>
						<button class="name" onclick={() => onpick(id)}>{name(id)}</button>
						<span class="bar" aria-hidden="true">
							<i class="was" style="width: {v - bought}%"></i>
							<i class="add" style="width: {bought}%"></i>
							<b style="left: {st.skillCap}%"></b>
						</span>
						<span class="v num">{v}{#if bought}<small>+{bought}</small>{/if}</span>
						{#if canBuy}
							<span class="ctl">
								<button onclick={() => ed.addSkill(id, -1)} disabled={!bought} aria-label="Lower {name(id)}">−</button>
								<button onclick={() => ed.addSkill(id, 1)} disabled={!canRaise(id)} aria-label="Raise {name(id)}, costs {stepCost(ed.game.leveling, v)}">+</button>
							</span>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/each}

	{#if canBuy}
		<p class="hint">
			One skill level costs {ed.game.leveling.skillPoints.costs.join(' / ')} points in the 0–25 / 26–50 / 51–75 / 76–100 ranges.
			The tick on each bar is the level {ed.level} cap ({st.skillCap}). Unspent points carry over, up to {ed.game.leveling.skillPoints.cap}.
		</p>
	{/if}
</aside>

<style>
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
		grid-template-columns: 7.2rem 1fr 3rem auto;
		gap: 0.6rem;
		align-items: center;
		min-height: 1.75rem;
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
		height: 4px;
		background: rgba(255, 255, 255, 0.06);
		border-radius: 2px;
	}

	.bar i {
		display: block;
		height: 100%;
	}

	.bar .was {
		background: rgba(255, 255, 255, 0.55);
		border-radius: 2px 0 0 2px;
	}

	.bar .add {
		background: var(--aurora);
	}

	.bar b {
		position: absolute;
		top: -3px;
		width: 1px;
		height: 10px;
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
