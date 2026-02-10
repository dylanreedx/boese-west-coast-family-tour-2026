import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import type { PlaceDetails } from '$lib/types/app';

const cache = new Map<string, { details: PlaceDetails | null; ts: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q');
	if (!query) return json({ details: null });

	const apiKey = env.GOOGLE_PLACES_API_KEY;
	if (!apiKey) return json({ details: null });

	const cacheKey = query.toLowerCase().trim();
	const cached = cache.get(cacheKey);
	if (cached && Date.now() - cached.ts < CACHE_TTL) {
		return json({ details: cached.details });
	}

	try {
		const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Goog-Api-Key': apiKey,
				'X-Goog-FieldMask':
					'places.displayName,places.rating,places.userRatingCount,places.priceLevel,places.formattedAddress,places.regularOpeningHours,places.location,places.photos,places.websiteUri,places.googleMapsUri,places.editorialSummary'
			},
			body: JSON.stringify({ textQuery: query, maxResultCount: 1 })
		});

		if (!res.ok) {
			console.error('Places details error:', res.status, await res.text());
			cache.set(cacheKey, { details: null, ts: Date.now() });
			return json({ details: null });
		}

		const data = await res.json();
		const place = data.places?.[0];
		if (!place) {
			cache.set(cacheKey, { details: null, ts: Date.now() });
			return json({ details: null });
		}

		const photos: string[] = (place.photos ?? [])
			.slice(0, 5)
			.map(
				(p: { name: string }) =>
					`https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=600&maxHeightPx=400&key=${apiKey}`
			);

		const details: PlaceDetails = {
			name: place.displayName?.text ?? query,
			rating: place.rating,
			userRatingCount: place.userRatingCount,
			priceLevel: place.priceLevel,
			formattedAddress: place.formattedAddress,
			openNow: place.regularOpeningHours?.openNow,
			weekdayHours: place.regularOpeningHours?.weekdayDescriptions,
			location: place.location
				? { lat: place.location.latitude, lng: place.location.longitude }
				: undefined,
			photos,
			websiteUri: place.websiteUri,
			googleMapsUri: place.googleMapsUri,
			editorialSummary: place.editorialSummary?.text
		};

		if (details.location) {
			details.mapsEmbedUrl = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(query)}`;
		}

		cache.set(cacheKey, { details, ts: Date.now() });
		return json({ details });
	} catch (err) {
		console.error('Places details fetch error:', err);
		return json({ details: null });
	}
};
