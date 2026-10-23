import { error } from '@sveltejs/kit';
import { api, loadGame } from '#lib/api.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
	try {
		const [game, record] = await Promise.all([loadGame(fetch), api.get(params.id, fetch)]);
		return { game, record };
	} catch (e) {
		error(404, (e as Error).message);
	}
};
