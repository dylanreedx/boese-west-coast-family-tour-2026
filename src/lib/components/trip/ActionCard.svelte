<script lang="ts">
	import type { ActionMetadata, ActionStatus } from '$lib/types/app';
	import { ACTIVITY_ICONS, ACTIVITY_TYPE_LABELS } from '$lib/utils/activity-icons';

	let {
		metadata,
		messageId,
		onStatusChange,
		onShare,
		isShared = false
	}: {
		metadata: ActionMetadata;
		messageId: string;
		onStatusChange?: () => void;
		onShare?: (messageId: string, metadata: ActionMetadata) => void;
		isShared?: boolean;
	} = $props();

	let loading = $state(false);
	let localStatus = $state<ActionStatus | null>(null);

	const status = $derived(localStatus ?? metadata.status);

	async function handleAction(action: 'approve' | 'dismiss') {
		loading = true;
		localStatus = action === 'approve' ? 'approved' : 'dismissed';
		try {
			const res = await fetch('/api/chat/action', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ messageId, action })
			});
			if (!res.ok) {
				const err = await res.json();
				localStatus = 'pending';
				throw new Error(err.error || 'Action failed');
			}
			onStatusChange?.();
		} catch (e) {
			console.error('Action failed:', e);
		} finally {
			loading = false;
		}
	}
</script>

<div
	class="mt-3 overflow-hidden rounded-xl border transition-all
		{status === 'approved'
			? 'border-emerald-200 bg-emerald-50'
			: status === 'dismissed'
				? 'border-slate-200 bg-slate-50'
				: 'border-amber-200 bg-amber-50'}"
>
	<div class="p-3">
		{#if metadata.action === 'create_activity'}
			{@const icon = ACTIVITY_ICONS[metadata.payload.type ?? 'other']}
			{@const typeLabel = ACTIVITY_TYPE_LABELS[metadata.payload.type ?? 'other']}
			<div class="flex items-start gap-2.5">
				<div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg {status === 'dismissed' ? 'bg-slate-100' : 'bg-white'} text-base shadow-sm">
					{icon}
				</div>
				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-1.5">
						<p class="text-sm font-semibold leading-tight {status === 'dismissed' ? 'text-slate-400 line-through' : 'text-slate-800'}">
							{metadata.payload.title}
						</p>
						{#if status === 'pending'}
							<span class="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
								{typeLabel}
							</span>
						{/if}
					</div>
					<div class="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
						<span>Day {metadata.payload.day_number}</span>
						{#if metadata.payload.start_time}
							<span class="flex items-center gap-0.5">
								<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
								</svg>
								{metadata.payload.start_time}
							</span>
						{/if}
						{#if metadata.payload.location_name}
							<span class="flex items-center gap-0.5">
								<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
									<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0 1 15 0Z" />
								</svg>
								{metadata.payload.location_name}
							</span>
						{/if}
						{#if metadata.payload.cost_estimate}
							<span>${metadata.payload.cost_estimate}</span>
						{/if}
					</div>
					{#if metadata.payload.description && status !== 'dismissed'}
						<p class="mt-1 text-xs leading-relaxed text-slate-500">{metadata.payload.description}</p>
					{/if}
				</div>
			</div>
		{:else if metadata.action === 'add_packing_item'}
			{@const listIcon = metadata.payload.checklist_type === 'packing' ? '🧳' : metadata.payload.checklist_type === 'shopping' ? '🛒' : '📋'}
			<div class="flex items-center gap-2.5">
				<div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg {status === 'dismissed' ? 'bg-slate-100' : 'bg-white'} text-base shadow-sm">
					{listIcon}
				</div>
				<div class="min-w-0 flex-1">
					<p class="text-sm font-semibold {status === 'dismissed' ? 'text-slate-400 line-through' : 'text-slate-800'}">
						{metadata.payload.label}
					</p>
					<p class="text-xs text-slate-500 capitalize">{metadata.payload.checklist_type} list</p>
				</div>
			</div>
		{:else if metadata.action === 'suggest_itinerary_change'}
			<div class="flex items-start gap-2.5">
				<div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white text-base shadow-sm">
					💡
				</div>
				<div>
					<p class="text-xs font-medium text-slate-500">Suggestion for Day {metadata.payload.day_number}</p>
					<p class="mt-0.5 text-sm text-slate-700">{metadata.payload.suggestion_text}</p>
				</div>
			</div>
		{/if}
	</div>

	<!-- Footer: actions or status -->
	{#if status === 'pending' && metadata.action !== 'suggest_itinerary_change'}
		{#if onShare}
			<div class="border-t border-amber-200">
				<button
					onclick={() => onShare?.(messageId, metadata)}
					disabled={loading || isShared}
					class="flex w-full items-center justify-center gap-1.5 py-2 text-xs font-medium text-primary-600 transition-all hover:bg-primary-50 active:scale-[0.98] disabled:opacity-50"
				>
					{#if isShared}
						<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
						</svg>
						Shared to Family
					{:else}
						<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
						</svg>
						Share to Family
					{/if}
				</button>
			</div>
		{/if}
		<div class="flex border-t border-amber-200">
			<button
				onclick={() => handleAction('approve')}
				disabled={loading}
				class="flex flex-1 items-center justify-center gap-1.5 border-r border-amber-200 py-2 text-xs font-semibold text-emerald-600 transition-all hover:bg-emerald-50 active:scale-[0.98] disabled:opacity-50"
			>
				<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
				</svg>
				Add to itinerary
			</button>
			<button
				onclick={() => handleAction('dismiss')}
				disabled={loading}
				class="flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-semibold text-slate-400 transition-all hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
			>
				Dismiss
			</button>
		</div>
	{:else if status === 'approved'}
		<div class="flex items-center gap-1.5 border-t border-emerald-200 bg-emerald-100/50 px-3 py-2 text-xs font-medium text-emerald-700">
			<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
			</svg>
			{#if metadata.action === 'create_activity'}
				Added to Day {metadata.payload.day_number} as tentative
			{:else if metadata.action === 'add_packing_item'}
				Added to {metadata.payload.checklist_type} list
			{:else}
				Noted
			{/if}
		</div>
	{:else if status === 'dismissed'}
		<div class="flex items-center gap-1.5 border-t border-slate-200 px-3 py-2 text-xs text-slate-400">
			<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
			</svg>
			Dismissed
		</div>
	{/if}
</div>
