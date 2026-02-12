<script lang="ts">
	import type { Activity, Vote } from '$lib/types/app';
	import type { SupabaseClient } from '@supabase/supabase-js';
	import type { Database } from '$lib/types/database';
	import { ACTIVITY_ICONS } from '$lib/utils/activity-icons';
	import { formatTime, formatDuration } from '$lib/utils/date';
	import { formatCurrency } from '$lib/utils/currency';
	import Badge from '$lib/components/ui/Badge.svelte';
	import AiBadge from '$lib/components/trip/AiBadge.svelte';
	import PlaceCard from '$lib/components/trip/PlaceCard.svelte';
	import VoteButtons from '$lib/components/trip/VoteButtons.svelte';
	import CommentThread from '$lib/components/trip/CommentThread.svelte';

	let showComments = $state(false);

	let {
		activity,
		votes = [],
		compact = false,
		onclick,
		userId,
		supabase,
		allActivities,
		dayNumber
	}: {
		activity: Activity;
		votes?: Vote[];
		compact?: boolean;
		onclick?: () => void;
		userId?: string | null;
		supabase?: SupabaseClient<Database>;
		allActivities?: Activity[];
		dayNumber?: number;
	} = $props();

	const icon = $derived(ACTIVITY_ICONS[activity.type ?? 'other']);
	const isDrive = $derived(activity.type === 'drive');
</script>

{#if isDrive && compact}
	<!-- Compact drive segment -->
	<div class="flex items-center gap-2 py-1.5 pl-8">
		<div class="h-px flex-1 bg-slate-200"></div>
		<span class="flex items-center gap-1 text-xs text-slate-400">
			<span>{icon}</span>
			{#if activity.duration_minutes}
				<span>{formatDuration(activity.duration_minutes)}</span>
			{/if}
		</span>
		<div class="h-px flex-1 bg-slate-200"></div>
	</div>
{:else}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		{onclick}
		class="group relative flex gap-3 rounded-xl p-3 transition-all active:scale-[0.98]
			{onclick ? 'cursor-pointer' : ''}
			{activity.status === 'tbd' ? 'border border-dashed border-amber-300 bg-amber-50/50' : 'bg-white'}"
	>
		<!-- Icon -->
		<div class="flex flex-col items-center">
			<div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg">
				{icon}
			</div>
			{#if activity.start_time}
				<span class="mt-1 text-[10px] font-medium text-slate-400">
					{formatTime(activity.start_time)}
				</span>
			{/if}
		</div>

		<!-- Content -->
		<div class="min-w-0 flex-1">
			<div class="flex items-start justify-between gap-2">
				<div class="flex items-center gap-1.5">
					<h3 class="font-semibold text-slate-900 leading-tight">{activity.title}</h3>
					{#if activity.source === 'ai-guide'}
						<AiBadge />
					{/if}
				</div>
				{#if activity.status}
					<Badge status={activity.status} />
				{/if}
			</div>

			{#if activity.description}
				<p class="mt-1 text-sm text-slate-500 leading-snug line-clamp-2">{activity.description}</p>
			{/if}

			<div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
				{#if activity.location_name}
					<span class="flex items-center gap-1 text-xs text-slate-400">
						<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
							<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0 1 15 0Z" />
						</svg>
						{activity.location_name}
					</span>
				{/if}
				{#if activity.duration_minutes}
					<span class="flex items-center gap-1 text-xs text-slate-400">
						<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
						</svg>
						{formatDuration(activity.duration_minutes)}
					</span>
				{/if}
				{#if activity.cost_estimate}
					<span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
						<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
						</svg>
						{formatCurrency(activity.cost_estimate)}
					</span>
				{/if}
			</div>

			{#if !isDrive && activity.location_name}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="mt-2" onclick={(e) => e.stopPropagation()}>
					<PlaceCard
						title={activity.title}
						locationName={activity.location_name}
						mapActivities={allActivities}
						currentActivityId={activity.id}
						{dayNumber}
						defaultExpanded={false}
					/>
				</div>
			{/if}

			{#if supabase}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="mt-2 flex items-center gap-2" onclick={(e) => e.stopPropagation()}>
					<VoteButtons activityId={activity.id} {votes} {userId} {supabase} />
					<button
						onclick={() => showComments = !showComments}
						class="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-slate-400 transition-all hover:bg-slate-100"
					>
						<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
						</svg>
						Chat
					</button>
				</div>

				{#if showComments}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="mt-3 border-t border-slate-100 pt-3" onclick={(e) => e.stopPropagation()}>
						<CommentThread activityId={activity.id} {userId} {supabase} />
					</div>
				{/if}
			{/if}
		</div>
	</div>
{/if}
