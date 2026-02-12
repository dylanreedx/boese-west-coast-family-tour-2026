<script lang="ts">
	import type { Day, Activity } from '$lib/types/app';
	import { formatDate, formatDayName } from '$lib/utils/date';
	import { formatCurrencyCompact, sumActivityCosts } from '$lib/utils/currency';

	let { day, activities = [], active = false }: {
		day: Day;
		activities?: Activity[];
		active?: boolean;
	} = $props();

	const confirmedCount = $derived(activities.filter(a => a.status === 'confirmed').length);
	const tbdCount = $derived(activities.filter(a => a.status === 'tbd').length);
	const totalCount = $derived(activities.length);
	const progress = $derived(totalCount > 0 ? Math.round((confirmedCount / totalCount) * 100) : 0);

	const dayCost = $derived(sumActivityCosts(activities));

	const DAY_EMOJIS = ['✈️', '🏜️', '🌵', '🏔️', '🌉', '🏖️', '🌴', '🏠'];
	const emoji = $derived(DAY_EMOJIS[(day.day_number - 1) % DAY_EMOJIS.length]);
</script>

<a
	href="/day/{day.day_number}"
	class="group block min-w-[160px] snap-start rounded-2xl border-2 p-4 transition-all active:scale-[0.97]
		{active ? 'border-primary-400 bg-primary-50 shadow-md shadow-primary-100' : 'border-slate-200 bg-white shadow-sm hover:border-primary-200 hover:shadow-md'}"
>
	<div class="flex items-start justify-between">
		<span class="text-2xl">{emoji}</span>
		<span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
			Day {day.day_number}
		</span>
	</div>

	<p class="mt-3 text-sm font-semibold text-slate-900 leading-tight">{day.title}</p>
	<p class="mt-0.5 text-xs text-slate-500">{formatDayName(day.date)}, {formatDate(day.date)}</p>

	<div class="mt-3 flex items-center gap-2">
		<div class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
			<div
				class="h-full rounded-full transition-all duration-500
					{progress === 100 ? 'bg-emerald-500' : progress > 50 ? 'bg-amber-400' : 'bg-rose-400'}"
				style="width: {progress}%"
			></div>
		</div>
		{#if tbdCount > 0}
			<span class="text-[10px] font-medium text-rose-500">{tbdCount} TBD</span>
		{:else}
			<span class="text-[10px] font-medium text-emerald-600">All set</span>
		{/if}
	</div>

	{#if dayCost > 0}
		<p class="mt-1.5 text-[10px] font-medium text-emerald-600">{formatCurrencyCompact(dayCost)} est.</p>
	{/if}
</a>
