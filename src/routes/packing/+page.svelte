<script lang="ts">
	import Header from '$lib/components/layout/Header.svelte';
	import BottomNav from '$lib/components/layout/BottomNav.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import SEO from '$lib/components/SEO.svelte';
	import AiBadge from '$lib/components/trip/AiBadge.svelte';
	import {
		checklistsQuery,
		useCreateChecklist,
		useCreateChecklistItem,
		useToggleChecklistItem,
		useDeleteChecklistItem
	} from '$lib/queries/checklists';

	let { data } = $props();
	const userId = $derived(data.session?.user?.id);

	const checklists = checklistsQuery(data.supabase);
	const createChecklist = useCreateChecklist(data.supabase);
	const createItem = useCreateChecklistItem(data.supabase);
	const toggleItem = useToggleChecklistItem(data.supabase);
	const deleteItem = useDeleteChecklistItem(data.supabase);

	// New checklist form
	let showNewList = $state(false);
	let newListTitle = $state('');
	let newListType = $state<'packing' | 'todo' | 'shopping'>('packing');

	// Per-checklist new item inputs
	let newItemLabels = $state<Record<string, string>>({});

	function addChecklist() {
		if (!newListTitle.trim() || !userId) return;
		createChecklist.mutate(
			{ title: newListTitle.trim(), type: newListType, userId },
			{
				onSuccess: () => {
					newListTitle = '';
					showNewList = false;
				}
			}
		);
	}

	function addItem(checklistId: string) {
		const label = newItemLabels[checklistId]?.trim();
		if (!label) return;
		createItem.mutate(
			{ checklistId, label },
			{ onSuccess: () => { newItemLabels[checklistId] = ''; } }
		);
	}

	function toggle(id: string, currentValue: boolean) {
		if (!userId) return;
		toggleItem.mutate({ id, isChecked: !currentValue, userId });
	}

	const TYPE_ICONS: Record<string, string> = {
		packing: '🧳',
		todo: '📋',
		shopping: '🛒'
	};

	function progress(items: { is_checked: boolean }[]): number {
		if (items.length === 0) return 0;
		return Math.round((items.filter((i) => i.is_checked).length / items.length) * 100);
	}
</script>

<SEO
	title="Packing & Lists - Boese West Coast Trip"
	description="Shared packing lists and checklists for the Boese family West Coast road trip."
	ogStyle="bold"
/>

<Header title="Packing & Lists" supabase={data.supabase} userEmail={data.session?.user?.email} />

<main class="mx-auto max-w-2xl px-4 pb-24 pt-4">
	{#if checklists.isLoading}
		{#each Array(3) as _}
			<Skeleton class="mb-4 h-40" />
		{/each}
	{:else if checklists.data}
		<div class="space-y-4">
			{#each checklists.data as checklist}
				{@const items = checklist.checklist_items ?? []}
				{@const pct = progress(items)}
				<div class="rounded-2xl bg-white p-4 shadow-sm">
					<!-- Header -->
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span class="text-lg">{TYPE_ICONS[checklist.type ?? 'packing']}</span>
							<h3 class="font-bold text-slate-900">{checklist.title}</h3>
						</div>
						<div class="flex items-center gap-2">
							<span class="text-xs font-medium {pct === 100 ? 'text-emerald-600' : 'text-slate-400'}">
								{items.filter(i => i.is_checked).length}/{items.length}
							</span>
							<!-- Progress ring -->
							<div class="relative h-8 w-8">
								<svg class="h-8 w-8 -rotate-90" viewBox="0 0 36 36">
									<path
										class="text-slate-100"
										d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"
										fill="none"
										stroke="currentColor"
										stroke-width="3.5"
									/>
									<path
										class="{pct === 100 ? 'text-emerald-500' : 'text-primary-500'}"
										d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"
										fill="none"
										stroke="currentColor"
										stroke-width="3.5"
										stroke-dasharray="{pct}, 100"
										stroke-linecap="round"
									/>
								</svg>
							</div>
						</div>
					</div>

					<!-- Items -->
					<div class="mt-3 space-y-1">
						{#each items as item}
							<div class="group flex items-center gap-2 rounded-lg px-1 py-1.5 hover:bg-slate-50">
								<button
									onclick={() => toggle(item.id, item.is_checked)}
									class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-all
										{item.is_checked ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 hover:border-primary-400'}"
								>
									{#if item.is_checked}
										<svg class="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
										</svg>
									{/if}
								</button>
								<span class="flex flex-1 items-center gap-1.5 text-sm {item.is_checked ? 'text-slate-400 line-through' : 'text-slate-700'}">
									{item.label}
									{#if item.source === 'ai-guide'}
										<AiBadge />
									{/if}
								</span>
								<button
									onclick={() => deleteItem.mutate({ id: item.id })}
									class="text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-rose-500"
								>
									<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
									</svg>
								</button>
							</div>
						{/each}
					</div>

					<!-- Add Item -->
					{#if userId}
						<div class="mt-2 flex gap-2">
							<input
								bind:value={newItemLabels[checklist.id]}
								onkeydown={(e) => { if (e.key === 'Enter') addItem(checklist.id); }}
								placeholder="Add item..."
								class="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm transition-all focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
							/>
							<button
								onclick={() => addItem(checklist.id)}
								disabled={!newItemLabels[checklist.id]?.trim()}
								class="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition-all active:scale-95 disabled:opacity-50"
							>
								Add
							</button>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Empty state -->
		{#if checklists.data.length === 0}
			<div class="rounded-2xl bg-white p-8 text-center shadow-sm">
				<span class="text-4xl">📋</span>
				<h2 class="mt-3 text-lg font-bold text-slate-900">No lists yet</h2>
				<p class="mt-1 text-sm text-slate-500">Create a packing list or to-do list to get started.</p>
			</div>
		{/if}

		<!-- New Checklist -->
		{#if userId}
			{#if showNewList}
				<div class="mt-4 rounded-2xl bg-white p-4 shadow-sm">
					<h3 class="font-bold text-slate-900">New List</h3>
					<div class="mt-3 space-y-3">
						<input
							bind:value={newListTitle}
							placeholder="List name..."
							class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm transition-all focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
						/>
						<div class="flex gap-2">
							{#each [['packing', '🧳 Packing'], ['todo', '📋 To-Do'], ['shopping', '🛒 Shopping']] as [type, label]}
								<button
									onclick={() => newListType = type as typeof newListType}
									class="flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-all active:scale-95
										{newListType === type ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-300' : 'bg-slate-100 text-slate-600'}"
								>
									{label}
								</button>
							{/each}
						</div>
						<div class="flex gap-2">
							<button
								onclick={() => showNewList = false}
								class="flex-1 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-600 transition-all active:scale-95"
							>
								Cancel
							</button>
							<button
								onclick={addChecklist}
								disabled={!newListTitle.trim()}
								class="flex-1 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-50"
							>
								Create
							</button>
						</div>
					</div>
				</div>
			{:else}
				<button
					onclick={() => showNewList = true}
					class="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-3 text-sm font-medium text-slate-400 transition-all hover:border-primary-300 hover:text-primary-600 active:scale-[0.98]"
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
					</svg>
					New List
				</button>
			{/if}
		{/if}
	{:else if checklists.isError}
		<div class="rounded-xl bg-rose-50 p-6 text-center">
			<p class="text-sm text-rose-600">Couldn't load lists. Try refreshing.</p>
		</div>
	{/if}
</main>

<BottomNav />
