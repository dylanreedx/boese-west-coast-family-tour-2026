<script lang="ts">
	import { ACTIVITY_ICONS } from '$lib/utils/activity-icons';
	import { STATUS_COLORS, STATUS_LABELS } from '$lib/utils/activity-icons';
	import { getDayColor } from '$lib/utils/map-colors';
	import { formatTime } from '$lib/utils/date';
	import { formatCurrency, formatCurrencyCompact } from '$lib/utils/currency';
	import { formatDate, formatDayName } from '$lib/utils/date';

	type DayActivity = {
		title: string;
		type: string | null;
		start_time: string | null;
		location_name: string | null;
		status: string | null;
		cost_estimate: number | null;
		description: string | null;
	};

	type DayData = {
		day_number: number;
		title: string | null;
		date: string;
		activities: DayActivity[];
		activity_count: number;
		total_estimated_cost: number;
	};

	let { data }: { data: DayData } = $props();

	const DAY_LOCATIONS: Record<number, string> = {
		1: 'Detroit to Phoenix',
		2: 'Phoenix',
		3: 'Grand Canyon',
		4: 'Grand Canyon to Las Vegas',
		5: 'Death Valley',
		6: 'San Francisco',
		7: 'Santa Monica / LA',
		8: 'Joshua Tree to Home'
	};

	const dayColor = $derived(getDayColor(data.day_number));
	const displayTitle = $derived(data.title ?? DAY_LOCATIONS[data.day_number] ?? `Day ${data.day_number}`);
	const formattedDate = $derived(`${formatDayName(data.date)}, ${formatDate(data.date)}`);
</script>

<div class="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
	<!-- Color accent bar -->
	<div class="h-1" style="background-color: {dayColor}"></div>

	<!-- Day header -->
	<div class="flex items-center gap-2.5 px-3 pt-2.5 pb-2">
		<div
			class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
			style="background-color: {dayColor}"
		>
			{data.day_number}
		</div>
		<div class="min-w-0 flex-1">
			<p class="text-sm font-semibold leading-tight text-slate-900">{displayTitle}</p>
			<p class="text-[11px] text-slate-500">{formattedDate}</p>
		</div>
		{#if data.total_estimated_cost > 0}
			<span class="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/60">
				{formatCurrencyCompact(data.total_estimated_cost)}
			</span>
		{/if}
	</div>

	<!-- Activities list -->
	{#if data.activities.length > 0}
		<div class="divide-y divide-slate-100 border-t border-slate-100">
			{#each data.activities as activity}
				{@const icon = ACTIVITY_ICONS[(activity.type as keyof typeof ACTIVITY_ICONS) ?? 'other'] ?? ACTIVITY_ICONS['other']}
				{@const showStatus = activity.status && activity.status !== 'confirmed'}
				<div class="flex items-center gap-2 px-3 py-2">
					<span class="flex-shrink-0 text-sm">{icon}</span>
					<div class="min-w-0 flex-1">
						<p class="truncate text-[13px] font-medium leading-tight text-slate-800">
							{activity.title}
						</p>
						{#if activity.location_name}
							<p class="truncate text-[11px] text-slate-400">{activity.location_name}</p>
						{/if}
					</div>
					<div class="flex flex-shrink-0 items-center gap-1.5">
						{#if activity.start_time}
							<span class="text-[11px] text-slate-400">{formatTime(activity.start_time)}</span>
						{/if}
						{#if activity.cost_estimate}
							<span class="text-[11px] font-medium text-emerald-600">
								{formatCurrency(activity.cost_estimate)}
							</span>
						{/if}
						{#if showStatus}
							{@const statusKey = activity.status as keyof typeof STATUS_COLORS}
							{@const colors = STATUS_COLORS[statusKey]}
							{@const label = STATUS_LABELS[statusKey]}
							{#if colors && label}
								<span class="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium {colors.bg} {colors.text} ring-1 {colors.border}">
									{label}
								</span>
							{/if}
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="border-t border-slate-100 px-3 py-3 text-center text-xs text-slate-400">
			No activities planned yet
		</div>
	{/if}

	<!-- Footer -->
	<div class="flex items-center justify-between border-t border-slate-100 px-3 py-2">
		<span class="text-[11px] text-slate-400">
			{data.activity_count} {data.activity_count === 1 ? 'activity' : 'activities'}
		</span>
		<a
			href="/day/{data.day_number}"
			class="flex items-center gap-0.5 text-[11px] font-medium text-primary-600 transition-colors hover:text-primary-700"
		>
			View full day
			<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
			</svg>
		</a>
	</div>
</div>
