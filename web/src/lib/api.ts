import type { BuildRecord, BuildState, BuildSummary, GameModel } from '#lib/types.ts';

let game: Promise<GameModel> | null = null;

/** Game data, fetched once per page load. */
export function loadGame(fetcher: typeof fetch = fetch): Promise<GameModel> {
	game ??= fetcher('/api/data').then((r) => {
		if (!r.ok) throw new Error(`Could not load game data (server answered ${r.status})`);
		return r.json();
	});
	return game;
}

async function call<T>(fetcher: typeof fetch, url: string, init?: RequestInit): Promise<T> {
	const r = await fetcher(url, { headers: { 'content-type': 'application/json' }, ...init });
	if (!r.ok) {
		const body = await r.json().catch(() => null);
		throw new Error(body?.message ?? `Server answered ${r.status}`);
	}
	return r.status === 204 ? (undefined as T) : r.json();
}

export const api = {
	list: (ids: string[], f: typeof fetch = fetch) =>
		call<BuildSummary[]>(f, `/api/builds?ids=${ids.map(encodeURIComponent).join(',')}`),
	get: (id: string, f: typeof fetch = fetch) => call<BuildRecord>(f, `/api/builds/${id}`),
	create: (name: string, state: BuildState) =>
		call<BuildRecord>(fetch, '/api/builds', { method: 'POST', body: JSON.stringify({ name, state }) }),
	save: (id: string, name: string, state: BuildState) =>
		call<BuildRecord>(fetch, `/api/builds/${id}`, { method: 'PUT', body: JSON.stringify({ name, state }) }),
	remove: (id: string) => call<void>(fetch, `/api/builds/${id}`, { method: 'DELETE' })
};
