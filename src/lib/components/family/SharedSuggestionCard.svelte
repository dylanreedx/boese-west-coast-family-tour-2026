<script lang="ts">
	import type { ActionMetadata } from '$lib/types/app';
	import { ACTIVITY_ICONS, ACTIVITY_TYPE_LABELS } from '$lib/utils/activity-icons';
	import AiBadge from '$lib/components/trip/AiBadge.svelte';

	let {
		metadata,
		sharerName,
		isOwner = false,
		messageId,
		originalMessageId,
		onApprove,
		onDismiss
	}: {
		metadata: ActionMetadata;
		sharerName: string;
		isOwner?: boolean;
		messageId: string;
		originalMessageId: string;
		onApprove?: (originalMessageId: string) => void;
		onDismiss?: (originalMessageId: string) => void;
	} = $props();
</script>

<div class="overflow-hidden rounded-xl border border-violet-200 bg-white shadow-sm">
	<!-- Header: attribution -->
	<div class="flex items-center gap-2 border-b border-violet-100 bg-violet-50/50 px-3 py-2">
		<AiBadge />
		<span class="text-[10px] text-violet-600">
			{isOwner ? 'Your suggestion' : `Shared by ${sharerName}`} from Local Guide
		</span>
	</div>

	<!-- Content -->
	<div class="p-3">
		{#if metadata.action === 'create_activity'}
			{@const icon = ACTIVITY_ICONS[metadata.payload.type ?? 'other']}
			{@const typeLabel = ACTIVITY_TYPE_LABELS[metadata.payload.type ?? 'other']}
			<div class="flex items-start gap-2.5">
				<div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-50 text-base shadow-sm">
					{icon}
				</div>
				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-1.5">
						<p class="text-sm font-semibold leading-tight text-slate-800">{metadata.payload.title}</p>
						<span class="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
							{typeLabel}
						</span>
					</div>
					<div class="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
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
						<p class="mt-1 text-xs leading-relaxed text-slate-500">{metadata.payload.description}</p>
					{/if}
				</div>
			</div>
		{:else if metadata.action === 'add_packing_item'}
			{@const listIcon = metadata.payload.checklist_type === 'packing' ? '🧳' : metadata.payload.checklist_type === 'shopping' ? '🛒' : '📋'}
			<div class="flex items-center gap-2.5">
				<div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-50 text-base shadow-sm">
					{listIcon}
				</div>
				<div>
					<p class="text-sm font-semibold text-slate-800">{metadata.payload.label}</p>
					<p class="text-xs capitalize text-slate-500">{metadata.payload.checklist_type} list</p>
				</div>
			</div>
		{:else if metadata.action === 'suggest_itinerary_change'}
			<div class="flex items-start gap-2.5">
				<div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-50 text-base shadow-sm">
					💡
				</div>
				<div>
					<p class="text-xs font-medium text-slate-500">Suggestion for Day {metadata.payload.day_number}</p>
					<p class="mt-0.5 text-sm text-slate-700">{metadata.payload.suggestion_text}</p>
				</div>
			</div>
		{/if}
	</div>

	<!-- Footer: owner-only actions -->
	{#if metadata.status === 'pending' && metadata.action !== 'suggest_itinerary_change'}
		{#if isOwner}
			<div class="flex border-t border-violet-200">
				<button
					onclick={() => onApprove?.(originalMessageId)}
					class="flex flex-1 items-center justify-center gap-1.5 border-r border-violet-200 py-2 text-xs font-semibold text-emerald-600 transition-all hover:bg-emerald-50 active:scale-[0.98]"
				>
					<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
					</svg>
					Add to itinerary
				</button>
				<button
					onclick={() => onDismiss?.(originalMessageId)}
					class="flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-semibold text-slate-400 transition-all hover:bg-slate-50 active:scale-[0.98]"
				>
					Dismiss
				</button>
			</div>
		{:else}
			<div class="border-t border-violet-100 px-3 py-2 text-center text-[10px] text-slate-400">
				Only {sharerName} can add this to the itinerary
			</div>
		{/if}
	{:else if metadata.status === 'approved'}
		<div class="flex items-center gap-1.5 border-t border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
			<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
			</svg>
			Added to itinerary
		</div>
	{:else if metadata.status === 'dismissed'}
		<div class="flex items-center gap-1.5 border-t border-slate-200 px-3 py-2 text-xs text-slate-400">
			Dismissed
		</div>
	{/if}
</div>
