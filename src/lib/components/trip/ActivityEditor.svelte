<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import type { Database } from '$lib/types/database';
	import type { ActivityType, ActivityStatus, ActivityInsert, ActivityUpdate, PlaceDetails } from '$lib/types/app';
	import { ACTIVITY_ICONS, ACTIVITY_TYPE_LABELS } from '$lib/utils/activity-icons';
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import PlacePicker from '$lib/components/trip/PlacePicker.svelte';

	let {
		open = $bindable(false),
		dayId,
		dayNumber = 1,
		existing = null,
		supabase,
		onsave,
		ondelete
	}: {
		open: boolean;
		dayId: string;
		dayNumber?: number;
		existing?: (ActivityUpdate & { id: string }) | null;
		supabase: SupabaseClient<Database>;
		onsave?: (data: ActivityInsert | (ActivityUpdate & { id: string })) => void;
		ondelete?: (id: string, dayId: string) => void;
	} = $props();

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
	let googlePlaceId = $state<string | null>(null);
	let latitude = $state<number | null>(null);
	let longitude = $state<number | null>(null);
	let locationAddress = $state<string | null>(null);
	let imageUrl = $state<string | null>(null);
	let placePickerOpen = $state(false);

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
			googlePlaceId = existing?.google_place_id ?? null;
			latitude = existing?.latitude ?? null;
			longitude = existing?.longitude ?? null;
			locationAddress = existing?.location_address ?? null;
			imageUrl = existing?.image_url ?? null;
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
			day_id: dayId,
			google_place_id: googlePlaceId,
			latitude,
			longitude,
			location_address: locationAddress,
			image_url: imageUrl
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

	function handlePlaceSelect(place: PlaceDetails) {
		googlePlaceId = place.googlePlaceId ?? null;
		locationName = place.name;
		locationAddress = place.formattedAddress ?? null;
		latitude = place.location?.lat ?? null;
		longitude = place.location?.lng ?? null;
		imageUrl = place.photos?.[0] ?? null;
		placePickerOpen = false;
	}

	function clearPlace() {
		googlePlaceId = null;
		latitude = null;
		longitude = null;
		locationAddress = null;
		imageUrl = null;
		locationName = '';
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
		googlePlaceId = null;
		latitude = null;
		longitude = null;
		locationAddress = null;
		imageUrl = null;
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
			<label class="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400">Location</label>
			{#if googlePlaceId && locationName}
				<!-- Selected place chip -->
				<div class="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
					{#if imageUrl}
						<img src={imageUrl} alt="" class="h-10 w-14 flex-shrink-0 rounded-lg object-cover" />
					{:else}
						<div class="flex h-10 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-slate-200">
							<svg class="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
								<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0 1 15 0Z" />
							</svg>
						</div>
					{/if}
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-semibold text-slate-800">{locationName}</p>
						{#if locationAddress}
							<p class="truncate text-[11px] text-slate-400">{locationAddress}</p>
						{/if}
					</div>
					<div class="flex items-center gap-1">
						<button type="button" onclick={() => placePickerOpen = true} class="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600">
							<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" />
							</svg>
						</button>
						<button type="button" onclick={clearPlace} class="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-rose-100 hover:text-rose-500">
							<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
				</div>
			{:else}
				<!-- "Find a spot" card -->
				<button
					type="button"
					onclick={() => placePickerOpen = true}
					class="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 px-4 py-3 transition-all hover:border-primary-300 hover:bg-primary-50/30 active:scale-[0.98]"
				>
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
						<svg class="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
							<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0 1 15 0Z" />
						</svg>
					</div>
					<div class="text-left">
						<p class="text-sm font-semibold text-slate-700">Find a spot</p>
						<p class="text-[11px] text-slate-400">Search places on the map</p>
					</div>
				</button>
			{/if}
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

<PlacePicker bind:open={placePickerOpen} {dayNumber} onSelect={handlePlaceSelect} />
