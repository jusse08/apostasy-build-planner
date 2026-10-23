import { json } from '@sveltejs/kit';
import { createBuild, listBuilds } from '#lib/server/db.ts';
import { gameModel } from '#lib/server/data.ts';
import { readBuild } from '#lib/server/validate.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => json(listBuilds());

export const POST: RequestHandler = async ({ request }) => {
	const { name, state } = await readBuild(request);
	return json(createBuild(name, state, gameModel().dataVersion), { status: 201 });
};
