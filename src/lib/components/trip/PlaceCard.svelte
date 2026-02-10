<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import type { PlaceDetails } from '$lib/types/app';

	let {
		title,
		locationName,
		compact = false
	}: {
		title: string;
		locationName?: string;
		compact?: boolean;
	} = $props();

	const searchQuery = $derived(
		[title, locationName].filter(Boolean).join(' ')
	);

	const detailsQuery = createQuery(() => ({
		queryKey: ['place-details', searchQuery],
		enabled: !!searchQuery,
		staleTime: 1000 * 60 * 30,
		queryFn: async () => {
			const res = await fetch(`/api/places/details?q=${encodeURIComponent(searchQuery)}`);
			if (!res.ok) return null;
			const data = await res.json();
			return data.details as PlaceDetails | null;
		}
	}));

	let showMap = $state(false);
	let showVideo = $state(false);
	let expandedPhoto = $state<string | null>(null);

	const videoQuery = createQuery(() => ({
		queryKey: ['place-video', searchQuery],
		enabled: showVideo && !!searchQuery,
		staleTime: 1000 * 60 * 60,
		queryFn: async () => {
			const res = await fetch(`/api/places/video?q=${encodeURIComponent(searchQuery)}`);
			if (!res.ok) return null;
			const data = await res.json();
			return data.videoId as string | null;
		}
	}));

	const details = $derived(detailsQuery.data);
	const heroPhoto = $derived(details?.photos?.[0] ?? null);
	const remainingPhotos = $derived(details?.photos?.slice(1) ?? []);
	const hasMap = $derived(!!details?.mapsEmbedUrl);

	const PRICE_LABELS: Record<string, string> = {
		'PRICE_LEVEL_FREE': 'Free',
		'PRICE_LEVEL_INEXPENSIVE': '$',
		'PRICE_LEVEL_MODERATE': '$$',
		'PRICE_LEVEL_EXPENSIVE': '$$$',
		'PRICE_LEVEL_VERY_EXPENSIVE': '$$$$'
	};

	const priceLabel = $derived(
		details?.priceLevel ? PRICE_LABELS[details.priceLevel] ?? null : null
	);
</script>

<!-- COMPACT VARIANT -->
{#if compact}
	{#if detailsQuery.isLoading}
		<div class="flex items-center gap-2.5 py-1">
			<div class="h-[60px] w-[80px] flex-shrink-0 animate-pulse rounded-lg bg-slate-200/80"></div>
			<div class="flex-1 space-y-1.5">
				<div class="h-3.5 w-3/4 animate-pulse rounded bg-slate-200/80"></div>
				<div class="h-3 w-1/2 animate-pulse rounded bg-slate-200/60"></div>
			</div>
		</div>
	{:else if details}
		<div class="flex items-center gap-2.5 py-1">
			{#if heroPhoto}
				<div class="compact-thumb relative h-[60px] w-[80px] flex-shrink-0 overflow-hidden rounded-lg shadow-sm">
					<img
						src={heroPhoto}
						alt={details.name}
						class="h-full w-full object-cover"
						loading="lazy"
					/>
				</div>
			{/if}
			<div class="min-w-0 flex-1">
				<p class="truncate text-[13px] font-semibold leading-tight text-slate-800">
					{details.name}
				</p>
				<div class="mt-0.5 flex items-center gap-1.5">
					{#if details.rating}
						<span class="inline-flex items-center gap-0.5 text-[11px] font-medium text-amber-600">
							<svg class="h-3 w-3 fill-amber-400" viewBox="0 0 20 20">
								<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
							</svg>
							{details.rating.toFixed(1)}
						</span>
					{/if}
					{#if priceLabel}
						<span class="text-[10px] font-medium text-slate-400">{priceLabel}</span>
					{/if}
				</div>
			</div>
		</div>
	{/if}

<!-- FULL VARIANT -->
{:else}
	{#if detailsQuery.isLoading}
		<!-- Skeleton: hero -->
		<div class="place-card overflow-hidden rounded-xl">
			<div class="h-[160px] w-full animate-pulse bg-slate-200/80"></div>
			<div class="space-y-2 p-3">
				<div class="h-4 w-3/4 animate-pulse rounded bg-slate-200/80"></div>
				<div class="h-3 w-full animate-pulse rounded bg-slate-200/60"></div>
				<div class="h-3 w-2/3 animate-pulse rounded bg-slate-200/60"></div>
			</div>
			<div class="flex gap-1.5 px-3 pb-3">
				{#each Array(3) as _}
					<div class="h-14 w-18 flex-shrink-0 animate-pulse rounded-lg bg-slate-200/60"></div>
				{/each}
			</div>
		</div>
	{:else if details}
		<div class="place-card overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/60">
			<!-- Hero photo with gradient overlay -->
			{#if heroPhoto}
				<div class="hero-container relative h-[160px] w-full overflow-hidden">
					<img
						src={heroPhoto}
						alt={details.name}
						class="h-full w-full object-cover"
						loading="lazy"
					/>
					<div class="hero-gradient absolute inset-0"></div>

					<!-- Overlay badges: rating + price -->
					<div class="absolute bottom-0 left-0 right-0 flex items-end justify-between p-3">
						<div class="flex items-center gap-2">
							{#if details.rating}
								<span class="inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
									<svg class="h-3 w-3 fill-amber-400" viewBox="0 0 20 20">
										<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
									</svg>
									{details.rating.toFixed(1)}
									{#if details.userRatingCount}
										<span class="text-[10px] font-normal text-white/70">({details.userRatingCount.toLocaleString()})</span>
									{/if}
								</span>
							{/if}
							{#if priceLabel}
								<span class="rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 backdrop-blur-sm">
									{priceLabel}
								</span>
							{/if}
						</div>
						{#if details.openNow !== undefined}
							<span class="rounded-full px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm {details.openNow ? 'bg-emerald-500/30 text-emerald-200' : 'bg-red-500/30 text-red-200'}">
								{details.openNow ? 'Open now' : 'Closed'}
							</span>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Details strip -->
			<div class="p-3">
				<h3 class="text-[15px] font-bold leading-snug text-slate-900">
					{details.name}
				</h3>
				{#if details.formattedAddress}
					<p class="mt-0.5 flex items-start gap-1 text-[11px] leading-snug text-slate-400">
						<svg class="mt-px h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
							<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0 1 15 0Z" />
						</svg>
						<span class="line-clamp-1">{details.formattedAddress}</span>
					</p>
				{/if}
				{#if details.editorialSummary}
					<p class="mt-1.5 text-xs leading-relaxed text-slate-600 line-clamp-2">
						{details.editorialSummary}
					</p>
				{/if}
			</div>

			<!-- Photo strip -->
			{#if remainingPhotos.length > 0}
				<div class="photo-strip -mt-1 flex gap-1.5 overflow-x-auto px-3 pb-3 scrollbar-none">
					{#each remainingPhotos as photoUrl, i}
						<button
							onclick={() => expandedPhoto = expandedPhoto === photoUrl ? null : photoUrl}
							class="photo-thumb relative h-14 w-[72px] flex-shrink-0 overflow-hidden rounded-lg shadow-sm ring-1 ring-slate-200/50 transition-all hover:ring-2 hover:ring-primary-300 active:scale-95"
						>
							<img
								src={photoUrl}
								alt="{details.name} photo {i + 2}"
								class="h-full w-full object-cover"
								loading="lazy"
							/>
						</button>
					{/each}
				</div>

				<!-- Expanded photo -->
				{#if expandedPhoto}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="expanded-photo mx-3 mb-3 overflow-hidden rounded-xl shadow-md ring-1 ring-slate-200"
						onclick={() => expandedPhoto = null}
					>
						<img
							src={expandedPhoto}
							alt="{details.name} expanded"
							class="w-full object-cover"
							style="max-height: 220px"
							loading="lazy"
						/>
					</div>
				{/if}
			{/if}

			<!-- Action row: Map + Video -->
			<div class="action-row border-t border-slate-100 px-3 py-2">
				<div class="flex gap-2">
					{#if hasMap}
						<button
							onclick={() => { showMap = !showMap; }}
							class="action-btn flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all active:scale-[0.97]
								{showMap ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-200' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}"
						>
							<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
								<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0 1 15 0Z" />
							</svg>
							{showMap ? 'Hide Map' : 'See on Map'}
						</button>
					{/if}
					<button
						onclick={() => { showVideo = !showVideo; }}
						class="action-btn flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all active:scale-[0.97]
							{showVideo ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-200' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}"
					>
						<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
						</svg>
						{showVideo ? 'Hide Video' : 'Watch Video'}
					</button>
				</div>

				<!-- Map embed (expandable) -->
				{#if showMap && details.mapsEmbedUrl}
					<div class="embed-reveal mt-2 overflow-hidden rounded-lg ring-1 ring-slate-200">
						<iframe
							src={details.mapsEmbedUrl}
							title="Map of {details.name}"
							class="h-[200px] w-full border-0"
							loading="lazy"
							referrerpolicy="no-referrer-when-downgrade"
							allowfullscreen
						></iframe>
					</div>
				{/if}

				<!-- Video embed (expandable) -->
				{#if showVideo}
					<div class="embed-reveal mt-2 overflow-hidden rounded-lg ring-1 ring-slate-200">
						{#if videoQuery.isLoading}
							<div class="flex h-[200px] items-center justify-center bg-slate-50">
								<div class="flex flex-col items-center gap-2">
									<div class="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-primary-500"></div>
									<span class="text-[11px] text-slate-400">Finding a video...</span>
								</div>
							</div>
						{:else if videoQuery.data}
							<iframe
								src="https://www.youtube.com/embed/{videoQuery.data}?modestbranding=1&rel=0"
								title="Video about {details.name}"
								class="aspect-video w-full border-0"
								loading="lazy"
								allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
								allowfullscreen
							></iframe>
						{:else}
							<div class="flex h-[120px] items-center justify-center bg-slate-50">
								<p class="text-xs text-slate-400">No video available</p>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{/if}
{/if}

<style>
	/* Hero gradient: transparent top -> dark bottom for text readability */
	.hero-gradient {
		background: linear-gradient(
			to bottom,
			transparent 30%,
			rgba(0, 0, 0, 0.15) 55%,
			rgba(0, 0, 0, 0.55) 100%
		);
	}

	/* Smooth entry for the hero photo */
	.hero-container img {
		transition: transform 0.4s ease;
	}
	.hero-container:hover img {
		transform: scale(1.03);
	}

	/* Compact thumbnail with subtle inner shadow for depth */
	.compact-thumb::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
		pointer-events: none;
	}

	/* Photo strip scrollbar hidden */
	.scrollbar-none::-webkit-scrollbar {
		display: none;
	}
	.scrollbar-none {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}

	/* Photo thumbnails: lift on hover */
	.photo-thumb {
		transition: transform 0.2s ease, box-shadow 0.2s ease;
	}
	.photo-thumb:hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 8px -2px rgba(0, 0, 0, 0.12);
	}

	/* Expanded photo entry */
	.expanded-photo {
		animation: photoReveal 0.25s ease-out;
	}
	@keyframes photoReveal {
		from {
			opacity: 0;
			transform: scaleY(0.92);
			transform-origin: top;
		}
		to {
			opacity: 1;
			transform: scaleY(1);
		}
	}

	/* Embed sections: smooth reveal */
	.embed-reveal {
		animation: embedSlide 0.3s ease-out;
	}
	@keyframes embedSlide {
		from {
			opacity: 0;
			max-height: 0;
			margin-top: 0;
		}
		to {
			opacity: 1;
			max-height: 500px;
			margin-top: 0.5rem;
		}
	}

	/* Action buttons: subtle press effect */
	.action-btn {
		transition: all 0.15s ease;
	}
	.action-btn:hover {
		transform: translateY(-0.5px);
	}
	.action-btn:active {
		transform: translateY(0.5px);
	}
</style>
