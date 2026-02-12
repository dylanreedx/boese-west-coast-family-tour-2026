# Phase 14: Embedded Visual Previews — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the disliked DiscoveryLinks (external TikTok/YouTube/Maps pill buttons) with rich, embedded visual content inside ActionCards — hero photos, place details, inline maps, and embedded YouTube videos.

**Architecture:** Expand the Google Places API integration to return full place details (rating, price, address, hours, lat/lng, editorial summary) alongside photos. Build a new `PlaceCard` component that renders a visually rich, native-feeling place preview with hero photo, details strip, photo carousel, expandable map embed, and expandable YouTube video. Wire it into both ActionCard (full) and SharedSuggestionCard (compact). Remove DiscoveryLinks entirely.

**Tech Stack:** SvelteKit + Svelte 5 runes, TanStack Query v6, Google Places API (New), Google Maps Embed API, YouTube Data API v3, Tailwind v4

---

## Prerequisites

Before starting implementation, the following Google Cloud APIs must be enabled on the project that owns `GOOGLE_PLACES_API_KEY`:

- **Places API (New)** — already enabled
- **Maps Embed API** — enable in Google Cloud Console (free, no billing required)
- **YouTube Data API v3** — enable in Google Cloud Console (10,000 units/day free tier; search = 100 units/call = ~100 searches/day)

The same `GOOGLE_PLACES_API_KEY` env var works for all three APIs.

---

## Task 1: Create PlaceDetails type and rich `/api/places/details` endpoint

**Files:**
- Modify: `src/lib/types/app.ts` (add PlaceDetails type)
- Create: `src/routes/api/places/details/+server.ts`

**Step 1: Add PlaceDetails type**

Add to the bottom of `src/lib/types/app.ts`:

```ts
export type PlaceDetails = {
	name: string;
	rating?: number;
	userRatingCount?: number;
	priceLevel?: string;
	formattedAddress?: string;
	openNow?: boolean;
	weekdayHours?: string[];
	location?: { lat: number; lng: number };
	photos: string[];
	websiteUri?: string;
	googleMapsUri?: string;
	editorialSummary?: string;
};
```

**Step 2: Create the details endpoint**

Create `src/routes/api/places/details/+server.ts`:

```ts
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

		cache.set(cacheKey, { details, ts: Date.now() });
		return json({ details });
	} catch (err) {
		console.error('Places details fetch error:', err);
		return json({ details: null });
	}
};
```

**Step 3: Build verification**

Run: `npm run build`
Expected: Clean build with no errors.

**Step 4: Commit**

```bash
git add src/lib/types/app.ts src/routes/api/places/details/+server.ts
git commit -m "feat: add rich PlaceDetails type and /api/places/details endpoint"
```

---

## Task 2: Create YouTube video search endpoint

**Files:**
- Create: `src/routes/api/places/video/+server.ts`

**Step 1: Create the video endpoint**

Create `src/routes/api/places/video/+server.ts`:

```ts
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
```

**Step 2: Build verification**

Run: `npm run build`
Expected: Clean build.

**Step 3: Commit**

```bash
git add src/routes/api/places/video/+server.ts
git commit -m "feat: add YouTube video search endpoint for place previews"
```

---

## Task 3: Create PlaceCard component

> **REQUIRED:** Use the `frontend-design` skill when implementing this task. The PlaceCard must be visually striking, feel native to the app, and avoid generic AI aesthetics.

**Files:**
- Create: `src/lib/components/trip/PlaceCard.svelte`

**Design spec:**

The PlaceCard is a rich, embedded preview card for a place. It replaces both PlacePhotos and DiscoveryLinks. Two variants:

**Full variant** (used in ActionCard):
```
┌─────────────────────────────────────┐
│ [Hero photo - full width, ~160px h] │
│  overlay: ★ 4.2 (128) · $$         │
├─────────────────────────────────────┤
│ Place Name                          │
│ 📍 123 Main St, Phoenix, AZ        │
│ "A beloved local gem..." (summary)  │
├─────────────────────────────────────┤
│ [photo][photo][photo] ← scrollable  │
├─────────────────────────────────────┤
│ [📍 See on Map]  [▶ Watch Video]    │
│ ← tap to expand inline embeds      │
└─────────────────────────────────────┘
```

**Compact variant** (used in SharedSuggestionCard):
```
┌──────────────────────────────────┐
│ [photo thumb 80x60] Place Name   │
│                     ★ 4.2 · $$   │
└──────────────────────────────────┘
```

**Step 1: Create PlaceCard component**

Create `src/lib/components/trip/PlaceCard.svelte`. Key behaviors:
- Props: `title: string`, `locationName?: string`, `compact?: boolean`
- Uses `createQuery` to fetch from `/api/places/details`
- Skeleton loading state matching the card layout
- Hero photo with gradient overlay for rating/price badge
- Photo strip (horizontal scroll, click to expand)
- "See on Map" button → expands to show Google Maps Embed iframe (lazy loaded)
- "Watch Video" button → fetches `/api/places/video`, expands to YouTube iframe (lazy loaded)
- Map iframe: `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodedQuery}`
- YouTube iframe: `https://www.youtube.com/embed/${videoId}`
- Both embeds use `loading="lazy"` and only load on user tap (not on render)
- Compact variant: horizontal layout, thumbnail photo + name/rating only, no embeds
- Graceful degradation: if no details found, show nothing (same as current PlacePhotos behavior)

**Important API notes for the implementing engineer:**
- TanStack Svelte Query v6 with Svelte 5: `createQuery(() => ({...}))` — function form, returns reactive object (NOT a store, no `$` prefix)
- Access data as `query.data` not `$query.data`
- Use `$derived` for computed values from query data
- The Google API key is server-side only. The Maps Embed iframe URL needs the key passed from the server. Add the key to the details endpoint response OR create a separate proxy. Simplest: include `mapsEmbedUrl` in the PlaceDetails response from the server.

**Step 2: Update the details endpoint to include embed URLs**

Modify `src/routes/api/places/details/+server.ts` to include pre-built embed URLs in the response, so the client never needs the API key:

Add to the PlaceDetails type in `app.ts`:
```ts
export type PlaceDetails = {
	// ... existing fields ...
	mapsEmbedUrl?: string;  // pre-built Google Maps Embed iframe src
};
```

In the endpoint, after building `details`, add:
```ts
if (details.location) {
	details.mapsEmbedUrl = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(query)}`;
}
```

**Step 3: Build verification**

Run: `npm run build`
Expected: Clean build.

**Step 4: Manual browser verification**

Start dev server: `npm run dev`
Go to `/guide`, ask the AI to suggest a restaurant. Verify:
- PlaceCard appears (if wired — may need Task 5 first)
- Or test the component in isolation

**Step 5: Commit**

```bash
git add src/lib/components/trip/PlaceCard.svelte src/lib/types/app.ts src/routes/api/places/details/+server.ts
git commit -m "feat: create rich PlaceCard component with photos, map, and video embeds"
```

---

## Task 4: Wire PlaceCard into ActionCard

**Files:**
- Modify: `src/lib/components/trip/ActionCard.svelte`

**Step 1: Replace PlacePhotos + DiscoveryLinks with PlaceCard**

In `ActionCard.svelte`:

1. Remove imports:
```ts
// DELETE these:
import DiscoveryLinks from './DiscoveryLinks.svelte';
import PlacePhotos from './PlacePhotos.svelte';
```

2. Add import:
```ts
import PlaceCard from './PlaceCard.svelte';
```

3. Replace the visual discovery section (lines ~133-139):

**Before:**
```svelte
{#if metadata.action === 'create_activity' && status !== 'dismissed'}
	<div class="border-t {status === 'approved' ? 'border-emerald-200' : 'border-amber-200'} px-3 py-2">
		<PlacePhotos title={metadata.payload.title} locationName={metadata.payload.location_name} />
		<DiscoveryLinks title={metadata.payload.title} locationName={metadata.payload.location_name} />
	</div>
{/if}
```

**After:**
```svelte
{#if metadata.action === 'create_activity' && status !== 'dismissed'}
	<div class="border-t {status === 'approved' ? 'border-emerald-200' : 'border-amber-200'}">
		<PlaceCard title={metadata.payload.title} locationName={metadata.payload.location_name} />
	</div>
{/if}
```

**Step 2: Build verification**

Run: `npm run build`
Expected: Clean build.

**Step 3: Commit**

```bash
git add src/lib/components/trip/ActionCard.svelte
git commit -m "feat: wire PlaceCard into ActionCard, replacing PlacePhotos + DiscoveryLinks"
```

---

## Task 5: Wire compact PlaceCard into SharedSuggestionCard

**Files:**
- Modify: `src/lib/components/family/SharedSuggestionCard.svelte`

**Step 1: Replace DiscoveryLinks with compact PlaceCard**

In `SharedSuggestionCard.svelte`:

1. Replace import:
```ts
// DELETE:
import DiscoveryLinks from '$lib/components/trip/DiscoveryLinks.svelte';
// ADD:
import PlaceCard from '$lib/components/trip/PlaceCard.svelte';
```

2. Replace the discovery links section (lines ~87-91):

**Before:**
```svelte
{#if metadata.action === 'create_activity' && metadata.status !== 'dismissed'}
	<div class="border-t border-indigo-100/60 px-3 py-1.5">
		<DiscoveryLinks title={metadata.payload.title} locationName={metadata.payload.location_name} compact />
	</div>
{/if}
```

**After:**
```svelte
{#if metadata.action === 'create_activity' && metadata.status !== 'dismissed'}
	<div class="border-t border-indigo-100/60">
		<PlaceCard title={metadata.payload.title} locationName={metadata.payload.location_name} compact />
	</div>
{/if}
```

**Step 2: Build verification**

Run: `npm run build`
Expected: Clean build.

**Step 3: Commit**

```bash
git add src/lib/components/family/SharedSuggestionCard.svelte
git commit -m "feat: use compact PlaceCard in SharedSuggestionCard"
```

---

## Task 6: Delete deprecated components

**Files:**
- Delete: `src/lib/components/trip/DiscoveryLinks.svelte`
- Delete: `src/lib/components/trip/PlacePhotos.svelte`
- Delete: `src/routes/api/places/photos/+server.ts`

**Step 1: Verify no remaining imports**

Search the codebase for any remaining references to `DiscoveryLinks`, `PlacePhotos`, or `/api/places/photos`. These should all have been replaced in Tasks 4 and 5. If any remain, update them.

**Step 2: Delete the files**

```bash
rm src/lib/components/trip/DiscoveryLinks.svelte
rm src/lib/components/trip/PlacePhotos.svelte
rm src/routes/api/places/photos/+server.ts
```

**Step 3: Build verification**

Run: `npm run build`
Expected: Clean build with no import errors.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove deprecated DiscoveryLinks, PlacePhotos, and photos endpoint"
```

---

## Task 7: Manual end-to-end verification

**Not a code task — this is a browser testing checklist.**

Start dev server: `npm run dev`

1. **Guide page (`/guide`)**: Ask the AI "What's a good restaurant near the Grand Canyon?"
   - Verify: ActionCard appears with PlaceCard embedded
   - Verify: Hero photo loads, rating/price visible
   - Verify: Photo strip scrolls horizontally
   - Verify: "See on Map" button expands to show Maps embed
   - Verify: "Watch Video" button loads a YouTube video
   - Verify: Approve/Dismiss buttons still work
   - Verify: Share to Family button still works

2. **People page (`/people`)**: Check family chat for any shared suggestions
   - Verify: SharedSuggestionCard shows compact PlaceCard (thumbnail + name + rating)
   - Verify: No DiscoveryLinks pills visible anywhere

3. **Degradation**: Temporarily unset `GOOGLE_PLACES_API_KEY` in `.env`
   - Verify: ActionCards still render without PlaceCard (no errors, graceful empty state)
   - Verify: Build still succeeds

4. **Mobile viewport**: Resize browser to 375px width
   - Verify: PlaceCard is responsive, no horizontal overflow
   - Verify: Map/video embeds fit within card width

---

## Summary of new/modified files

| File | Action |
|------|--------|
| `src/lib/types/app.ts` | Modify — add `PlaceDetails` type |
| `src/routes/api/places/details/+server.ts` | Create — rich place details endpoint |
| `src/routes/api/places/video/+server.ts` | Create — YouTube video search endpoint |
| `src/lib/components/trip/PlaceCard.svelte` | Create — rich place card component |
| `src/lib/components/trip/ActionCard.svelte` | Modify — use PlaceCard |
| `src/lib/components/family/SharedSuggestionCard.svelte` | Modify — use compact PlaceCard |
| `src/lib/components/trip/DiscoveryLinks.svelte` | Delete |
| `src/lib/components/trip/PlacePhotos.svelte` | Delete |
| `src/routes/api/places/photos/+server.ts` | Delete |

## Environment requirements

- `GOOGLE_PLACES_API_KEY` must be set in `.env` (already exists)
- Enable **Maps Embed API** in Google Cloud Console
- Enable **YouTube Data API v3** in Google Cloud Console
- Same API key works for all three services
