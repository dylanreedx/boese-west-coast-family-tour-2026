<script lang="ts">
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { TRIP_ID } from '$lib/types/app';
	import type { Activity, ActivityInsert, ActivityUpdate } from '$lib/types/app';
	import { formatDate, formatDayName } from '$lib/utils/date';
	import ActivityItem from '$lib/components/trip/ActivityItem.svelte';
	import ActivityEditor from '$lib/components/trip/ActivityEditor.svelte';
	import GapBanner from '$lib/components/trip/GapBanner.svelte';
	import Header from '$lib/components/layout/Header.svelte';
	import BottomNav from '$lib/components/layout/BottomNav.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import SEO from '$lib/components/SEO.svelte';
	import { useCreateActivity, useUpdateActivity, useDeleteActivity } from '$lib/queries/activities';
	import { page } from '$app/state';

	let { data } = $props();

	const dayNumber = $derived(Number(page.params.dayNumber));
	const prevDay = $derived(dayNumber > 1 ? dayNumber - 1 : null);
	const nextDay = $derived(dayNumber < 8 ? dayNumber + 1 : null);

	const queryClient = useQueryClient();

	const dayQuery = createQuery(() => ({
		queryKey: ['day', TRIP_ID, dayNumber],
		queryFn: async () => {
			const { data: dayData, error } = await data.supabase
				.from('days')
				.select('*, activities(*, votes(*))')
				.eq('trip_id', TRIP_ID)
				.eq('day_number', dayNumber)
				.order('sort_order', { referencedTable: 'activities' })
				.single();
			if (error) throw error;
			return dayData;
		}
	}));

	// Mutations
	const createActivity = useCreateActivity(data.supabase);
	const updateActivity = useUpdateActivity(data.supabase);
	const deleteActivity = useDeleteActivity(data.supabase);

	// Editor state
	let editorOpen = $state(false);
	let editingActivity = $state<(ActivityUpdate & { id: string }) | null>(null);

	function openCreate() {
		editingActivity = null;
		editorOpen = true;
	}

	function openEdit(activity: Activity) {
		editingActivity = {
			id: activity.id,
			title: activity.title,
			type: activity.type,
			status: activity.status,
			description: activity.description,
			location_name: activity.location_name,
			start_time: activity.start_time,
			day_id: activity.day_id
		};
		editorOpen = true;
	}

	function handleSave(activityData: ActivityInsert | (ActivityUpdate & { id: string })) {
		if ('id' in activityData) {
			updateActivity.mutate(activityData, {
				onSuccess: () => {
					queryClient.invalidateQueries({ queryKey: ['day', TRIP_ID, dayNumber] });
				}
			});
		} else {
			createActivity.mutate(activityData, {
				onSuccess: () => {
					queryClient.invalidateQueries({ queryKey: ['day', TRIP_ID, dayNumber] });
				}
			});
		}
	}

	function handleDelete(id: string, dayId: string) {
		deleteActivity.mutate({ id, dayId }, {
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: ['day', TRIP_ID, dayNumber] });
				editorOpen = false;
			}
		});
	}

	const DAY_EMOJIS = ['✈️', '🏜️', '🌵', '🏔️', '🌉', '🏖️', '🌴', '🏠'];
</script>

<SEO
	title="Day {dayNumber} - Boese West Coast Trip"
	description="Day {dayNumber} itinerary for the Boese family West Coast road trip. View activities, vote on plans, and add comments."
	ogStyle="bold"
/>

<Header title="Day {dayNumber}" supabase={data.supabase} userEmail={data.session?.user?.email} />

<main class="mx-auto max-w-2xl px-4 pb-24 pt-4">
	{#if dayQuery.isLoading}
		<Skeleton class="h-8 w-48 mb-2" />
		<Skeleton class="h-5 w-32 mb-6" />
		{#each Array(5) as _}
			<Skeleton class="h-20 mb-2" />
		{/each}
	{:else if dayQuery.data}
		{@const day = dayQuery.data}
		{@const activities = day.activities ?? []}

		<!-- Day Header -->
		<div class="mb-6">
			<div class="flex items-center gap-3">
				<span class="text-4xl">{DAY_EMOJIS[(dayNumber - 1) % DAY_EMOJIS.length]}</span>
				<div>
					<div class="flex items-center gap-2">
						<span class="rounded-lg bg-primary-100 px-2.5 py-1 text-sm font-bold text-primary-700">
							Day {dayNumber}
						</span>
						{#if activities.filter(a => a.status === 'tbd').length > 0}
							<span class="rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
								{activities.filter(a => a.status === 'tbd').length} TBD
							</span>
						{:else}
							<span class="rounded-lg bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
								All set!
							</span>
						{/if}
					</div>
					<h1 class="mt-1 text-2xl font-extrabold text-slate-900">{day.title}</h1>
					<p class="text-sm text-slate-500">{formatDayName(day.date)}, {formatDate(day.date)}</p>
				</div>
			</div>
			{#if day.subtitle}
				<p class="mt-3 text-sm italic text-slate-400">{day.subtitle}</p>
			{/if}
		</div>

		<!-- Gap Banner -->
		<div class="mb-4">
			<GapBanner {activities} />
		</div>

		<!-- Activities Timeline -->
		<div class="space-y-2">
			{#each activities as activity, i}
				<div style="animation: fadeSlideIn 0.3s ease-out {i * 0.06}s both">
					<ActivityItem
						{activity}
						votes={activity.votes ?? []}
						userId={data.session?.user?.id}
						supabase={data.supabase}
						onclick={() => openEdit(activity)}
					/>
				</div>
			{/each}
		</div>

		<!-- Add Activity Button -->
		<button
			onclick={openCreate}
			class="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-3 text-sm font-medium text-slate-400 transition-all hover:border-primary-300 hover:text-primary-600 active:scale-[0.98]"
		>
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
			</svg>
			Add Activity
		</button>

		<!-- Navigation -->
		<div class="mt-8 flex items-center justify-between">
			{#if prevDay}
				<a
					href="/day/{prevDay}"
					class="flex items-center gap-1 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition-all active:scale-95"
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
					</svg>
					Day {prevDay}
				</a>
			{:else}
				<div></div>
			{/if}

			<a
				href="/"
				class="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition-all active:scale-95"
			>
				All Days
			</a>

			{#if nextDay}
				<a
					href="/day/{nextDay}"
					class="flex items-center gap-1 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all active:scale-95"
				>
					Day {nextDay}
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
					</svg>
				</a>
			{:else}
				<div></div>
			{/if}
		</div>
	{:else if dayQuery.isError}
		<div class="rounded-xl bg-rose-50 p-6 text-center">
			<p class="text-sm text-rose-600">Couldn't load this day. Try refreshing.</p>
		</div>
	{/if}
</main>

<!-- Floating Add Button -->
{#if dayQuery.data}
	<button
		onclick={openCreate}
		class="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg transition-all active:scale-90 hover:bg-primary-700"
		aria-label="Add activity"
	>
		<svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
		</svg>
	</button>
{/if}

<!-- Activity Editor Bottom Sheet -->
{#if dayQuery.data}
	<ActivityEditor
		bind:open={editorOpen}
		dayId={dayQuery.data.id}
		existing={editingActivity}
		supabase={data.supabase}
		onsave={handleSave}
		ondelete={handleDelete}
	/>
{/if}

<BottomNav />

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
