import { json } from '@sveltejs/kit';
import { createBuild, listBuilds } from '#lib/server/db.ts';
import { gameModel } from '#lib/server/data.ts';
import { readBuild } from '#lib/server/validate.ts';
import type { RequestHandler } from './$types';

// ?ids=a,b,c: the builds a browser remembers as its own.
export const GET: RequestHandler = ({ url }) =>
	json(listBuilds((url.searchParams.get('ids') ?? '').split(',').filter(Boolean).slice(0, 200)));

export const POST: RequestHandler = async ({ request }) => {
	const { name, state } = await readBuild(request);
	return json(createBuild(name, state, gameModel().dataVersion), { status: 201 });
};
