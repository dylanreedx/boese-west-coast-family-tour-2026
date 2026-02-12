import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import type { PlaceDetails } from '$lib/types/app';

const cache = new Map<string, { places: PlaceDetails[]; ts: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q');
	if (!query) return json({ places: [] });

	const apiKey = env.GOOGLE_PLACES_API_KEY;
	if (!apiKey) return json({ places: [] });

	const cacheKey = query.toLowerCase().trim();
	const cached = cache.get(cacheKey);
	if (cached && Date.now() - cached.ts < CACHE_TTL) {
		return json({ places: cached.places });
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
			body: JSON.stringify({ textQuery: query, maxResultCount: 3 })
		});

		if (!res.ok) {
			console.error('Places search error:', res.status, await res.text());
			cache.set(cacheKey, { places: [], ts: Date.now() });
			return json({ places: [] });
		}

		const data = await res.json();
		const rawPlaces = data.places ?? [];

		const places: PlaceDetails[] = rawPlaces.map(
			(place: {
				displayName?: { text?: string };
				rating?: number;
				userRatingCount?: number;
				priceLevel?: string;
				formattedAddress?: string;
				regularOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
				location?: { latitude: number; longitude: number };
				photos?: { name: string }[];
				websiteUri?: string;
				googleMapsUri?: string;
				editorialSummary?: { text?: string };
			}) => {
				const photos: string[] = (place.photos ?? [])
					.slice(0, 3)
					.map(
						(p: { name: string }) =>
							`https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=400&maxHeightPx=300&key=${apiKey}`
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
					const placeName = place.displayName?.text ?? query;
					details.mapsEmbedUrl = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(placeName)}`;
				}

				return details;
			}
		);

		cache.set(cacheKey, { places, ts: Date.now() });
		return json({ places });
	} catch (err) {
		console.error('Places search fetch error:', err);
		return json({ places: [] });
	}
};
