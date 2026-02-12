<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import type { Database } from '$lib/types/database';
	import type { ActivityType, ActivityStatus, ActivityInsert, ActivityUpdate } from '$lib/types/app';
	import { ACTIVITY_ICONS, ACTIVITY_TYPE_LABELS } from '$lib/utils/activity-icons';
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import LocationAutocomplete from '$lib/components/ui/LocationAutocomplete.svelte';
	import { useLocationSuggestions } from '$lib/queries/activities';

	let {
		open = $bindable(false),
		dayId,
		existing = null,
		supabase,
		onsave,
		ondelete
	}: {
		open: boolean;
		dayId: string;
		existing?: (ActivityUpdate & { id: string }) | null;
		supabase: SupabaseClient<Database>;
		onsave?: (data: ActivityInsert | (ActivityUpdate & { id: string })) => void;
		ondelete?: (id: string, dayId: string) => void;
	} = $props();

	const locationSuggestions = useLocationSuggestions(supabase);

	const activityTypes: ActivityType[] = ['sightseeing', 'restaurant', 'hotel', 'activity', 'drive', 'flight', 'shopping', 'rest', 'other'];
	const statuses: ActivityStatus[] = ['confirmed', 'tentative', 'tbd'];

	let title = $state('');
	let type = $state<ActivityType>('activity');
	let status = $state<ActivityStatus>('tbd');
	let description = $state('');
	let locationName = $state('');
	let startTime = $state('');
	let costEstimate = $state('');
	let confirmDelete = $state(false);

	// Sync form fields when existing activity changes or editor opens
	$effect(() => {
		if (open) {
			title = existing?.title ?? '';
			type = (existing?.type as ActivityType) ?? 'activity';
			status = (existing?.status as ActivityStatus) ?? 'tbd';
			description = existing?.description ?? '';
			locationName = existing?.location_name ?? '';
			startTime = existing?.start_time ?? '';
			costEstimate = existing?.cost_estimate != null ? String(existing.cost_estimate) : '';
			confirmDelete = false;
		}
	});

	function handleSave() {
		if (!title.trim()) return;

		const parsedCost = costEstimate ? parseFloat(costEstimate) : null;

		const data = {
			title: title.trim(),
			type,
			status,
			description: description.trim() || null,
			location_name: locationName.trim() || null,
			start_time: startTime || null,
			cost_estimate: parsedCost && !isNaN(parsedCost) ? parsedCost : null,
			day_id: dayId
		};

		if (existing?.id) {
			onsave?.({ ...data, id: existing.id });
		} else {
			onsave?.(data as ActivityInsert);
		}

		open = false;
		resetForm();
	}

	function handleDelete() {
		if (!confirmDelete) {
			confirmDelete = true;
			return;
		}
		if (existing?.id) {
			ondelete?.(existing.id, dayId);
		}
		open = false;
		resetForm();
	}

	function resetForm() {
		title = '';
		type = 'activity';
		status = 'tbd';
		description = '';
		locationName = '';
		startTime = '';
		costEstimate = '';
		confirmDelete = false;
	}
</script>

<BottomSheet bind:open title={existing ? 'Edit Activity' : 'Add Activity'}>
	<div class="space-y-4">
		<!-- Type Selector -->
		<div>
			<label class="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400">Type</label>
			<div class="flex flex-wrap gap-2">
				{#each activityTypes as t}
					<button
						onclick={() => type = t}
						class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-all active:scale-95
							{type === t ? 'bg-primary-100 text-primary-700 font-medium ring-2 ring-primary-300' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
					>
						<span>{ACTIVITY_ICONS[t]}</span>
						<span>{ACTIVITY_TYPE_LABELS[t]}</span>
					</button>
				{/each}
			</div>
		</div>

		<!-- Title -->
		<div>
			<label for="act-title" class="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">Title</label>
			<input
				id="act-title"
				bind:value={title}
				placeholder="What's the activity?"
				class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-base md:text-sm transition-all focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
			/>
		</div>

		<!-- Status -->
		<div>
			<label class="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400">Status</label>
			<div class="flex gap-2">
				{#each statuses as s}
					<button
						onclick={() => status = s}
						class="flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-all active:scale-95
							{status === s
								? s === 'confirmed' ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300'
								: s === 'tentative' ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300'
								: 'bg-rose-100 text-rose-700 ring-2 ring-rose-300'
							: 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
					>
						{s === 'confirmed' ? 'Confirmed' : s === 'tentative' ? 'Tentative' : 'TBD'}
					</button>
				{/each}
			</div>
		</div>

		<!-- Time -->
		<div>
			<label for="act-time" class="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">Time (optional)</label>
			<input
				id="act-time"
				type="time"
				bind:value={startTime}
				class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-base md:text-sm transition-all focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
			/>
		</div>

		<!-- Location -->
		<div>
			<label for="act-location" class="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">Location (optional)</label>
			<LocationAutocomplete
				id="act-location"
				bind:value={locationName}
				suggestions={locationSuggestions.data ?? []}
			/>
		</div>

		<!-- Cost -->
		<div>
			<label for="act-cost" class="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">Cost Estimate $ (optional)</label>
			<input
				id="act-cost"
				type="number"
				min="0"
				step="0.01"
				bind:value={costEstimate}
				placeholder="0.00"
				class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-base md:text-sm transition-all focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
			/>
		</div>

		<!-- Description -->
		<div>
			<label for="act-desc" class="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">Notes (optional)</label>
			<textarea
				id="act-desc"
				bind:value={description}
				placeholder="Any details or notes..."
				rows="2"
				class="w-full resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-base md:text-sm transition-all focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
			></textarea>
		</div>

		<!-- Save Button -->
		<button
			onclick={handleSave}
			disabled={!title.trim()}
			class="w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
		>
			{existing ? 'Save Changes' : 'Add to Day'}
		</button>

		<!-- Delete Button (edit mode only) -->
		{#if existing && ondelete}
			<button
				onclick={handleDelete}
				class="w-full rounded-xl px-4 py-3 text-sm font-medium transition-all active:scale-[0.98]
					{confirmDelete ? 'bg-rose-600 text-white' : 'text-rose-500 hover:bg-rose-50'}"
			>
				{confirmDelete ? 'Tap Again to Delete' : 'Delete Activity'}
			</button>
		{/if}
	</div>
</BottomSheet>
