<script lang="ts">
	import type { Day, Activity } from '$lib/types/app';
	import { formatDate, formatDayName } from '$lib/utils/date';
	import ActivityItem from './ActivityItem.svelte';

	let { day, activities }: { day: Day; activities: Activity[] } = $props();

	const tbdCount = $derived(activities.filter(a => a.status === 'tbd').length);
</script>

<div>
	<!-- Day Header -->
	<div class="mb-4 flex items-end justify-between">
		<div>
			<div class="flex items-center gap-2">
				<span class="rounded-lg bg-primary-100 px-2 py-0.5 text-sm font-bold text-primary-700">
					Day {day.day_number}
				</span>
				{#if tbdCount > 0}
					<span class="rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
						{tbdCount} need{tbdCount === 1 ? 's' : ''} planning
					</span>
				{/if}
			</div>
			<h2 class="mt-1 text-xl font-bold text-slate-900">{day.title}</h2>
			<p class="text-sm text-slate-500">{formatDayName(day.date)}, {formatDate(day.date)}</p>
		</div>
	</div>

	{#if day.subtitle}
		<p class="mb-4 text-sm italic text-slate-400">{day.subtitle}</p>
	{/if}

	<!-- Timeline -->
	<div class="relative space-y-1">
		<!-- Vertical line -->
		<div class="absolute left-[1.19rem] top-4 bottom-4 w-0.5 bg-slate-100"></div>

		{#each activities as activity, i}
			<div class="relative" style="animation: fadeSlideIn 0.3s ease-out {i * 0.05}s both">
				<ActivityItem {activity} compact={true} />
			</div>
		{/each}
	</div>
</div>

<style>
	@keyframes fadeSlideIn {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
