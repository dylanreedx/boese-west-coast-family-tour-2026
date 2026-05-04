# Place Picker + First-Class Places Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Google Places a first-class part of activities with a map-based place picker, deterministic PlaceCard lookups, and full AI tool pipeline integration.

**Architecture:** Add `google_place_id` column to activities. Build a full-screen MapLibre place picker overlay with category chips. Update all data paths (editor, AI tools, action handler, PlacesCarousel) to persist place data. PlaceCard uses stored `google_place_id` for exact lookups.

**Tech Stack:** SvelteKit, Svelte 5 (runes), Tailwind v4, MapLibre GL, TanStack Query v6, Supabase, OpenAI gpt-4.1-mini

---

### Task 1: Database Migration + Type Regeneration

**Files:**
- DDL via Supabase `apply_migration`
- Modify: `src/lib/types/database.ts:17-95` (activities Row/Insert/Update)

**Step 1: Apply migration**

Use the Supabase MCP `apply_migration` tool:
```sql
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS google_place_id text;
CREATE INDEX IF NOT EXISTS idx_activities_google_place_id ON public.activities(google_place_id) WHERE google_place_id IS NOT NULL;
```
Name: `add_google_place_id_to_activities`

**Step 2: Regenerate TypeScript types**

Use the Supabase MCP `generate_typescript_types` tool. Take the output and update `src/lib/types/database.ts`. The `activities` Row/Insert/Update should now include `google_place_id: string | null` (Row), `google_place_id?: string | null` (Insert/Update).

**Step 3: Verify build**

Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/types/database.ts
git commit -m "feat: add google_place_id column to activities table"
```

---

### Task 2: Update App Types (PlaceDetails + ActionMetadata)

**Files:**
- Modify: `src/lib/types/app.ts:67-164` (ActionMetadata) and `src/lib/types/app.ts:171-185` (PlaceDetails)

**Step 1: Add `googlePlaceId` to PlaceDetails**

In `src/lib/types/app.ts`, find the `PlaceDetails` type (line 171) and add `googlePlaceId` as the first field:

```typescript
export type PlaceDetails = {
	googlePlaceId?: string;
	name: string;
	rating?: number;
	// ... rest unchanged
};
```

**Step 2: Add place fields to `create_activity` ActionMetadata payload**

In the `create_activity` variant (lines 68-81), add 5 optional fields after `cost_estimate`:

```typescript
| {
		action: 'create_activity';
		status: ActionStatus;
		payload: {
			day_number: number;
			title: string;
			type: ActivityType;
			start_time?: string;
			location_name?: string;
			description?: string;
			cost_estimate?: number;
			google_place_id?: string;
			latitude?: number;
			longitude?: number;
			location_address?: string;
			image_url?: string;
		};
		result_id?: string;
  }
```

**Step 3: Add same fields to `replace_activity` payload**

In the `replace_activity` variant (lines 99-113), add the same 5 fields after `cost_estimate`:

```typescript
| {
		action: 'replace_activity';
		status: ActionStatus;
		payload: {
			day_number: number;
			old_title: string;
			new_title: string;
			new_type: ActivityType;
			start_time?: string;
			location_name?: string;
			description?: string;
			cost_estimate?: number;
			google_place_id?: string;
			latitude?: number;
			longitude?: number;
			location_address?: string;
			image_url?: string;
		};
		result_id?: string;
  }
```

**Step 4: Add place fields to `update_activity` updates**

In the `update_activity` variant (lines 123-139), add inside `updates`:

```typescript
updates: {
	start_time?: string;
	cost_estimate?: number;
	status?: ActivityStatus;
	description?: string;
	location_name?: string;
	title?: string;
	google_place_id?: string;
	latitude?: number;
	longitude?: number;
	location_address?: string;
	image_url?: string;
};
```

**Step 5: Verify build**

Run: `npm run build`
Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/types/app.ts
git commit -m "feat: add googlePlaceId to PlaceDetails and place fields to ActionMetadata"
```

---

### Task 3: Update Google Places API Endpoints

**Files:**
- Modify: `src/routes/api/places/details/+server.ts:28-69`
- Modify: `src/routes/api/places/search/+server.ts:28-87`
- Modify: `src/routes/api/chat/+server.ts:692-731`

**Step 1: Update `/api/places/details` — add `places.id` to FieldMask and `placeId` lookup mode**

In `src/routes/api/places/details/+server.ts`:

a) Add `placeId` query param support at the top of the handler (after line 10):
```typescript
const placeId = url.searchParams.get('placeId');
const query = url.searchParams.get('q');
if (!placeId && !query) return json({ details: null });
```

b) Update the FieldMask (line 29) to include `places.id`:
```
'places.id,places.displayName,places.rating,places.userRatingCount,places.priceLevel,places.formattedAddress,places.regularOpeningHours,places.location,places.photos,places.websiteUri,places.googleMapsUri,places.editorialSummary'
```

c) Add a branch for placeId lookup before the existing searchText call. When `placeId` is provided, use a GET request to `https://places.googleapis.com/v1/places/{placeId}` instead of POST to `searchText`:
```typescript
if (placeId) {
	const cacheKey = `pid:${placeId}`;
	const cached = cache.get(cacheKey);
	if (cached && Date.now() - cached.ts < CACHE_TTL) {
		return json({ details: cached.details });
	}

	try {
		const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
			headers: {
				'X-Goog-Api-Key': apiKey,
				'X-Goog-FieldMask':
					'id,displayName,rating,userRatingCount,priceLevel,formattedAddress,regularOpeningHours,location,photos,websiteUri,googleMapsUri,editorialSummary'
			}
		});

		if (!res.ok) {
			cache.set(cacheKey, { details: null, ts: Date.now() });
			return json({ details: null });
		}

		const place = await res.json();
		// Same mapping logic as searchText but for a single place object
		const photos: string[] = (place.photos ?? [])
			.slice(0, 5)
			.map((p: { name: string }) =>
				`https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=600&maxHeightPx=400&key=${apiKey}`
			);

		const details: PlaceDetails = {
			googlePlaceId: place.id,
			name: place.displayName?.text ?? placeId,
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
			details.mapsEmbedUrl = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(details.name)}`;
		}

		cache.set(cacheKey, { details, ts: Date.now() });
		return json({ details });
	} catch (err) {
		console.error('Places placeId fetch error:', err);
		return json({ details: null });
	}
}
```

d) In the existing searchText mapping (line 54), add `googlePlaceId: place.id`:
```typescript
const details: PlaceDetails = {
	googlePlaceId: place.id,
	name: place.displayName?.text ?? query,
	// ... rest unchanged
};
```

**Step 2: Update `/api/places/search` — add `places.id` to FieldMask**

In `src/routes/api/places/search/+server.ts`:

a) Update FieldMask (line 29) to include `places.id`:
```
'places.id,places.displayName,...'
```

b) In the mapping (line 64-79), add `googlePlaceId: place.id`:
```typescript
const details: PlaceDetails = {
	googlePlaceId: place.id,
	name: place.displayName?.text ?? query,
	// ... rest unchanged
};
```

**Step 3: Update `fetchPlacesSearch` in chat server — add `places.id`**

In `src/routes/api/chat/+server.ts`, function `fetchPlacesSearch` (~line 692):

a) Update FieldMask (line 698) to include `places.id`

b) In the result mapping (line 716-730), add `googlePlaceId: place.id`:
```typescript
return {
	googlePlaceId: place.id,
	name: place.displayName?.text ?? '',
	// ... rest unchanged
};
```

**Step 4: Verify build**

Run: `npm run build`
Expected: PASS

**Step 5: Commit**

```bash
git add src/routes/api/places/details/+server.ts src/routes/api/places/search/+server.ts src/routes/api/chat/+server.ts
git commit -m "feat: return googlePlaceId from all Places endpoints, add placeId lookup mode"
```

---

### Task 4: Fix BottomSheet Mobile Overflow

**Files:**
- Modify: `src/lib/components/ui/BottomSheet.svelte:51,74`

**Step 1: Add `overflow-hidden` to sheet panel**

On line 51, add `overflow-hidden` to the sheet panel div class:
```
class="absolute bottom-0 left-0 right-0 flex max-h-[90dvh] flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl md:relative md:bottom-auto md:left-auto md:right-auto md:w-full md:max-w-lg md:max-h-[85vh] md:rounded-2xl"
```

**Step 2: Add `overflow-x-hidden` to scrollable content**

On line 74, add `overflow-x-hidden`:
```
class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-8"
```

**Step 3: Verify build**

Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/components/ui/BottomSheet.svelte
git commit -m "fix: prevent horizontal overflow in BottomSheet on mobile"
```

---

### Task 5: Update PlaceCard for Deterministic Lookup

**Files:**
- Modify: `src/lib/components/trip/PlaceCard.svelte:6-38`

**Step 1: Add `googlePlaceId` prop**

Add to the props destructuring (line 6-20):
```typescript
let {
	title,
	locationName,
	googlePlaceId,
	defaultExpanded = false,
	mapActivities,
	currentActivityId,
	dayNumber
}: {
	title: string;
	locationName?: string;
	googlePlaceId?: string;
	defaultExpanded?: boolean;
	mapActivities?: Array<{ id: string; title: string; latitude: number | null; longitude: number | null; sort_order: number }>;
	currentActivityId?: string;
	dayNumber?: number;
} = $props();
```

**Step 2: Update query to use `googlePlaceId` when available**

Replace the `detailsQuery` (lines 28-38):
```typescript
const detailsQuery = createQuery(() => ({
	queryKey: googlePlaceId
		? ['place-details-by-id', googlePlaceId]
		: ['place-details', searchQuery],
	enabled: !!(googlePlaceId || searchQuery),
	staleTime: 1000 * 60 * 30,
	queryFn: async () => {
		const url = googlePlaceId
			? `/api/places/details?placeId=${encodeURIComponent(googlePlaceId)}`
			: `/api/places/details?q=${encodeURIComponent(searchQuery)}`;
		const res = await fetch(url);
		if (!res.ok) return null;
		const data = await res.json();
		return data.details as PlaceDetails | null;
	}
}));
```

**Step 3: Verify build**

Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/components/trip/PlaceCard.svelte
git commit -m "feat: PlaceCard uses googlePlaceId for deterministic lookup"
```

---

### Task 6: Update ActivityItem to Pass Place Data

**Files:**
- Modify: `src/lib/components/trip/ActivityItem.svelte:119-131`

**Step 1: Update PlaceCard condition and props**

Replace lines 119-132:
```svelte
{#if !isDrive && (activity.location_name || activity.google_place_id)}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="mt-2" onclick={(e) => e.stopPropagation()}>
		<PlaceCard
			title={activity.title}
			locationName={activity.location_name}
			googlePlaceId={activity.google_place_id}
			mapActivities={allActivities}
			currentActivityId={activity.id}
			{dayNumber}
			defaultExpanded={false}
		/>
	</div>
{/if}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/components/trip/ActivityItem.svelte
git commit -m "feat: ActivityItem passes google_place_id to PlaceCard"
```

---

### Task 7: Build PlacePicker Component

**Files:**
- Create: `src/lib/components/trip/PlacePicker.svelte`

**Step 1: Create the PlacePicker component**

Use the `frontend-design` skill to create `src/lib/components/trip/PlacePicker.svelte`. This is the most design-intensive component. Key requirements:

**Props:**
```typescript
let {
	open = $bindable(false),
	dayNumber,
	onSelect
}: {
	open: boolean;
	dayNumber: number;
	onSelect: (place: PlaceDetails) => void;
} = $props();
```

**DAY_CENTERS constant** (static, trip-specific):
```typescript
const DAY_CENTERS: Record<number, { lat: number; lng: number; name: string }> = {
	1: { lat: 33.4484, lng: -112.0740, name: 'Phoenix' },
	2: { lat: 33.4484, lng: -112.0740, name: 'Phoenix' },
	3: { lat: 36.0544, lng: -112.1401, name: 'Grand Canyon' },
	4: { lat: 36.1699, lng: -115.1398, name: 'Las Vegas' },
	5: { lat: 36.5323, lng: -116.9325, name: 'Death Valley' },
	6: { lat: 37.7749, lng: -122.4194, name: 'San Francisco' },
	7: { lat: 34.0195, lng: -118.4912, name: 'Santa Monica' },
	8: { lat: 33.8734, lng: -115.9010, name: 'Joshua Tree' }
};
```

**Category chips:**
```typescript
const CATEGORIES = [
	{ key: 'eat', emoji: '🍽️', label: 'Eat', query: 'restaurants' },
	{ key: 'see', emoji: '👀', label: 'See', query: 'sightseeing attractions' },
	{ key: 'do', emoji: '🎯', label: 'Do', query: 'activities things to do' },
	{ key: 'stay', emoji: '🏨', label: 'Stay', query: 'hotels lodging' },
	{ key: 'shop', emoji: '🛍️', label: 'Shop', query: 'shopping' }
];
```

**Behavior:**
- Full-screen overlay on mobile (`fixed inset-0 z-[70]`), centered modal on desktop (`md:inset-6 md:rounded-2xl`)
- MapLibre GL map fills available space below search/chips bar
- Lazy-load maplibre-gl on mount
- Category chip tap → fetch `/api/places/search?q={category.query}+near+{center.name}` → drop marker pins
- Search bar (debounced 400ms) → same fetch → replace pins
- Pin tap → set `selectedPlace` state → slide up bottom card with photo, name, rating, address, "Select this place" button
- "Select this place" → call `onSelect(selectedPlace)` → parent closes overlay
- Back button / X → close overlay without selecting
- MapLibre markers: colored circles with numbers, current selection gets pulse ring (reuse MiniMap pattern)

**Layout structure:**
```
<div class="fixed inset-0 z-[70] flex flex-col bg-white md:inset-6 md:mx-auto md:max-w-3xl md:rounded-2xl md:shadow-2xl">
  <!-- Header -->
  <!-- Search + Chips -->
  <!-- Map container (flex-1) -->
  <!-- Selected place card (absolute bottom, slides up) -->
</div>
```

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/components/trip/PlacePicker.svelte
git commit -m "feat: add PlacePicker full-screen map overlay component"
```

---

### Task 8: Update ActivityEditor + Day Page Integration

**Files:**
- Modify: `src/lib/components/trip/ActivityEditor.svelte` (major rewrite of location section)
- Modify: `src/routes/day/[dayNumber]/+page.svelte:54-67` (openEdit passthrough)

**Step 1: Update ActivityEditor**

a) Add imports:
```typescript
import PlacePicker from '$lib/components/trip/PlacePicker.svelte';
import type { PlaceDetails } from '$lib/types/app';
```

b) Add new state variables (after line 38):
```typescript
let googlePlaceId = $state<string | null>(null);
let latitude = $state<number | null>(null);
let longitude = $state<number | null>(null);
let locationAddress = $state<string | null>(null);
let imageUrl = $state<string | null>(null);
let placePickerOpen = $state(false);
```

c) Add `dayNumber` prop:
```typescript
let {
	open = $bindable(false),
	dayId,
	dayNumber = 1,
	existing = null,
	supabase,
	onsave,
	ondelete
}: {
	open: boolean;
	dayId: string;
	dayNumber?: number;
	existing?: (ActivityUpdate & { id: string }) | null;
	supabase: SupabaseClient<Database>;
	onsave?: (data: ActivityInsert | (ActivityUpdate & { id: string })) => void;
	ondelete?: (id: string, dayId: string) => void;
} = $props();
```

d) Update `$effect` sync (line 41-52) to populate new fields:
```typescript
$effect(() => {
	if (open) {
		title = existing?.title ?? '';
		type = (existing?.type as ActivityType) ?? 'activity';
		status = (existing?.status as ActivityStatus) ?? 'tbd';
		description = existing?.description ?? '';
		locationName = existing?.location_name ?? '';
		startTime = existing?.start_time ?? '';
		costEstimate = existing?.cost_estimate != null ? String(existing.cost_estimate) : '';
		googlePlaceId = existing?.google_place_id ?? null;
		latitude = existing?.latitude ?? null;
		longitude = existing?.longitude ?? null;
		locationAddress = existing?.location_address ?? null;
		imageUrl = existing?.image_url ?? null;
		confirmDelete = false;
	}
});
```

e) Update `handleSave` data to include place fields:
```typescript
const data = {
	title: title.trim(),
	type,
	status,
	description: description.trim() || null,
	location_name: locationName.trim() || null,
	start_time: startTime || null,
	cost_estimate: parsedCost && !isNaN(parsedCost) ? parsedCost : null,
	day_id: dayId,
	google_place_id: googlePlaceId,
	latitude,
	longitude,
	location_address: locationAddress,
	image_url: imageUrl
};
```

f) Add `handlePlaceSelect` function:
```typescript
function handlePlaceSelect(place: PlaceDetails) {
	googlePlaceId = place.googlePlaceId ?? null;
	locationName = place.name;
	locationAddress = place.formattedAddress ?? null;
	latitude = place.location?.lat ?? null;
	longitude = place.location?.lng ?? null;
	imageUrl = place.photos?.[0] ?? null;
	placePickerOpen = false;
}

function clearPlace() {
	googlePlaceId = null;
	latitude = null;
	longitude = null;
	locationAddress = null;
	imageUrl = null;
	locationName = '';
}
```

g) Update `resetForm` to clear new fields:
```typescript
function resetForm() {
	title = '';
	type = 'activity';
	status = 'tbd';
	description = '';
	locationName = '';
	startTime = '';
	costEstimate = '';
	confirmDelete = false;
	googlePlaceId = null;
	latitude = null;
	longitude = null;
	locationAddress = null;
	imageUrl = null;
}
```

h) Replace the Location section in the template (lines 165-173). Remove `LocationAutocomplete` import and the old section. Replace with:

**If place selected** — show a compact place chip with photo thumbnail, name, and clear button.
**If no place** — show a "Find a spot" tappable card that opens the PlacePicker.

```svelte
<!-- Location -->
<div>
	<label class="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400">Location</label>
	{#if googlePlaceId && locationName}
		<!-- Selected place chip -->
		<div class="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
			{#if imageUrl}
				<img src={imageUrl} alt="" class="h-10 w-14 flex-shrink-0 rounded-lg object-cover" />
			{:else}
				<div class="flex h-10 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-slate-200">
					<svg class="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
						<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0 1 15 0Z" />
					</svg>
				</div>
			{/if}
			<div class="min-w-0 flex-1">
				<p class="truncate text-sm font-semibold text-slate-800">{locationName}</p>
				{#if locationAddress}
					<p class="truncate text-[11px] text-slate-400">{locationAddress}</p>
				{/if}
			</div>
			<div class="flex items-center gap-1">
				<button onclick={() => placePickerOpen = true} class="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600">
					<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" />
					</svg>
				</button>
				<button onclick={clearPlace} class="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-rose-100 hover:text-rose-500">
					<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		</div>
	{:else}
		<!-- "Find a spot" card -->
		<button
			onclick={() => placePickerOpen = true}
			class="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 px-4 py-3 transition-all hover:border-primary-300 hover:bg-primary-50/30 active:scale-[0.98]"
		>
			<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
				<svg class="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
					<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0 1 15 0Z" />
				</svg>
			</div>
			<div class="text-left">
				<p class="text-sm font-semibold text-slate-700">Find a spot</p>
				<p class="text-[11px] text-slate-400">Search places on the map</p>
			</div>
		</button>
	{/if}
</div>
```

i) Add PlacePicker component at the end (before the closing BottomSheet):

```svelte
<PlacePicker bind:open={placePickerOpen} {dayNumber} onSelect={handlePlaceSelect} />
```

j) Remove unused imports: `LocationAutocomplete` and `useLocationSuggestions`.

**Step 2: Update day page to pass `dayNumber` to ActivityEditor**

In `src/routes/day/[dayNumber]/+page.svelte`, update the ActivityEditor (line 252-259) to pass `dayNumber`:

```svelte
<ActivityEditor
	bind:open={editorOpen}
	dayId={dayQuery.data.id}
	{dayNumber}
	existing={editingActivity}
	supabase={data.supabase}
	onsave={handleSave}
	ondelete={handleDelete}
/>
```

Also update `openEdit` (lines 54-67) to pass through the place fields:

```typescript
function openEdit(activity: Activity) {
	editingActivity = {
		id: activity.id,
		title: activity.title,
		type: activity.type,
		status: activity.status,
		description: activity.description,
		location_name: activity.location_name,
		start_time: activity.start_time,
		cost_estimate: activity.cost_estimate,
		day_id: activity.day_id,
		google_place_id: activity.google_place_id,
		latitude: activity.latitude,
		longitude: activity.longitude,
		location_address: activity.location_address,
		image_url: activity.image_url
	};
	editorOpen = true;
}
```

**Step 3: Verify build**

Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/components/trip/ActivityEditor.svelte src/routes/day/[dayNumber]/+page.svelte
git commit -m "feat: integrate PlacePicker into ActivityEditor with place data persistence"
```

---

### Task 9: Update AI Tools + Action Handler

**Files:**
- Modify: `src/routes/api/chat/+server.ts:48-95,138-163,180-203,415-491,10-43`
- Modify: `src/routes/api/chat/action/+server.ts:121-136,200-218,243-256`

**Step 1: Add place params to AI tool definitions**

In `src/routes/api/chat/+server.ts`:

a) In `create_activity` tool (lines 54-91), add after `cost_estimate`:
```typescript
google_place_id: { type: 'string', description: 'Google Place ID from a search_places result, optional' },
latitude: { type: 'number', description: 'Latitude of the place, optional' },
longitude: { type: 'number', description: 'Longitude of the place, optional' },
location_address: { type: 'string', description: 'Full formatted address, optional' },
image_url: { type: 'string', description: 'Photo URL of the place, optional' }
```

b) Add same 5 fields to `replace_activity` (after `cost_estimate` at ~line 158).

c) Add same 5 fields to `update_activity` (after `location_name` at ~line 199).

**Step 2: Update system prompt**

Add this paragraph after the `search_places` instruction (before the closing of SYSTEM_PROMPT):

```
When you use search_places and then create or replace an activity based on a result, always pass the google_place_id, latitude, longitude, location_address, and image_url from the search result to ensure the place is linked precisely.
```

**Step 3: Update `buildActionMetadata`**

In the `create_activity` case (~line 420-433), add:
```typescript
google_place_id: args.google_place_id as string | undefined,
latitude: args.latitude as number | undefined,
longitude: args.longitude as number | undefined,
location_address: args.location_address as string | undefined,
image_url: args.image_url as string | undefined
```

In the `replace_activity` case (~line 452-465), add the same 5 fields.

In the `update_activity` case (~line 476-491), add inside `updates`:
```typescript
google_place_id: args.google_place_id as string | undefined,
latitude: args.latitude as number | undefined,
longitude: args.longitude as number | undefined,
location_address: args.location_address as string | undefined,
image_url: args.image_url as string | undefined
```

**Step 4: Update action handler inserts**

In `src/routes/api/chat/action/+server.ts`:

a) `create_activity` insert (lines 121-136) — add after `created_by: user.id`:
```typescript
google_place_id: payload.google_place_id ?? null,
latitude: payload.latitude ?? null,
longitude: payload.longitude ?? null,
location_address: payload.location_address ?? null,
image_url: payload.image_url ?? null,
```

b) `replace_activity` insert (lines 200-218) — add the same 5 fields.

c) `update_activity` update (lines 243-249) — add after the existing `if` checks:
```typescript
if (payload.updates.google_place_id !== undefined) updateFields.google_place_id = payload.updates.google_place_id;
if (payload.updates.latitude !== undefined) updateFields.latitude = payload.updates.latitude;
if (payload.updates.longitude !== undefined) updateFields.longitude = payload.updates.longitude;
if (payload.updates.location_address !== undefined) updateFields.location_address = payload.updates.location_address;
if (payload.updates.image_url !== undefined) updateFields.image_url = payload.updates.image_url;
```

**Step 5: Verify build**

Run: `npm run build`
Expected: PASS

**Step 6: Commit**

```bash
git add src/routes/api/chat/+server.ts src/routes/api/chat/action/+server.ts
git commit -m "feat: AI tools and action handler persist place data on activity create/replace/update"
```

---

### Task 10: Update PlacesCarousel Quick-Add

**Files:**
- Modify: `src/lib/components/trip/PlacesCarousel.svelte:36-49`

**Step 1: Pass place data through ActionMetadata**

Replace `handleQuickAdd` (lines 36-49):
```typescript
function handleQuickAdd(place: PlaceDetails) {
	if (!dayNumber || !onQuickAdd) return;
	const metadata: ActionMetadata = {
		action: 'create_activity',
		status: 'pending',
		payload: {
			day_number: dayNumber,
			title: place.name,
			type: inferType(place),
			location_name: place.formattedAddress,
			description: place.editorialSummary,
			google_place_id: place.googlePlaceId,
			latitude: place.location?.lat,
			longitude: place.location?.lng,
			location_address: place.formattedAddress,
			image_url: place.photos?.[0]
		}
	};
	onQuickAdd(metadata);
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/components/trip/PlacesCarousel.svelte
git commit -m "feat: PlacesCarousel quick-add passes place data through ActionMetadata"
```

---

### Task 11: Final Build Verification

**Step 1: Full build check**

Run: `npm run build`
Expected: PASS with no type errors

**Step 2: Verify no regressions**

Check that the following still work conceptually (types compile):
- Day page renders activities with PlaceCards
- ActivityEditor opens for create and edit
- AI chat tools compile with new params
- Action handler inserts/updates compile

**Step 3: Final commit if any fixups needed**

```bash
git add -A
git commit -m "chore: fixups from final verification"
```
