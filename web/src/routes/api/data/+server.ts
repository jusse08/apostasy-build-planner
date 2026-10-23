import { createHash } from 'node:crypto';
import { gameModelJson } from '#lib/server/data.ts';
import type { RequestHandler } from './$types';

let etag: string | null = null;

// The whole game model in one response. Revalidated on every load (ETag), so a new image with
// new data is picked up at once while unchanged data costs a 304.
export const GET: RequestHandler = ({ request }) => {
	const json = gameModelJson();
	etag ??= `"${createHash('sha1').update(json).digest('hex').slice(0, 16)}"`;
	const headers = { etag, 'cache-control': 'no-cache' };
	if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });
	return new Response(json, { headers: { ...headers, 'content-type': 'application/json' } });
};
