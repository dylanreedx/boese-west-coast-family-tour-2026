<script lang="ts">
	import type { ActionMetadata } from '$lib/types/app';
	import { EXPENSE_CATEGORY_ICONS } from '$lib/types/app';
	import { ACTIVITY_ICONS, ACTIVITY_TYPE_LABELS } from '$lib/utils/activity-icons';
	import PlaceCard from '$lib/components/trip/PlaceCard.svelte';

	let {
		metadata,
		sharerName,
		isOwner = false
	}: {
		metadata: ActionMetadata;
		sharerName: string;
		isOwner?: boolean;
	} = $props();
</script>

<!-- Glimpse card: a peek into the guide chat -->
<div class="overflow-hidden rounded-xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50/80 via-white to-violet-50/60 shadow-sm">
	<!-- Header: guide attribution with sparkle -->
	<div class="flex items-center gap-1.5 px-3 py-1.5" style="background: linear-gradient(135deg, rgba(139,92,246,0.08), rgba(99,102,241,0.06))">
		<svg class="h-3 w-3 text-violet-500" fill="currentColor" viewBox="0 0 24 24">
			<path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
		</svg>
		<span class="text-[10px] font-medium text-violet-600/90">
			{isOwner ? 'You shared' : sharerName + ' shared'} from Local Guide
		</span>
	</div>

	<!-- Content -->
	<div class="px-3 py-2.5">
		{#if metadata.action === 'create_activity'}
			{@const icon = ACTIVITY_ICONS[metadata.payload.type ?? 'other']}
			{@const typeLabel = ACTIVITY_TYPE_LABELS[metadata.payload.type ?? 'other']}
			<div class="flex items-start gap-2.5">
				<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/80 text-sm shadow-sm ring-1 ring-indigo-100/50">
					{icon}
				</div>
				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-1.5">
						<p class="text-[13px] font-semibold leading-tight text-slate-800">{metadata.payload.title}</p>
						<span class="inline-flex items-center rounded-full border border-indigo-200/60 bg-indigo-50/60 px-1.5 py-0.5 text-[9px] font-medium text-indigo-600">
							{typeLabel}
						</span>
					</div>
					<div class="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
						<span>Day {metadata.payload.day_number}</span>
						{#if metadata.payload.start_time}
							<span>{metadata.payload.start_time}</span>
						{/if}
						{#if metadata.payload.location_name}
							<span>{metadata.payload.location_name}</span>
						{/if}
						{#if metadata.payload.cost_estimate}
							<span>${metadata.payload.cost_estimate}</span>
						{/if}
					</div>
					{#if metadata.payload.description}
						<p class="mt-1 text-[11px] leading-relaxed text-slate-500">{metadata.payload.description}</p>
					{/if}
				</div>
			</div>
		{:else if metadata.action === 'add_packing_item'}
			{@const listIcon = metadata.payload.checklist_type === 'packing' ? '🧳' : metadata.payload.checklist_type === 'shopping' ? '🛒' : '📋'}
			<div class="flex items-center gap-2.5">
				<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/80 text-sm shadow-sm ring-1 ring-indigo-100/50">
					{listIcon}
				</div>
				<div>
					<p class="text-[13px] font-semibold text-slate-800">{metadata.payload.label}</p>
					<p class="text-[11px] capitalize text-slate-500">{metadata.payload.checklist_type} list</p>
				</div>
			</div>
		{:else if metadata.action === 'suggest_itinerary_change'}
			<div class="flex items-start gap-2.5">
				<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/80 text-sm shadow-sm ring-1 ring-indigo-100/50">
					💡
				</div>
				<div>
					<p class="text-[11px] font-medium text-slate-500">Suggestion for Day {metadata.payload.day_number}</p>
					<p class="mt-0.5 text-[13px] text-slate-700">{metadata.payload.suggestion_text}</p>
				</div>
			</div>
		{:else if metadata.action === 'replace_activity'}
			<div class="flex items-start gap-2.5">
				<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/80 text-sm shadow-sm ring-1 ring-indigo-100/50">
					🔄
				</div>
				<div class="min-w-0 flex-1">
					<p class="text-[11px] font-medium text-slate-500">Replace on Day {metadata.payload.day_number}</p>
					<div class="mt-0.5 flex items-center gap-1.5 text-[13px]">
						<span class="text-red-400 line-through">{metadata.payload.old_title}</span>
						<span class="text-slate-400">→</span>
						<span class="font-semibold text-slate-800">{metadata.payload.new_title}</span>
					</div>
				</div>
			</div>
		{:else if metadata.action === 'delete_activity'}
			<div class="flex items-start gap-2.5">
				<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/80 text-sm shadow-sm ring-1 ring-indigo-100/50">
					🗑️
				</div>
				<div>
					<p class="text-[11px] font-medium text-slate-500">Remove from Day {metadata.payload.day_number}</p>
					<p class="mt-0.5 text-[13px] font-semibold text-slate-800">{metadata.payload.activity_title}</p>
				</div>
			</div>
		{:else if metadata.action === 'update_activity'}
			<div class="flex items-start gap-2.5">
				<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/80 text-sm shadow-sm ring-1 ring-indigo-100/50">
					✏️
				</div>
				<div>
					<p class="text-[13px] font-semibold text-slate-800">{metadata.payload.activity_title}</p>
					<p class="text-[11px] text-slate-500">Update on Day {metadata.payload.day_number}</p>
				</div>
			</div>
		{:else if metadata.action === 'log_expense'}
			{@const catIcon = EXPENSE_CATEGORY_ICONS[metadata.payload.category] ?? '📦'}
			<div class="flex items-start gap-2.5">
				<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/80 text-sm shadow-sm ring-1 ring-indigo-100/50">
					{catIcon}
				</div>
				<div>
					<div class="flex items-center gap-1.5">
						<p class="text-[13px] font-semibold text-slate-800">{metadata.payload.title}</p>
						<span class="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">${metadata.payload.amount.toFixed(2)}</span>
					</div>
					<p class="text-[11px] capitalize text-slate-500">{metadata.payload.category}</p>
				</div>
			</div>
		{:else if metadata.action === 'record_payment'}
			<div class="flex items-start gap-2.5">
				<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/80 text-sm shadow-sm ring-1 ring-indigo-100/50">
					💸
				</div>
				<div>
					<div class="flex items-center gap-1.5 text-[13px] font-semibold text-slate-800">
						<span>{metadata.payload.from_name}</span>
						<span class="text-slate-400">→</span>
						<span>{metadata.payload.to_name}</span>
						<span class="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">${metadata.payload.amount.toFixed(2)}</span>
					</div>
					{#if metadata.payload.method}
						<p class="text-[11px] capitalize text-slate-500">{metadata.payload.method}</p>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	<!-- Discovery links for activity suggestions -->
	{#if metadata.action === 'create_activity' && metadata.status !== 'dismissed'}
		<div class="border-t border-indigo-100/60 px-3">
			<PlaceCard title={metadata.payload.title} locationName={metadata.payload.location_name} dayNumber={metadata.payload.day_number} />
		</div>
	{/if}

	<!-- Status footer -->
	{#if metadata.status === 'approved'}
		<div class="flex items-center gap-1.5 border-t border-emerald-200/60 bg-emerald-50/50 px-3 py-1.5 text-[11px] font-medium text-emerald-700">
			<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
			</svg>
			{#if metadata.action === 'create_activity'}
				Added to itinerary
			{:else if metadata.action === 'replace_activity'}
				Activity replaced
			{:else if metadata.action === 'delete_activity'}
				Activity removed
			{:else if metadata.action === 'update_activity'}
				Activity updated
			{:else if metadata.action === 'add_packing_item'}
				Added to list
			{:else if metadata.action === 'log_expense'}
				Expense logged
			{:else if metadata.action === 'record_payment'}
				Payment recorded
			{:else}
				Approved
			{/if}
		</div>
	{:else if metadata.status === 'dismissed'}
		<div class="flex items-center gap-1.5 border-t border-slate-200/60 px-3 py-1.5 text-[11px] text-slate-400">
			<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
			</svg>
			Dismissed
		</div>
	{:else if metadata.status === 'pending'}
		<div class="border-t border-indigo-100/60 px-3 py-1.5">
			<p class="text-center text-[10px] text-slate-400">
				{#if isOwner}
					Open <a href="/guide" class="font-medium text-indigo-500 hover:text-indigo-600">your Guide</a> to add to itinerary
				{:else}
					{sharerName} can add this from their Guide
				{/if}
			</p>
		</div>
	{/if}
</div>
