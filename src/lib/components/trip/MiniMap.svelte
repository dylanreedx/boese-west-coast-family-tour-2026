<script lang="ts">
	import { onMount } from 'svelte';
	import { getDayColor } from '$lib/utils/map-colors';

	let {
		activities,
		currentActivityId,
		dayNumber,
		height = '180px'
	}: {
		activities: Array<{
			id: string;
			title: string;
			latitude: number | null;
			longitude: number | null;
			sort_order: number;
		}>;
		currentActivityId?: string;
		dayNumber: number;
		height?: string;
	} = $props();

	let mapContainer: HTMLDivElement;
	let map: any = null;
	let mapLoaded = $state(false);
	let maplibreModule: any = null;
	let markers: any[] = [];
	let initialized = false;

	const dayColor = $derived(getDayColor(dayNumber));
	const geoActivities = $derived(
		activities.filter((a) => a.latitude != null && a.longitude != null)
	);

	function initMap(maplibregl: any) {
		if (!mapContainer || initialized) return;
		initialized = true;

		map = new maplibregl.Map({
			container: mapContainer,
			style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
			center: [0, 0],
			zoom: 1,
			attributionControl: false,
			interactive: true
		});

		map.scrollZoom.disable();
		map.dragRotate.disable();
		map.touchZoomRotate.disableRotation();

		map.on('load', () => {
			mapLoaded = true;
			renderMapData(maplibregl);
		});
	}

	function clearMapData(maplibregl: any) {
		// Remove existing markers
		for (const marker of markers) {
			marker.remove();
		}
		markers = [];

		// Remove existing layers and sources
		if (map) {
			try {
				if (map.getLayer('mini-route-line')) map.removeLayer('mini-route-line');
				if (map.getSource('mini-route')) map.removeSource('mini-route');
			} catch {
				// Layer/source may not exist yet
			}
		}
	}

	function renderMapData(maplibregl: any) {
		if (!map || !mapLoaded || geoActivities.length === 0) return;

		clearMapData(maplibregl);

		const coords = geoActivities.map(
			(a) => [a.longitude!, a.latitude!] as [number, number]
		);

		// Add route line
		if (coords.length >= 2) {
			map.addSource('mini-route', {
				type: 'geojson',
				data: {
					type: 'Feature',
					properties: {},
					geometry: { type: 'LineString', coordinates: coords }
				}
			});

			map.addLayer({
				id: 'mini-route-line',
				type: 'line',
				source: 'mini-route',
				paint: {
					'line-color': dayColor,
					'line-width': 2.5,
					'line-opacity': 0.5,
					'line-dasharray': [2, 2]
				}
			});
		}

		// Add numbered markers
		const newMarkers: any[] = [];
		for (let i = 0; i < geoActivities.length; i++) {
			const activity = geoActivities[i];
			const isCurrent = activity.id === currentActivityId;
			const size = isCurrent ? 36 : 24;

			const el = document.createElement('div');
			el.style.cssText = `
				position: relative;
				width: ${size}px;
				height: ${size}px;
				border-radius: 50%;
				background: ${dayColor};
				color: white;
				font-size: ${isCurrent ? 14 : 11}px;
				font-weight: 700;
				display: flex;
				align-items: center;
				justify-content: center;
				border: 2px solid white;
				box-shadow: 0 2px 6px rgba(0,0,0,0.25);
				cursor: default;
				z-index: ${isCurrent ? 10 : 1};
			`;
			el.textContent = String(i + 1);

			if (isCurrent) {
				const ring = document.createElement('div');
				ring.className = 'minimap-pulse-ring';
				ring.style.cssText = `
					position: absolute;
					inset: -6px;
					border-radius: 50%;
					border: 2px solid ${dayColor};
				`;
				el.appendChild(ring);
			}

			const marker = new maplibregl.Marker({ element: el })
				.setLngLat([activity.longitude!, activity.latitude!])
				.addTo(map);
			newMarkers.push(marker);
		}
		markers = newMarkers;

		// Fit bounds to all activities
		if (coords.length === 1) {
			map.setCenter(coords[0]);
			map.setZoom(13);
		} else if (coords.length > 1) {
			const bounds = coords.reduce(
				(b, coord) => b.extend(coord),
				new maplibregl.LngLatBounds(coords[0], coords[0])
			);
			map.fitBounds(bounds, { padding: 30, maxZoom: 14, duration: 0 });
		}
	}

	onMount(() => {
		let cleanup: (() => void) | undefined;

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting && !initialized) {
						observer.disconnect();
						import('maplibre-gl').then(({ default: maplibregl }) => {
							maplibreModule = maplibregl;
							initMap(maplibregl);
							cleanup = () => map?.remove();
						});
					}
				}
			},
			{ threshold: 0.1 }
		);

		if (mapContainer) {
			observer.observe(mapContainer);
		}

		return () => {
			observer.disconnect();
			cleanup?.();
		};
	});

	// Re-render when activities or currentActivityId change
	$effect(() => {
		// Touch reactive deps
		const _activities = geoActivities;
		const _current = currentActivityId;
		const _loaded = mapLoaded;

		if (_loaded && maplibreModule && _activities.length > 0) {
			renderMapData(maplibreModule);
		}
	});
</script>

<style>
	:global(.minimap-pulse-ring) {
		animation: minimap-pulse 2s ease-in-out infinite;
		opacity: 0.5;
	}

	@keyframes -global-minimap-pulse {
		0%,
		100% {
			transform: scale(1);
			opacity: 0.5;
		}
		50% {
			transform: scale(1.4);
			opacity: 0;
		}
	}
</style>

<div class="relative rounded-lg overflow-hidden ring-1 ring-slate-200" style:height>
	<div bind:this={mapContainer} class="h-full w-full"></div>

	<!-- Subtle bottom gradient overlay -->
	<div
		class="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white/40 to-transparent"
	></div>

	{#if geoActivities.length === 0}
		<div
			class="absolute inset-0 flex items-center justify-center bg-slate-50 text-xs text-slate-400"
		>
			No locations to map
		</div>
	{/if}
</div>
