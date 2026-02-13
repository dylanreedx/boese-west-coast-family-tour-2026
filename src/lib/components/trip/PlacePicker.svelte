<script lang="ts">
	import type { PlaceDetails } from '$lib/types/app';
	import { getDayColor } from '$lib/utils/map-colors';

	let {
		open = $bindable(false),
		dayNumber,
		onSelect
	}: {
		open: boolean;
		dayNumber: number;
		onSelect: (place: PlaceDetails) => void;
	} = $props();

	const DAY_CENTERS: Record<number, { lat: number; lng: number; name: string }> = {
		1: { lat: 33.4484, lng: -112.074, name: 'Phoenix' },
		2: { lat: 33.4484, lng: -112.074, name: 'Phoenix' },
		3: { lat: 36.0544, lng: -112.1401, name: 'Grand Canyon' },
		4: { lat: 36.1699, lng: -115.1398, name: 'Las Vegas' },
		5: { lat: 36.5323, lng: -116.9325, name: 'Death Valley' },
		6: { lat: 37.7749, lng: -122.4194, name: 'San Francisco' },
		7: { lat: 34.0195, lng: -118.4912, name: 'Santa Monica' },
		8: { lat: 33.8734, lng: -115.901, name: 'Joshua Tree' }
	};

	const CATEGORIES = [
		{ key: 'eat', emoji: '🍽️', label: 'Eat', query: 'restaurants' },
		{ key: 'see', emoji: '👀', label: 'See', query: 'sightseeing attractions' },
		{ key: 'do', emoji: '🎯', label: 'Do', query: 'activities things to do' },
		{ key: 'stay', emoji: '🏨', label: 'Stay', query: 'hotels lodging' },
		{ key: 'shop', emoji: '🛍️', label: 'Shop', query: 'shopping' }
	];

	const CATEGORY_CHIP_STYLES: Record<string, string> = {
		eat: 'bg-orange-50 text-orange-700 border-orange-200 shadow-orange-100/60',
		see: 'bg-sky-50 text-sky-700 border-sky-200 shadow-sky-100/60',
		do: 'bg-violet-50 text-violet-700 border-violet-200 shadow-violet-100/60',
		stay: 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-emerald-100/60',
		shop: 'bg-pink-50 text-pink-700 border-pink-200 shadow-pink-100/60'
	};

	const CATEGORY_MARKER_COLORS: Record<string, string> = {
		eat: '#f97316',
		see: '#0ea5e9',
		do: '#8b5cf6',
		stay: '#10b981',
		shop: '#ec4899'
	};

	let mapContainer: HTMLDivElement;
	let searchInput: HTMLInputElement;
	// Non-reactive map objects (per memory: map instances must be plain let)
	let map: any = null;
	let maplibreModule: any = null;
	let markersOnMap: any[] = [];
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;

	let mapLoaded = $state(false);
	let searchText = $state('');
	let activeCategory = $state<string | null>(null);
	let searchResults = $state<PlaceDetails[]>([]);
	let selectedPlace = $state<PlaceDetails | null>(null);
	let isSearching = $state(false);

	const center = $derived(DAY_CENTERS[dayNumber] ?? DAY_CENTERS[1]);
	const dayColor = $derived(getDayColor(dayNumber));

	function formatPrice(priceLevel?: string): string {
		if (!priceLevel) return '';
		return priceLevel
			.replace('PRICE_LEVEL_', '')
			.replace('VERY_EXPENSIVE', '$$$$')
			.replace('EXPENSIVE', '$$$')
			.replace('MODERATE', '$$')
			.replace('INEXPENSIVE', '$')
			.replace('FREE', 'Free');
	}

	function initMap() {
		if (map || !mapContainer) return;
		import('maplibre-gl').then(({ default: maplibregl }) => {
			maplibreModule = maplibregl;
			map = new maplibregl.Map({
				container: mapContainer,
				style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
				center: [center.lng, center.lat],
				zoom: 12,
				attributionControl: false
			});
			map.addControl(
				new maplibregl.NavigationControl({ showCompass: false }),
				'bottom-right'
			);
			map.on('load', () => {
				mapLoaded = true;
			});
			// Tap map background to deselect
			map.on('click', () => {
				selectedPlace = null;
				resetMarkerStyles(-1);
			});
		});
	}

	function destroyMap() {
		clearMarkers();
		if (map) {
			map.remove();
			map = null;
		}
		mapLoaded = false;
		maplibreModule = null;
	}

	function clearMarkers() {
		for (const m of markersOnMap) m.remove();
		markersOnMap = [];
	}

	function resetMarkerStyles(activeIndex: number) {
		markersOnMap.forEach((m, j) => {
			const el = m.getElement();
			if (j === activeIndex) {
				el.style.transform = 'scale(1.25)';
				el.style.zIndex = '10';
				el.style.boxShadow = '0 0 0 4px rgba(255,255,255,0.7), 0 4px 12px rgba(0,0,0,0.3)';
			} else {
				el.style.transform = 'scale(1)';
				el.style.zIndex = '1';
				el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
			}
		});
	}

	function addMarkers(places: PlaceDetails[], categoryKey: string | null) {
		if (!map || !maplibreModule) return;
		clearMarkers();

		const bounds = new maplibreModule.LngLatBounds();
		let hasBounds = false;

		places.forEach((place, i) => {
			if (!place.location) return;
			const { lat, lng } = place.location;
			const color = categoryKey
				? (CATEGORY_MARKER_COLORS[categoryKey] ?? dayColor)
				: dayColor;

			const el = document.createElement('div');
			el.style.cssText = `
				width: 34px; height: 34px; border-radius: 50%;
				background: ${color}; border: 3px solid white;
				box-shadow: 0 2px 8px rgba(0,0,0,0.2);
				display: flex; align-items: center; justify-content: center;
				color: white; font-weight: 700; font-size: 13px;
				cursor: pointer; transition: transform 0.2s ease, box-shadow 0.2s ease;
				font-family: 'Plus Jakarta Sans', sans-serif;
			`;
			el.textContent = String(i + 1);

			el.addEventListener('click', (e) => {
				e.stopPropagation();
				selectedPlace = place;
				resetMarkerStyles(i);
				map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 14), duration: 400 });
			});

			const marker = new maplibreModule.Marker({ element: el })
				.setLngLat([lng, lat])
				.addTo(map);
			markersOnMap.push(marker);

			bounds.extend([lng, lat]);
			hasBounds = true;
		});

		if (hasBounds) {
			map.fitBounds(bounds, { padding: 70, maxZoom: 15, duration: 500 });
		}
	}

	async function searchPlaces(query: string) {
		if (!query.trim()) {
			searchResults = [];
			clearMarkers();
			selectedPlace = null;
			return;
		}
		isSearching = true;
		try {
			const fullQuery = `${query} near ${center.name}`;
			const res = await fetch(`/api/places/search?q=${encodeURIComponent(fullQuery)}`);
			if (res.ok) {
				const data = await res.json();
				searchResults = data.places ?? [];
				addMarkers(searchResults, activeCategory);
				selectedPlace = null;
			}
		} finally {
			isSearching = false;
		}
	}

	function handleSearchInput(value: string) {
		searchText = value;
		activeCategory = null;
		selectedPlace = null;
		if (searchTimeout) clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => searchPlaces(value), 400);
	}

	function handleCategoryClick(cat: (typeof CATEGORIES)[number]) {
		if (activeCategory === cat.key) {
			activeCategory = null;
			searchResults = [];
			clearMarkers();
			selectedPlace = null;
			return;
		}
		activeCategory = cat.key;
		searchText = '';
		selectedPlace = null;
		searchPlaces(cat.query);
	}

	function handleSelect() {
		if (selectedPlace) {
			onSelect(selectedPlace);
			open = false;
		}
	}

	function handleClose() {
		open = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') handleClose();
	}

	// Initialize/destroy map when open changes
	$effect(() => {
		if (open) {
			searchText = '';
			activeCategory = null;
			searchResults = [];
			selectedPlace = null;
			// Wait for DOM render
			setTimeout(() => {
				initMap();
				searchInput?.focus();
			}, 60);
		} else {
			destroyMap();
		}
	});
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="picker-backdrop" onclick={handleClose}></div>

	<!-- Overlay -->
	<div class="picker-overlay" role="dialog" aria-modal="true" aria-label="Place picker">
		<!-- Header -->
		<div class="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
			<button
				onclick={handleClose}
				class="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
				aria-label="Close place picker"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
				</svg>
			</button>
			<div class="min-w-0 flex-1">
				<h2 class="text-[15px] font-bold text-slate-800">Find a place</h2>
				<p class="text-xs text-slate-400">
					Day {dayNumber}
					<span class="mx-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style:background={dayColor}></span>
					{center.name}
				</p>
			</div>
		</div>

		<!-- Search + Chips -->
		<div class="flex flex-col gap-2 px-4 pt-2.5 pb-2">
			<div class="relative">
				<svg class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
				</svg>
				<input
					bind:this={searchInput}
					type="text"
					placeholder="Search restaurants, hotels, sights..."
					value={searchText}
					oninput={(e) => handleSearchInput(e.currentTarget.value)}
					class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 shadow-sm transition-colors placeholder:text-slate-400 focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
				/>
				{#if isSearching}
					<div class="absolute right-3 top-1/2 -translate-y-1/2">
						<div class="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-primary-500"></div>
					</div>
				{/if}
			</div>
			<div class="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5">
				{#each CATEGORIES as cat}
					<button
						onclick={() => handleCategoryClick(cat)}
						class="flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 active:scale-95
							{activeCategory === cat.key
								? CATEGORY_CHIP_STYLES[cat.key] + ' shadow-sm'
								: 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'}"
					>
						<span class="text-sm">{cat.emoji}</span>
						<span>{cat.label}</span>
					</button>
				{/each}
			</div>
		</div>

		<!-- Map container (flex-1 fills remaining space) -->
		<div class="relative min-h-0 flex-1">
			<div bind:this={mapContainer} class="absolute inset-0"></div>

			<!-- Empty state hint -->
			{#if !searchResults.length && !isSearching && mapLoaded}
				<div class="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
					<div class="rounded-full bg-white/90 px-4 py-2 text-[11px] font-medium text-slate-500 shadow-sm backdrop-blur-sm">
						Tap a category or search to discover places
					</div>
				</div>
			{/if}

			<!-- No results -->
			{#if searchResults.length === 0 && !isSearching && (searchText || activeCategory)}
				<div class="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
					<div class="rounded-full bg-white/90 px-4 py-2 text-[11px] font-medium text-slate-400 shadow-sm backdrop-blur-sm">
						No places found — try a different search
					</div>
				</div>
			{/if}

			<!-- Selected Place Card -->
			{#if selectedPlace}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="picker-card" onclick={(e) => e.stopPropagation()}>
					<div class="flex gap-3">
						{#if selectedPlace.photos?.length}
							<img
								src={selectedPlace.photos[0]}
								alt={selectedPlace.name}
								class="h-[72px] w-[96px] flex-shrink-0 rounded-lg object-cover"
							/>
						{:else}
							<div class="flex h-[72px] w-[96px] flex-shrink-0 items-center justify-center rounded-lg bg-slate-100">
								<svg class="h-6 w-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
									<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0 1 15 0Z" />
								</svg>
							</div>
						{/if}
						<div class="min-w-0 flex-1 py-0.5">
							<h3 class="truncate text-sm font-bold text-slate-800">{selectedPlace.name}</h3>
							{#if selectedPlace.rating}
								<div class="mt-1 flex items-center gap-1.5">
									<span class="text-xs font-semibold text-amber-600">★ {selectedPlace.rating}</span>
									{#if selectedPlace.userRatingCount}
										<span class="text-[10px] text-slate-400">({selectedPlace.userRatingCount.toLocaleString()})</span>
									{/if}
									{#if selectedPlace.priceLevel}
										<span class="text-[10px] text-slate-300">·</span>
										<span class="text-xs text-slate-500">{formatPrice(selectedPlace.priceLevel)}</span>
									{/if}
								</div>
							{/if}
							{#if selectedPlace.formattedAddress}
								<p class="mt-0.5 truncate text-[11px] leading-tight text-slate-400">{selectedPlace.formattedAddress}</p>
							{/if}
							{#if selectedPlace.editorialSummary}
								<p class="mt-0.5 line-clamp-1 text-[11px] leading-tight text-slate-500">{selectedPlace.editorialSummary}</p>
							{/if}
						</div>
					</div>
					<button onclick={handleSelect} class="picker-select-btn">
						Select this place
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.picker-backdrop {
		position: fixed;
		inset: 0;
		z-index: 69;
		background: rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(4px);
		animation: pickerFadeIn 0.2s ease-out;
	}

	.picker-overlay {
		position: fixed;
		inset: 0;
		z-index: 70;
		display: flex;
		flex-direction: column;
		background: white;
		animation: pickerSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@media (min-width: 768px) {
		.picker-overlay {
			inset: 24px;
			margin: auto;
			max-width: 48rem;
			max-height: calc(100vh - 48px);
			border-radius: 1rem;
			box-shadow:
				0 25px 50px -12px rgba(0, 0, 0, 0.25),
				0 0 0 1px rgba(0, 0, 0, 0.05);
		}
	}

	.picker-card {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		padding: 16px;
		padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
		background: white;
		border-top: 1px solid #e2e8f0;
		box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.08);
		z-index: 3;
		display: flex;
		flex-direction: column;
		gap: 12px;
		animation: pickerCardUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@media (min-width: 768px) {
		.picker-card {
			padding-bottom: 16px;
			border-radius: 0 0 1rem 1rem;
		}
	}

	.picker-select-btn {
		width: 100%;
		padding: 11px;
		border-radius: 12px;
		background: oklch(0.5 0.24 264);
		color: white;
		font-size: 14px;
		font-weight: 700;
		font-family: 'Plus Jakarta Sans', sans-serif;
		transition: all 0.15s ease;
		letter-spacing: -0.01em;
	}

	.picker-select-btn:hover {
		background: oklch(0.44 0.22 264);
		box-shadow: 0 4px 16px oklch(0.5 0.24 264 / 0.3);
	}

	.picker-select-btn:active {
		transform: scale(0.98);
	}

	@keyframes pickerFadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes pickerSlideUp {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes pickerCardUp {
		from {
			opacity: 0;
			transform: translateY(100%);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
