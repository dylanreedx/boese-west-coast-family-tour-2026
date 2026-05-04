# First-Class Google Places on Activities + Map Place Picker

**Date**: 2026-02-13
**Status**: Approved

## Problem

Activities have a free-text `location_name` field. The PlaceCard component searches Google Places using `title + location_name` and renders the first result — non-deterministic, often wrong (e.g., "Lunch near Sedona" returns "The Hudson" with no way to change it). The DB has `latitude`, `longitude`, `location_address`, `image_url` columns that are never populated. Place data is fetched on every render but never stored.

## Solution

Make Google Places a first-class part of activities:
1. Add a `google_place_id` column to lock in a specific place
2. Build a full-screen map-based Place Picker for the ActivityEditor
3. Pipe place data through AI tools, action handlers, and PlacesCarousel
4. PlaceCard does deterministic lookups when `google_place_id` is present
5. Fix BottomSheet mobile horizontal overflow bug

## Place Picker UX

### Entry Point (ActivityEditor Location Section)

**No place selected**: A tappable illustrated card — small map graphic with pin icon, text "Find a spot". Friendly, not a boring input.

**Place selected**: Compact chip with photo thumbnail, name, rating, "x" to clear, tap to change.

### Full-Screen Map Overlay

Opens when user taps the location entry point. Slides up with same animation style as BottomSheet.

**Layout (top to bottom)**:
1. **Header bar**: Back arrow + "Pick a place" + day destination subtitle (e.g., "Day 3 — Grand Canyon")
2. **Search bar**: Rounded input, search icon, placeholder "Search for a place..."
3. **Category chips**: Horizontal scroll — Eat, See, Do, Stay, Shop — each with emoji + label
4. **MapLibre map**: Fills remaining space, centered on day's primary destination at zoom ~12
5. **Place popup**: On pin tap, card slides up from bottom with photo, name, rating, address, "Select this place" button

**Category search**: Tapping "Eat" searches `/api/places/search?q=restaurants+near+[destination]`. Results drop as pins on the map.

**Custom search**: Debounced 400ms, same endpoint, clears and replaces pins. Query biased to day's location.

**On select**: Returns `PlaceDetails` with `googlePlaceId`, name, lat/lng, address, photos, editorialSummary. Overlay closes, editor populates.

### Desktop

Same overlay but renders as a centered modal (max-width ~800px) with more map real estate. Category chips and search bar sit in a top toolbar. Place popup card appears as a sidebar or bottom panel within the modal.

## Component: `PlacePicker.svelte`

```
Props:
  open: boolean (bindable)
  dayNumber: number
  onSelect: (place: PlaceDetails) => void

Internal:
  - DAY_CENTERS constant: day number → { lat, lng, name }
  - MapLibre GL instance with markers
  - Category chip state + search state
  - Selected pin state → bottom card
```

## Data Flow Changes

### Database

Migration: `ALTER TABLE activities ADD COLUMN google_place_id text;` + index.

Existing unused columns that will now be populated: `latitude`, `longitude`, `location_address`, `image_url`.

### Types (`src/lib/types/app.ts`)

- `PlaceDetails`: add `googlePlaceId?: string`
- `ActionMetadata` payloads (create/replace/update activity): add `google_place_id`, `latitude`, `longitude`, `location_address`, `image_url`

### API Endpoints

All three Places endpoints add `places.id` to FieldMask, map to `googlePlaceId`:
- `/api/places/details` — also add `?placeId=X` mode for deterministic lookup
- `/api/places/search` — return `googlePlaceId` per result
- `fetchPlacesSearch` in chat server — return `googlePlaceId` per result

### PlaceCard (`PlaceCard.svelte`)

New prop: `googlePlaceId?: string`. When present, fetch by `?placeId=X` (deterministic) instead of text search. Falls back to text search for backward compatibility.

### ActivityItem (`ActivityItem.svelte`)

Pass `googlePlaceId={activity.google_place_id}` to PlaceCard. Show PlaceCard if `location_name || google_place_id`.

### ActivityEditor (`ActivityEditor.svelte`)

- Remove `LocationAutocomplete` in favor of Place Picker entry point
- New state: `googlePlaceId`, `latitude`, `longitude`, `locationAddress`, `imageUrl`
- `handleSave()` includes all place fields
- Sync from `existing` activity on open

### AI Tools (`+server.ts`)

Tool definitions for `create_activity`, `replace_activity`, `update_activity` gain optional params: `google_place_id`, `latitude`, `longitude`, `location_address`, `image_url`.

System prompt instructs: "When you have place data from search_places, pass google_place_id and location fields to create_activity."

### Action Handler (`action/+server.ts`)

All three action types (create, replace, update) persist the 5 place fields.

### PlacesCarousel (`PlacesCarousel.svelte`)

`handleQuickAdd` passes `google_place_id`, `latitude`, `longitude`, `location_address`, `image_url` from the place data into ActionMetadata payload.

## BottomSheet Overflow Fix

`src/lib/components/ui/BottomSheet.svelte`:
- Add `overflow-hidden` to sheet panel div
- Add `overflow-x-hidden` to scrollable content div

## Implementation Order

1. DB migration + type regeneration
2. App type updates (PlaceDetails, ActionMetadata)
3. API endpoint updates (FieldMask, placeId lookup mode)
4. BottomSheet overflow fix (independent, quick win)
5. PlaceCard deterministic lookup
6. ActivityItem pass-through
7. PlacePicker component (new, full-screen map overlay)
8. ActivityEditor integration (place picker entry point, save fields)
9. AI tools + action handler + system prompt
10. PlacesCarousel quick-add pass-through

## Backward Compatibility

- Activities without `google_place_id`: PlaceCard falls back to text search (existing behavior)
- AI tools: all new params optional, existing conversations unaffected
- No data migration needed for existing activities

## Verification

1. `npm run build` passes
2. Create activity via editor with map picker — place data stored in DB
3. Edit activity — place fields pre-populated, PlaceCard shows correct place
4. AI guide: "find restaurants in Phoenix" → pick one → approve → place data stored
5. PlacesCarousel quick-add → place data flows through
6. Existing activities without google_place_id still render PlaceCard via text search
7. Mobile: ActivityEditor no horizontal overflow
8. Desktop: PlacePicker modal renders cleanly at larger viewports
