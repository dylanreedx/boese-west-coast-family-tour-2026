<script lang="ts">
	import { daysWithActivitiesQuery, tripQuery } from '$lib/queries/trips';
	import Countdown from '$lib/components/trip/Countdown.svelte';
	import DayCard from '$lib/components/trip/DayCard.svelte';
	import DayTimeline from '$lib/components/trip/DayTimeline.svelte';
	import GapBanner from '$lib/components/trip/GapBanner.svelte';
	import Header from '$lib/components/layout/Header.svelte';
	import BottomNav from '$lib/components/layout/BottomNav.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import { detectGaps, gapSummary } from '$lib/utils/gap-detector';

	let { data } = $props();
	const trip = tripQuery(data.supabase);
	const daysWithActivities = daysWithActivitiesQuery(data.supabase);

	const allActivities = $derived(
		daysWithActivities.data?.flatMap(d => d.activities ?? []) ?? []
	);
	const totalTbd = $derived(allActivities.filter(a => a.status === 'tbd').length);
	const totalConfirmed = $derived(allActivities.filter(a => a.status === 'confirmed').length);
	const totalActivities = $derived(allActivities.length);
	const healthPercent = $derived(
		totalActivities > 0 ? Math.round((totalConfirmed / totalActivities) * 100) : 0
	);
	const gaps = $derived(
		daysWithActivities.data ? detectGaps(daysWithActivities.data) : []
	);
	const gapStats = $derived(gapSummary(gaps));
</script>

<svelte:head>
	<title>Boese West Coast Trip 2026</title>
</svelte:head>

<Header supabase={data.supabase} userEmail={data.session?.user?.email} />

<main class="mx-auto max-w-2xl px-4 pb-24 pt-4">
	<!-- Countdown -->
	{#if trip.data}
		<Countdown startDate={trip.data.start_date} />
	{:else}
		<Skeleton class="h-32" />
	{/if}

	<!-- Trip Health -->
	{#if totalActivities > 0}
		<div class="mt-4 flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
			<div class="relative h-12 w-12">
				<svg class="h-12 w-12 -rotate-90" viewBox="0 0 36 36">
					<path
						class="text-slate-100"
						d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"
						fill="none"
						stroke="currentColor"
						stroke-width="3"
					/>
					<path
						class="{healthPercent >= 70 ? 'text-emerald-500' : healthPercent >= 40 ? 'text-amber-500' : 'text-rose-500'}"
						d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"
						fill="none"
						stroke="currentColor"
						stroke-width="3"
						stroke-dasharray="{healthPercent}, 100"
						stroke-linecap="round"
					/>
				</svg>
				<span class="absolute inset-0 flex items-center justify-center text-xs font-bold">{healthPercent}%</span>
			</div>
			<div class="flex-1">
				<p class="text-sm font-semibold text-slate-900">Trip Planning Progress</p>
				<p class="text-xs text-slate-500">
					{totalConfirmed} confirmed, {totalTbd} TBD{gapStats.critical > 0 ? `, ${gapStats.critical} missing hotel${gapStats.critical === 1 ? '' : 's'}` : ''}
				</p>
			</div>
		</div>
	{/if}

	<!-- Day Cards Scroll -->
	<section class="mt-6">
		<h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Your 8 Days</h2>
		{#if daysWithActivities.isLoading}
			<div class="flex gap-3 overflow-x-auto">
				{#each Array(4) as _}
					<Skeleton class="h-[140px] min-w-[160px]" />
				{/each}
			</div>
		{:else if daysWithActivities.data}
			<div class="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
				{#each daysWithActivities.data as day}
					<DayCard {day} activities={day.activities ?? []} />
				{/each}
			</div>
		{/if}
	</section>

	<!-- Daily Timelines -->
	{#if daysWithActivities.data}
		<section class="mt-8 space-y-8">
			{#each daysWithActivities.data as day}
				<div>
					<GapBanner activities={day.activities ?? []} />
					<div class="mt-2">
						<DayTimeline {day} activities={day.activities ?? []} />
					</div>
				</div>
			{/each}
		</section>
	{/if}
</main>

<BottomNav />

<style>
	.scrollbar-hide::-webkit-scrollbar {
		display: none;
	}
	.scrollbar-hide {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
	.safe-bottom {
		padding-bottom: env(safe-area-inset-bottom);
	}
</style>
