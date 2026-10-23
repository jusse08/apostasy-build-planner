import { gameModelJson } from '#lib/server/data.ts';
import type { RequestHandler } from './$types';

// The whole game model in one response; the client fetches it once per session.
export const GET: RequestHandler = () =>
	new Response(gameModelJson(), {
		headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' }
	});
