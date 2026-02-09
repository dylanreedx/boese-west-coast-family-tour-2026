<script lang="ts">
	import { onMount } from 'svelte';
	import { createQuery } from '@tanstack/svelte-query';
	import { TRIP_ID } from '$lib/types/app';
	import Header from '$lib/components/layout/Header.svelte';
	import BottomNav from '$lib/components/layout/BottomNav.svelte';
	import SEO from '$lib/components/SEO.svelte';

	let { data } = $props();

	const daysQuery = createQuery(() => ({
		queryKey: ['days-with-coords', TRIP_ID],
		queryFn: async () => {
			const { data: days, error } = await data.supabase
				.from('days')
				.select('*, activities(id, title, type, location_name, latitude, longitude, sort_order, status)')
				.eq('trip_id', TRIP_ID)
				.order('day_number')
				.order('sort_order', { referencedTable: 'activities' });
			if (error) throw error;
			return days;
		}
	}));

	let mapContainer: HTMLDivElement;
	let map: any;
	let selectedDay = $state<number | null>(null);

	const DAY_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'];

	onMount(() => {
		let cleanup: (() => void) | undefined;

		// Dynamically import maplibre to avoid SSR issues
		import('maplibre-gl').then(({ default: maplibregl }) => {
			map = new maplibregl.Map({
				container: mapContainer,
				style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
				center: [-112, 36],
				zoom: 4.5
			});

			map.addControl(new maplibregl.NavigationControl(), 'top-right');

			map.on('load', () => {
				addMapData(maplibregl);
			});

			cleanup = () => map?.remove();
		});

		return () => cleanup?.();
	});

	function addMapData(maplibregl: any) {
		if (!daysQuery.data || !map) return;

		const allCoords: [number, number][] = [];

		for (const day of daysQuery.data) {
			const activities = (day.activities ?? []).filter(
				(a: any) => a.latitude && a.longitude
			);
			if (activities.length === 0) continue;

			const dayNum = day.day_number;
			const color = DAY_COLORS[(dayNum - 1) % DAY_COLORS.length];
			const coords = activities.map((a: any) => [a.longitude, a.latitude] as [number, number]);
			allCoords.push(...coords);

			// Route line for this day
			map.addSource(`route-day-${dayNum}`, {
				type: 'geojson',
				data: {
					type: 'Feature',
					properties: {},
					geometry: { type: 'LineString', coordinates: coords }
				}
			});

			map.addLayer({
				id: `route-line-${dayNum}`,
				type: 'line',
				source: `route-day-${dayNum}`,
				paint: {
					'line-color': color,
					'line-width': 3,
					'line-opacity': 0.6,
					'line-dasharray': [2, 2]
				}
			});

			// Markers for stops
			for (const activity of activities) {
				const el = document.createElement('div');
				el.className = 'map-marker';
				el.style.cssText = `
					width: 28px; height: 28px; border-radius: 50%;
					background: ${color}; color: white; font-size: 12px; font-weight: 700;
					display: flex; align-items: center; justify-content: center;
					border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);
					cursor: pointer;
				`;
				el.textContent = String(dayNum);

				const popup = new maplibregl.Popup({ offset: 20, closeButton: false })
					.setHTML(`
						<div style="font-family: system-ui; padding: 4px;">
							<div style="font-size: 12px; font-weight: 700; color: #0f172a;">
								${activity.title}
							</div>
							${activity.location_name ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">${activity.location_name}</div>` : ''}
							<div style="font-size: 10px; color: ${color}; margin-top: 4px; font-weight: 600;">Day ${dayNum}</div>
						</div>
					`);

				new maplibregl.Marker({ element: el })
					.setLngLat([activity.longitude, activity.latitude])
					.setPopup(popup)
					.addTo(map);
			}
		}

		// Fit map to all coordinates
		if (allCoords.length > 1) {
			const bounds = allCoords.reduce(
				(b, coord) => b.extend(coord),
				new maplibregl.LngLatBounds(allCoords[0], allCoords[0])
			);
			map.fitBounds(bounds, { padding: 50 });
		}
	}

	// Re-add data when query completes
	$effect(() => {
		if (daysQuery.data && map?.loaded()) {
			import('maplibre-gl').then(({ default: maplibregl }) => {
				addMapData(maplibregl);
			});
		}
	});

	function flyToDay(dayNum: number) {
		if (!daysQuery.data || !map) return;
		selectedDay = dayNum;
		const day = daysQuery.data.find((d) => d.day_number === dayNum);
		if (!day) return;
		const activities = (day.activities ?? []).filter((a: any) => a.latitude && a.longitude);
		if (activities.length === 0) return;

		const firstActivity = activities[0] as any;
		map.flyTo({
			center: [firstActivity.longitude, firstActivity.latitude],
			zoom: 8,
			speed: 1.2
		});
	}
</script>

<svelte:head>
	<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.17.0/dist/maplibre-gl.css" />
</svelte:head>

<SEO
	title="Map - Boese West Coast Trip"
	description="Interactive route map for the Boese family West Coast road trip. See all 8 days of stops from Detroit to Joshua Tree."
	ogStyle="journey"
/>

<Header title="Route Map" supabase={data.supabase} userEmail={data.session?.user?.email} />

<main class="relative" style="height: calc(100vh - 60px - 72px)">
	<div bind:this={mapContainer} class="h-full w-full"></div>

	<!-- Day Selector -->
	<div class="absolute bottom-4 left-0 right-0 flex justify-center">
		<div class="flex gap-1.5 rounded-2xl bg-white/90 p-2 shadow-lg backdrop-blur-sm">
			{#each Array(8) as _, i}
				{@const dayNum = i + 1}
				<button
					onclick={() => flyToDay(dayNum)}
					class="flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold transition-all active:scale-90
						{selectedDay === dayNum ? 'text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}"
					style={selectedDay === dayNum ? `background-color: ${DAY_COLORS[i]}` : ''}
				>
					{dayNum}
				</button>
			{/each}
		</div>
	</div>
</main>

<BottomNav />
