import { error } from '@sveltejs/kit';
import type { BuildState } from '#lib/types.ts';

const MAX_BODY = 512 * 1024;

/** Parses and sanity-checks a build payload ({ name, state }). */
export async function readBuild(request: Request): Promise<{ name: string; state: BuildState }> {
	const text = await request.text();
	if (text.length > MAX_BODY) error(413, 'Build is too large');
	let body: unknown;
	try {
		body = JSON.parse(text);
	} catch {
		error(400, 'Request body is not JSON');
	}
	const b = body as { name?: unknown; state?: Partial<BuildState> };
	const name = typeof b.name === 'string' && b.name.trim() ? b.name.trim().slice(0, 120) : 'Untitled build';
	const s = b.state;
	if (!s || typeof s !== 'object' || typeof s.levels !== 'object') error(400, 'Build state is missing');
	const state: BuildState = {
		race: typeof s.race === 'string' ? s.race : null,
		class: typeof s.class === 'string' ? s.class : null,
		stone: typeof s.stone === 'string' ? s.stone : null,
		deity: typeof s.deity === 'string' ? s.deity : null,
		targetLevel: Math.max(1, Math.min(81, Math.floor(Number(s.targetLevel) || 30))),
		levels: s.levels as BuildState['levels'],
		perkSources: Array.isArray(s.perkSources) ? s.perkSources.filter((x) => typeof x === 'string') : [],
		notes: typeof s.notes === 'string' ? s.notes.slice(0, 20000) : ''
	};
	return { name, state };
}
