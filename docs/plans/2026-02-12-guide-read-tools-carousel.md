# Guide Read Tools + Carousel UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `get_day_details` and `search_places` read tools to the AI guide, with rich inline UI (DayDetailCard and PlacesCarousel with quick-add buttons).

**Architecture:** Both tools follow the existing `get_budget_summary` pattern — the AI calls a function, the server fetches data, sends it back as a tool result for a follow-up OpenAI call, then streams both the AI's text AND structured data via SSE for rich frontend rendering. The frontend renders new components inline in assistant message bubbles alongside text.

**Tech Stack:** SvelteKit, Svelte 5 (runes), OpenAI function calling, Google Places API (New), TanStack Query, Tailwind v4

---

## Task 1: Add Places Search API Endpoint

**Files:**
- Create: `src/routes/api/places/search/+server.ts`

**Step 1: Create the search endpoint**

This endpoint wraps Google Places Text Search API to return multiple results (up to 3). It reuses the same API and photo URL pattern as the existing `/api/places/details/+server.ts` but returns an array instead of a single result.

```typescript
// src/routes/api/places/search/+server.ts
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
		const results = data.places ?? [];

		const places: PlaceDetails[] = results.map((place: any) => {
			const photos: string[] = (place.photos ?? [])
				.slice(0, 3)
				.map(
					(p: { name: string }) =>
						`https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=400&maxHeightPx=300&key=${apiKey}`
				);

			return {
				name: place.displayName?.text ?? '',
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
		});

		cache.set(cacheKey, { places, ts: Date.now() });
		return json({ places });
	} catch (err) {
		console.error('Places search fetch error:', err);
		return json({ places: [] });
	}
};
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/routes/api/places/search/+server.ts
git commit -m "feat: add places search API endpoint returning top 3 results"
```

---

## Task 2: Add Tool Definitions + Server-Side Handlers

**Files:**
- Modify: `src/routes/api/chat/+server.ts`

**Step 1: Add `get_day_details` and `search_places` to the TOOLS array**

Add after the existing `get_budget_summary` tool definition (around line 258):

```typescript
{
	type: 'function',
	function: {
		name: 'get_day_details',
		description:
			'Get a detailed view of a specific day\'s itinerary. Use when the user asks to see what\'s planned for a day, wants an overview of a day, or asks "what are we doing on day X?".',
		parameters: {
			type: 'object',
			properties: {
				day_number: {
					type: 'number',
					description: 'The day number (1-8) to show details for'
				}
			},
			required: ['day_number']
		}
	}
},
{
	type: 'function',
	function: {
		name: 'search_places',
		description:
			'Search for restaurants, attractions, or points of interest near a trip destination. Use when the user asks to find, show, or recommend places like "find restaurants near X" or "coffee shops in Y". Returns rich place cards with photos and ratings.',
		parameters: {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description: 'Search query including what to find and where, e.g. "best tacos in Phoenix" or "coffee shops near Grand Canyon South Rim"'
				},
				day_number: {
					type: 'number',
					description: 'The day number (1-8) this search relates to, for adding results to the itinerary. Infer from the location if not explicitly stated.'
				}
			},
			required: ['query']
		}
	}
}
```

**Step 2: Add `fetchDayDetails` helper function**

Add after the existing `fetchBudgetSummary` function (around line 608):

```typescript
async function fetchDayDetails(
	supabase: ReturnType<typeof createServiceClient>,
	dayNumber: number
): Promise<Record<string, unknown> | null> {
	const { data: day } = await supabase
		.from('days')
		.select('day_number, title, date, activities(id, title, start_time, location_name, type, status, cost_estimate, description, sort_order)')
		.eq('trip_id', TRIP_ID)
		.eq('day_number', dayNumber)
		.order('sort_order', { referencedTable: 'activities' })
		.single();

	if (!day) return null;

	const activities = day.activities ?? [];
	const totalCost = activities.reduce((sum: number, a: { cost_estimate: number | null }) => sum + (a.cost_estimate ?? 0), 0);

	return {
		day_number: day.day_number,
		title: day.title,
		date: day.date,
		activities: activities.map((a: any) => ({
			title: a.title,
			type: a.type,
			start_time: a.start_time,
			location_name: a.location_name,
			status: a.status,
			cost_estimate: a.cost_estimate,
			description: a.description
		})),
		activity_count: activities.length,
		total_estimated_cost: totalCost
	};
}
```

**Step 3: Add `fetchPlacesSearch` helper function**

```typescript
async function fetchPlacesSearch(
	query: string
): Promise<Record<string, unknown>> {
	try {
		const baseUrl = 'http://localhost:5173'; // Will be replaced by origin in prod
		const res = await fetch(`${baseUrl}/api/places/search?q=${encodeURIComponent(query)}`);
		if (!res.ok) return { places: [] };
		return await res.json();
	} catch {
		return { places: [] };
	}
}
```

**IMPORTANT:** Actually, calling our own API from the server is unnecessary — we should inline the Google Places call directly. Use the same logic as the search endpoint but call it as a function:

```typescript
import { env } from '$env/dynamic/private';

async function fetchPlacesSearch(query: string): Promise<{ places: PlaceDetails[] }> {
	const apiKey = env.GOOGLE_PLACES_API_KEY;
	if (!apiKey) return { places: [] };

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

		if (!res.ok) return { places: [] };

		const data = await res.json();
		const results = data.places ?? [];

		const places: PlaceDetails[] = results.map((place: any) => {
			const photos: string[] = (place.photos ?? [])
				.slice(0, 3)
				.map(
					(p: { name: string }) =>
						`https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=400&maxHeightPx=300&key=${apiKey}`
				);

			return {
				name: place.displayName?.text ?? '',
				rating: place.rating,
				userRatingCount: place.userRatingCount,
				priceLevel: place.priceLevel,
				formattedAddress: place.formattedAddress,
				openNow: place.regularOpeningHours?.openNow,
				location: place.location
					? { lat: place.location.latitude, lng: place.location.longitude }
					: undefined,
				photos,
				websiteUri: place.websiteUri,
				googleMapsUri: place.googleMapsUri,
				editorialSummary: place.editorialSummary?.text
			};
		});

		return { places };
	} catch {
		return { places: [] };
	}
}
```

**Step 4: Handle the new read tools in the stream handler**

In the `choice.finish_reason === 'tool_calls'` block (around line 734), expand the `if (toolCall.name === 'get_budget_summary')` to handle all three read tools:

```typescript
if (toolCall.name === 'get_budget_summary') {
	// existing budget logic (unchanged)
	// ...
} else if (toolCall.name === 'get_day_details') {
	const dayData = await fetchDayDetails(supabase, parsedArgs.day_number as number);
	const followUpMessages: OpenAI.ChatCompletionMessageParam[] = [
		...messages,
		{ role: 'assistant', content: null, tool_calls: [{ id: toolCall.id, type: 'function', function: { name: 'get_day_details', arguments: toolCall.args } }] },
		{ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(dayData ?? { error: 'Day not found' }) }
	];
	const followUp = await openai.chat.completions.create({
		model: 'gpt-4.1-mini',
		messages: followUpMessages,
		stream: true,
		max_tokens: 1000,
		temperature: 0.8
	});
	for await (const chunk of followUp) {
		const c = chunk.choices[0];
		if (c?.delta?.content) {
			fullResponse += c.delta.content;
			controller.enqueue(
				encoder.encode(`data: ${JSON.stringify({ delta: c.delta.content })}\n\n`)
			);
		}
	}
	// Send dayCard data for rich UI
	if (dayData) {
		controller.enqueue(
			encoder.encode(`data: ${JSON.stringify({ dayCard: dayData })}\n\n`)
		);
	}
} else if (toolCall.name === 'search_places') {
	const placesData = await fetchPlacesSearch(parsedArgs.query as string);
	const dayNumber = parsedArgs.day_number as number | undefined;
	const followUpMessages: OpenAI.ChatCompletionMessageParam[] = [
		...messages,
		{ role: 'assistant', content: null, tool_calls: [{ id: toolCall.id, type: 'function', function: { name: 'search_places', arguments: toolCall.args } }] },
		{ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(placesData) }
	];
	const followUp = await openai.chat.completions.create({
		model: 'gpt-4.1-mini',
		messages: followUpMessages,
		stream: true,
		max_tokens: 1000,
		temperature: 0.8
	});
	for await (const chunk of followUp) {
		const c = chunk.choices[0];
		if (c?.delta?.content) {
			fullResponse += c.delta.content;
			controller.enqueue(
				encoder.encode(`data: ${JSON.stringify({ delta: c.delta.content })}\n\n`)
			);
		}
	}
	// Send places data for carousel UI
	if (placesData.places.length > 0) {
		controller.enqueue(
			encoder.encode(`data: ${JSON.stringify({ places: placesData.places, placesContext: { day_number: dayNumber } })}\n\n`)
		);
	}
} else {
	// Existing write tool logic (ActionCard)
	// ...
}
```

**Step 5: Update system prompt**

Add to the SYSTEM_PROMPT (around line 39, before the closing backtick):

```
When the user asks what's planned for a specific day, use get_day_details to show them a visual overview. When they ask to find or search for places, restaurants, or attractions, use search_places to show them results with photos and ratings.
```

**Step 6: Update metadata saving to include rich data**

When saving the assistant message to DB, also save dayCard/places data so it can be rendered on page reload. Modify the metadata save block to include these:

```typescript
// After the stream ends, build metadata for DB save
let richData: Record<string, unknown> | null = null;
// (set richData = { dayCard: dayData } or { places: placesData.places, placesContext } during tool handling)

await supabase.from('chat_messages').insert({
	trip_id: TRIP_ID,
	user_id: user.id,
	role: 'assistant',
	content: fullResponse,
	...(metadata ? { metadata: metadata as unknown as Record<string, unknown> } : {}),
	...(richData ? { metadata: { ...(metadata ?? {}), ...richData } as unknown as Record<string, unknown> } : {})
});
```

**Step 7: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 8: Commit**

```bash
git add src/routes/api/chat/+server.ts
git commit -m "feat: add get_day_details and search_places read tools to AI guide"
```

---

## Task 3: Create DayDetailCard Component

**Files:**
- Create: `src/lib/components/trip/DayDetailCard.svelte`

**Step 1: Create the component**

This renders an inline visual card showing a day's itinerary inside a chat message bubble. Purely informational — no approve/dismiss.

```svelte
<script lang="ts">
	import { ACTIVITY_ICONS } from '$lib/utils/activity-icons';
	import { STATUS_COLORS, STATUS_LABELS } from '$lib/utils/activity-icons';
	import { getDayColor } from '$lib/utils/map-colors';
	import type { ActivityType, ActivityStatus } from '$lib/types/app';

	type DayActivity = {
		title: string;
		type: ActivityType | null;
		start_time: string | null;
		location_name: string | null;
		status: ActivityStatus | null;
		cost_estimate: number | null;
		description: string | null;
	};

	type DayData = {
		day_number: number;
		title: string | null;
		date: string;
		activities: DayActivity[];
		activity_count: number;
		total_estimated_cost: number;
	};

	let { data }: { data: DayData } = $props();

	const dayColor = $derived(getDayColor(data.day_number));

	const DAY_LOCATIONS: Record<number, string> = {
		1: 'Detroit to Phoenix',
		2: 'Phoenix',
		3: 'Grand Canyon',
		4: 'Grand Canyon to Las Vegas',
		5: 'Death Valley',
		6: 'San Francisco',
		7: 'Santa Monica / LA',
		8: 'Joshua Tree to Home'
	};
</script>

<div class="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
	<!-- Day header with color accent -->
	<div class="flex items-center gap-3 px-3 py-2.5" style="background: linear-gradient(135deg, {dayColor}12, {dayColor}06)">
		<div
			class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
			style="background-color: {dayColor}"
		>
			{data.day_number}
		</div>
		<div class="min-w-0 flex-1">
			<p class="text-sm font-bold text-slate-800">
				{data.title ?? DAY_LOCATIONS[data.day_number] ?? `Day ${data.day_number}`}
			</p>
			<p class="text-[11px] text-slate-400">{data.date}</p>
		</div>
		{#if data.total_estimated_cost > 0}
			<span class="flex-shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200/60">
				~${data.total_estimated_cost}
			</span>
		{/if}
	</div>

	<!-- Activities list -->
	{#if data.activities.length > 0}
		<div class="divide-y divide-slate-100">
			{#each data.activities as activity, i}
				{@const icon = ACTIVITY_ICONS[activity.type ?? 'other']}
				{@const statusStyle = activity.status ? STATUS_COLORS[activity.status] : null}
				<div class="flex items-center gap-2.5 px-3 py-2">
					<span class="text-sm">{icon}</span>
					<div class="min-w-0 flex-1">
						<p class="truncate text-[13px] font-medium text-slate-700">{activity.title}</p>
						<div class="flex items-center gap-1.5 text-[10px] text-slate-400">
							{#if activity.start_time}
								<span>{activity.start_time}</span>
							{/if}
							{#if activity.location_name}
								<span class="truncate">{activity.location_name}</span>
							{/if}
						</div>
					</div>
					<div class="flex flex-shrink-0 items-center gap-1.5">
						{#if activity.cost_estimate}
							<span class="text-[10px] font-medium text-emerald-600">${activity.cost_estimate}</span>
						{/if}
						{#if statusStyle && activity.status !== 'confirmed'}
							<span class="rounded-full px-1.5 py-0.5 text-[9px] font-medium {statusStyle.bg} {statusStyle.text}">
								{STATUS_LABELS[activity.status!]}
							</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="px-3 py-4 text-center text-xs text-slate-400">
			No activities planned yet
		</div>
	{/if}

	<!-- Footer summary -->
	<div class="flex items-center justify-between border-t border-slate-100 px-3 py-1.5">
		<span class="text-[10px] text-slate-400">
			{data.activity_count} {data.activity_count === 1 ? 'activity' : 'activities'}
		</span>
		<a
			href="/day/{data.day_number}"
			class="text-[10px] font-medium text-primary-600 hover:text-primary-700"
		>
			View full day &rarr;
		</a>
	</div>
</div>
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/lib/components/trip/DayDetailCard.svelte
git commit -m "feat: add DayDetailCard component for inline day view in guide chat"
```

---

## Task 4: Create PlacesCarousel Component

**Files:**
- Create: `src/lib/components/trip/PlacesCarousel.svelte`

**Step 1: Create the component**

Horizontal snap-scroll carousel of up to 3 PlaceDetails cards, each with photo, rating, and "Add to Day X" button.

```svelte
<script lang="ts">
	import type { PlaceDetails, ActionMetadata, ActivityType } from '$lib/types/app';

	let {
		places,
		dayNumber,
		onQuickAdd
	}: {
		places: PlaceDetails[];
		dayNumber?: number;
		onQuickAdd?: (metadata: ActionMetadata) => void;
	} = $props();

	let scrollContainer: HTMLDivElement | undefined = $state();
	let activeIndex = $state(0);

	function handleScroll() {
		if (!scrollContainer) return;
		const scrollLeft = scrollContainer.scrollLeft;
		const cardWidth = scrollContainer.offsetWidth * 0.82;
		activeIndex = Math.round(scrollLeft / cardWidth);
	}

	function scrollTo(index: number) {
		if (!scrollContainer) return;
		const cardWidth = scrollContainer.offsetWidth * 0.82;
		scrollContainer.scrollTo({ left: index * cardWidth, behavior: 'smooth' });
	}

	function inferType(place: PlaceDetails): ActivityType {
		const name = (place.name + ' ' + (place.editorialSummary ?? '')).toLowerCase();
		if (name.match(/restaurant|cafe|coffee|bar|grill|pizza|taco|sushi|diner|bakery|bistro/)) return 'restaurant';
		if (name.match(/hotel|motel|inn|lodge|resort/)) return 'hotel';
		if (name.match(/shop|store|market|mall|boutique/)) return 'shopping';
		if (name.match(/trail|hike|park|canyon|viewpoint|overlook/)) return 'sightseeing';
		return 'activity';
	}

	function handleQuickAdd(place: PlaceDetails) {
		if (!onQuickAdd || !dayNumber) return;
		const metadata: ActionMetadata = {
			action: 'create_activity',
			status: 'pending',
			payload: {
				day_number: dayNumber,
				title: place.name,
				type: inferType(place),
				location_name: place.formattedAddress,
				description: place.editorialSummary
			}
		};
		onQuickAdd(metadata);
	}

	const PRICE_LABELS: Record<string, string> = {
		'PRICE_LEVEL_FREE': 'Free',
		'PRICE_LEVEL_INEXPENSIVE': '$',
		'PRICE_LEVEL_MODERATE': '$$',
		'PRICE_LEVEL_EXPENSIVE': '$$$',
		'PRICE_LEVEL_VERY_EXPENSIVE': '$$$$'
	};
</script>

<div class="mt-3">
	<!-- Carousel -->
	<div
		bind:this={scrollContainer}
		onscroll={handleScroll}
		class="carousel-scroll flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-2"
	>
		{#each places as place, i}
			<div class="w-[82%] flex-shrink-0 snap-start overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
				<!-- Photo -->
				{#if place.photos[0]}
					<div class="relative h-[120px] w-full overflow-hidden">
						<img
							src={place.photos[0]}
							alt={place.name}
							class="h-full w-full object-cover"
							loading="lazy"
						/>
						<div class="absolute inset-0" style="background: linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.4) 100%)"></div>
						<!-- Badges on photo -->
						<div class="absolute bottom-0 left-0 right-0 flex items-end justify-between p-2">
							<div class="flex items-center gap-1.5">
								{#if place.rating}
									<span class="inline-flex items-center gap-0.5 rounded-full bg-black/40 px-1.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
										<svg class="h-2.5 w-2.5 fill-amber-400" viewBox="0 0 20 20">
											<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
										</svg>
										{place.rating.toFixed(1)}
									</span>
								{/if}
								{#if place.priceLevel && PRICE_LABELS[place.priceLevel]}
									<span class="rounded-full bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300 backdrop-blur-sm">
										{PRICE_LABELS[place.priceLevel]}
									</span>
								{/if}
							</div>
							{#if place.openNow !== undefined}
								<span class="rounded-full px-1.5 py-0.5 text-[9px] font-medium backdrop-blur-sm {place.openNow ? 'bg-emerald-500/30 text-emerald-200' : 'bg-red-500/30 text-red-200'}">
									{place.openNow ? 'Open' : 'Closed'}
								</span>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Details -->
				<div class="p-2.5">
					<h4 class="text-[13px] font-bold leading-tight text-slate-800">{place.name}</h4>
					{#if place.formattedAddress}
						<p class="mt-0.5 truncate text-[10px] text-slate-400">{place.formattedAddress}</p>
					{/if}
					{#if place.editorialSummary}
						<p class="mt-1 text-[11px] leading-relaxed text-slate-500 line-clamp-2">{place.editorialSummary}</p>
					{/if}
				</div>

				<!-- Quick-add button -->
				{#if dayNumber && onQuickAdd}
					<div class="border-t border-slate-100 px-2.5 py-2">
						<button
							onclick={() => handleQuickAdd(place)}
							class="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary-50 py-1.5 text-xs font-semibold text-primary-700 transition-all hover:bg-primary-100 active:scale-[0.97]"
						>
							<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
							</svg>
							Add to Day {dayNumber}
						</button>
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Dot indicators -->
	{#if places.length > 1}
		<div class="flex justify-center gap-1.5 pt-1">
			{#each places as _, i}
				<button
					onclick={() => scrollTo(i)}
					class="h-1.5 rounded-full transition-all {activeIndex === i ? 'w-4 bg-primary-500' : 'w-1.5 bg-slate-300'}"
				></button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.carousel-scroll::-webkit-scrollbar {
		display: none;
	}
	.carousel-scroll {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
</style>
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/lib/components/trip/PlacesCarousel.svelte
git commit -m "feat: add PlacesCarousel component with snap-scroll and quick-add buttons"
```

---

## Task 5: Wire Up ChatInterface to Render New Components

**Files:**
- Modify: `src/lib/components/trip/ChatInterface.svelte`

**Step 1: Add imports**

Add at the top of the script block, alongside existing imports:

```typescript
import DayDetailCard from '$lib/components/trip/DayDetailCard.svelte';
import PlacesCarousel from '$lib/components/trip/PlacesCarousel.svelte';
```

**Step 2: Add streaming state variables**

After `let streamingAction = $state<ActionMetadata | null>(null);` (around line 39), add:

```typescript
let streamingDayCard = $state<Record<string, unknown> | null>(null);
let streamingPlaces = $state<{ places: PlaceDetails[]; dayNumber?: number } | null>(null);
```

Also add the import for PlaceDetails at the top:

```typescript
import type { ChatMessage, ActionMetadata, FamilyFeedback, PlaceDetails } from '$lib/types/app';
```

**Step 3: Parse new SSE event types**

In the stream reading loop (around line 157-165), expand the parsed data handling:

```typescript
if (parsed.delta) {
	streamingContent += parsed.delta;
}
if (parsed.action) {
	streamingAction = parsed.action as ActionMetadata;
}
if (parsed.dayCard) {
	streamingDayCard = parsed.dayCard;
}
if (parsed.places) {
	streamingPlaces = {
		places: parsed.places as PlaceDetails[],
		dayNumber: parsed.placesContext?.day_number
	};
}
```

**Step 4: Include rich data in the streaming message**

Update the `allMessages` derived (around line 63-76) to include the new data:

```typescript
const allMessages = $derived([
	...(messagesQuery.data ?? []),
	...(isStreaming && (streamingContent || streamingAction || streamingDayCard || streamingPlaces)
		? [{
			id: 'streaming',
			role: 'assistant',
			content: streamingContent,
			created_at: new Date().toISOString(),
			trip_id: TRIP_ID,
			user_id: null,
			metadata: {
				...(streamingAction ? streamingAction : {}),
				...(streamingDayCard ? { day_data: streamingDayCard } : {}),
				...(streamingPlaces ? { places_data: streamingPlaces.places, places_context: { day_number: streamingPlaces.dayNumber } } : {})
			}
		} satisfies ChatMessage & { metadata: Record<string, unknown> | null }]
		: [])
]);
```

**Step 5: Reset new state in sendMessage**

At start of `sendMessage` (around line 107):

```typescript
streamingDayCard = null;
streamingPlaces = null;
```

In the `finally` block (around line 183):

```typescript
streamingDayCard = null;
streamingPlaces = null;
```

**Step 6: Render DayDetailCard and PlacesCarousel in message bubbles**

In the message rendering loop, after the existing ActionCard rendering (around line 431-439), add:

```svelte
{#if msg.metadata?.day_data}
	<DayDetailCard data={msg.metadata.day_data} />
{/if}
{#if msg.metadata?.places_data?.length > 0}
	<PlacesCarousel
		places={msg.metadata.places_data}
		dayNumber={msg.metadata.places_context?.day_number}
		onQuickAdd={handlePlacesQuickAdd}
	/>
{/if}
```

**Step 7: Add the quick-add handler**

Add a new function for handling quick-add from carousel cards:

```typescript
async function handlePlacesQuickAdd(metadata: ActionMetadata) {
	if (!userId) return;
	// Save a synthetic assistant message with this action metadata
	const description = `I'd like to add **${(metadata as any).payload.title}** to Day ${(metadata as any).payload.day_number}. Shall I go ahead?`;
	const { data: msg, error } = await supabase
		.from('chat_messages')
		.insert({
			trip_id: TRIP_ID,
			user_id: userId,
			role: 'assistant',
			content: description,
			metadata: metadata as unknown as Record<string, unknown>
		})
		.select('id')
		.single();

	if (error || !msg) {
		addToast('Failed to prepare action');
		return;
	}

	// Refresh to show the new message with ActionCard
	await queryClient.invalidateQueries({ queryKey: ['chat-messages', TRIP_ID, userId] });
}
```

**Step 8: Update getMessageMetadata to handle combined metadata**

The existing `getMessageMetadata` function should still work because it checks for `m.action && m.status`. The `day_data` and `places_data` keys won't interfere. But add a helper for extracting rich data:

```typescript
function getMessageDayCard(msg: ChatMessage & { metadata?: unknown }): Record<string, unknown> | null {
	if (!msg.metadata) return null;
	const m = msg.metadata as Record<string, unknown>;
	return (m.day_data as Record<string, unknown>) ?? null;
}

function getMessagePlaces(msg: ChatMessage & { metadata?: unknown }): { places: PlaceDetails[]; dayNumber?: number } | null {
	if (!msg.metadata) return null;
	const m = msg.metadata as Record<string, unknown>;
	const places = m.places_data as PlaceDetails[] | undefined;
	if (!places || places.length === 0) return null;
	const ctx = m.places_context as { day_number?: number } | undefined;
	return { places, dayNumber: ctx?.day_number };
}
```

Then in the template:

```svelte
{@const dayCard = getMessageDayCard(msg)}
{@const placesData = getMessagePlaces(msg)}

{#if dayCard}
	<DayDetailCard data={dayCard} />
{/if}
{#if placesData}
	<PlacesCarousel
		places={placesData.places}
		dayNumber={placesData.dayNumber}
		onQuickAdd={handlePlacesQuickAdd}
	/>
{/if}
```

**Step 9: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 10: Commit**

```bash
git add src/lib/components/trip/ChatInterface.svelte
git commit -m "feat: wire DayDetailCard and PlacesCarousel into guide chat UI"
```

---

## Task 6: Manual E2E Verification

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Test get_day_details**

Navigate to `/guide` and try:
- "What are we doing on day 3?"
- "Show me our Vegas plan"

Expected: AI responds with text AND a DayDetailCard renders inline showing activities with icons, times, costs, status badges. The "View full day" link should navigate to `/day/3`.

**Step 3: Test search_places**

Try:
- "Find me some good restaurants near the Grand Canyon"
- "Best tacos in Phoenix"

Expected: AI responds with text AND a PlacesCarousel renders with up to 3 cards. Each card shows photo, rating, price, address. "Add to Day X" button is visible.

**Step 4: Test quick-add flow**

Click "Add to Day 3" on a carousel card.

Expected: A new message appears in chat with an ActionCard (create_activity) in pending state. Approve/dismiss buttons work.

**Step 5: Test page reload persistence**

After getting a day details or places response, reload the page.

Expected: The DayDetailCard and PlacesCarousel render from saved metadata in DB.

**Step 6: Final build check**

Run: `npm run build`
Expected: Build succeeds with no type errors

**Step 7: Commit any fixes**

If any tweaks were needed during testing:

```bash
git add -A
git commit -m "fix: polish day details and places carousel from E2E testing"
```
