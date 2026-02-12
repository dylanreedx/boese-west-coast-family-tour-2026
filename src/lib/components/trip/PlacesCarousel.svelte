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

	let activeIndex = $state(0);
	let carousel: HTMLDivElement | undefined = $state();

	const showDots = $derived(places.length > 1);

	const PRICE_LABELS: Record<string, string> = {
		'PRICE_LEVEL_FREE': 'Free',
		'PRICE_LEVEL_INEXPENSIVE': '$',
		'PRICE_LEVEL_MODERATE': '$$',
		'PRICE_LEVEL_EXPENSIVE': '$$$',
		'PRICE_LEVEL_VERY_EXPENSIVE': '$$$$'
	};

	function inferType(place: PlaceDetails): ActivityType {
		const name = (place.name + ' ' + (place.editorialSummary ?? '')).toLowerCase();
		if (name.match(/restaurant|cafe|coffee|bar|grill|pizza|taco|sushi|diner|bakery|bistro/)) return 'restaurant';
		if (name.match(/hotel|motel|inn|lodge|resort/)) return 'hotel';
		if (name.match(/shop|store|market|mall|boutique/)) return 'shopping';
		if (name.match(/trail|hike|park|canyon|viewpoint|overlook/)) return 'sightseeing';
		return 'activity';
	}

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
				description: place.editorialSummary
			}
		};
		onQuickAdd(metadata);
	}

	function handleScroll() {
		if (!carousel) return;
		const scrollLeft = carousel.scrollLeft;
		const cardWidth = carousel.offsetWidth * 0.82;
		const gap = 12;
		const index = Math.round(scrollLeft / (cardWidth + gap));
		activeIndex = Math.min(Math.max(index, 0), places.length - 1);
	}

	function scrollTo(index: number) {
		if (!carousel) return;
		const cardWidth = carousel.offsetWidth * 0.82;
		const gap = 12;
		carousel.scrollTo({
			left: index * (cardWidth + gap),
			behavior: 'smooth'
		});
	}

	function getPriceLabel(priceLevel?: string): string | null {
		if (!priceLevel) return null;
		return PRICE_LABELS[priceLevel] ?? null;
	}
</script>

<div class="places-carousel">
	<!-- Carousel container -->
	<div
		bind:this={carousel}
		onscroll={handleScroll}
		class="carousel-scroll flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2"
	>
		{#each places as place, i}
			<div class="w-[82%] flex-shrink-0 snap-start overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/60">
				<!-- Photo section -->
				{#if place.photos.length > 0}
					<div class="relative h-[120px] w-full overflow-hidden">
						<img
							src={place.photos[0]}
							alt={place.name}
							class="h-full w-full object-cover"
							loading="lazy"
						/>
						<div class="card-gradient absolute inset-0"></div>

						<!-- Overlay badges -->
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
								{#if getPriceLabel(place.priceLevel)}
									<span class="rounded-full bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300 backdrop-blur-sm">
										{getPriceLabel(place.priceLevel)}
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
				{:else}
					<!-- No photo fallback -->
					<div class="flex h-[120px] w-full items-center justify-center bg-slate-100">
						<svg class="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
						</svg>
					</div>
				{/if}

				<!-- Details section -->
				<div class="p-2.5">
					<p class="truncate text-[13px] font-bold leading-tight text-slate-800">
						{place.name}
					</p>
					{#if place.formattedAddress}
						<p class="mt-0.5 truncate text-[10px] text-slate-400">
							{place.formattedAddress}
						</p>
					{/if}
					{#if place.editorialSummary}
						<p class="mt-1 text-[11px] leading-snug text-slate-500 line-clamp-2">
							{place.editorialSummary}
						</p>
					{/if}
				</div>

				<!-- Quick-add button -->
				{#if dayNumber && onQuickAdd}
					<div class="border-t border-slate-100 px-2.5 py-2">
						<button
							onclick={() => handleQuickAdd(place)}
							class="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary-50 py-1.5 text-xs font-semibold text-primary-600 transition-all hover:bg-primary-100 active:scale-[0.97]"
						>
							<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
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
	{#if showDots}
		<div class="mt-2 flex items-center justify-center gap-1.5">
			{#each places as _, i}
				<button
					onclick={() => scrollTo(i)}
					class="h-1.5 rounded-full transition-all {i === activeIndex ? 'w-4 bg-primary-500' : 'w-1.5 bg-slate-300 hover:bg-slate-400'}"
					aria-label="Go to place {i + 1}"
				></button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.card-gradient {
		background: linear-gradient(
			to bottom,
			transparent 30%,
			rgba(0, 0, 0, 0.15) 55%,
			rgba(0, 0, 0, 0.55) 100%
		);
	}

	.carousel-scroll::-webkit-scrollbar {
		display: none;
	}
	.carousel-scroll {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
</style>
