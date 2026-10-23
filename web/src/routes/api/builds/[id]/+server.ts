import { error, json } from '@sveltejs/kit';
import { deleteBuild, getBuild, updateBuild } from '#lib/server/db.ts';
import { gameModel } from '#lib/server/data.ts';
import { readBuild } from '#lib/server/validate.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params }) => {
	const build = getBuild(params.id);
	if (!build) error(404, 'Build not found');
	return json(build);
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const { name, state } = await readBuild(request);
	const build = updateBuild(params.id, name, state, gameModel().dataVersion);
	if (!build) error(404, 'Build not found');
	return json(build);
};

export const DELETE: RequestHandler = ({ params }) => {
	if (!deleteBuild(params.id)) error(404, 'Build not found');
	return new Response(null, { status: 204 });
};
