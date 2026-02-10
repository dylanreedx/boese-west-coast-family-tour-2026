import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

const cache = new Map<string, { videoId: string | null; ts: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours (videos don't change often)

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q');
	if (!query) return json({ videoId: null });

	const apiKey = env.GOOGLE_PLACES_API_KEY;
	if (!apiKey) return json({ videoId: null });

	const cacheKey = query.toLowerCase().trim();
	const cached = cache.get(cacheKey);
	if (cached && Date.now() - cached.ts < CACHE_TTL) {
		return json({ videoId: cached.videoId });
	}

	try {
		const params = new URLSearchParams({
			part: 'snippet',
			q: `${query} travel guide`,
			type: 'video',
			videoDuration: 'short',
			maxResults: '1',
			key: apiKey
		});

		const res = await fetch(
			`https://www.googleapis.com/youtube/v3/search?${params}`
		);

		if (!res.ok) {
			console.error('YouTube API error:', res.status, await res.text());
			cache.set(cacheKey, { videoId: null, ts: Date.now() });
			return json({ videoId: null });
		}

		const data = await res.json();
		const videoId = data.items?.[0]?.id?.videoId ?? null;

		cache.set(cacheKey, { videoId, ts: Date.now() });
		return json({ videoId });
	} catch (err) {
		console.error('YouTube API fetch error:', err);
		return json({ videoId: null });
	}
};
