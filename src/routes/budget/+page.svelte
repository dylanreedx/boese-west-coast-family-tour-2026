<script lang="ts">
	import { daysWithActivitiesQuery } from '$lib/queries/trips';
	import { expensesQuery, tripMembersQuery } from '$lib/queries/expenses';
	import { formatCurrency, formatCurrencyCompact, sumActivityCosts, exportExpensesCSV } from '$lib/utils/currency';
	import { EXPENSE_CATEGORY_ICONS, EXPENSE_CATEGORY_LABELS } from '$lib/types/app';
	import type { ExpenseCategory } from '$lib/types/app';
	import Header from '$lib/components/layout/Header.svelte';
	import BottomNav from '$lib/components/layout/BottomNav.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import SEO from '$lib/components/SEO.svelte';
	import ExpenseEditor from '$lib/components/trip/ExpenseEditor.svelte';

	let { data } = $props();

	const daysWithActivities = daysWithActivitiesQuery(data.supabase);
	const expenses = expensesQuery(data.supabase);
	const members = tripMembersQuery(data.supabase);

	const DAY_EMOJIS = ['✈️', '🏜️', '🌵', '🏔️', '🌉', '🏖️', '🌴', '🏠'];

	let activeTab = $state<'overview' | 'expenses' | 'lists'>('overview');
	let editorOpen = $state(false);

	const allActivities = $derived(
		daysWithActivities.data?.flatMap(d => d.activities ?? []) ?? []
	);
	const tripEstimate = $derived(sumActivityCosts(allActivities));
	const totalExpenses = $derived(
		(expenses.data ?? []).reduce((sum, e) => sum + e.total_amount, 0)
	);

	const memberMap = $derived(
		new Map((members.data ?? []).map(m => [m.id, m.display_name]))
	);

	function handleExport() {
		if (expenses.data && members.data) {
			exportExpensesCSV(expenses.data, members.data);
		}
	}
</script>

<SEO
	title="Budget - Boese West Coast Trip"
	description="Trip budget overview, expense tracking, and cost estimates for the Boese family West Coast road trip."
	ogStyle="bold"
/>

<Header title="Budget" supabase={data.supabase} userEmail={data.session?.user?.email} />

<main class="mx-auto max-w-2xl px-4 pb-24 pt-4">
	<!-- Tab Pills -->
	<div class="flex gap-1 rounded-xl bg-slate-100 p-1">
		{#each ['overview', 'expenses', 'lists'] as tab}
			<button
				onclick={() => activeTab = tab as typeof activeTab}
				class="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all
					{activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}"
			>
				{tab === 'overview' ? 'Overview' : tab === 'expenses' ? 'Expenses' : 'Lists'}
			</button>
		{/each}
	</div>

	<!-- Overview Tab -->
	{#if activeTab === 'overview'}
		<div class="mt-6 space-y-4">
			<!-- Trip Total Card -->
			<div class="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-white shadow-lg">
				<p class="text-sm font-medium text-emerald-100">Trip Estimated Total</p>
				<p class="mt-1 text-3xl font-extrabold">
					{#if daysWithActivities.isLoading}
						<Skeleton class="h-9 w-32 bg-emerald-400/30" />
					{:else}
						{formatCurrency(tripEstimate)}
					{/if}
				</p>
				<div class="mt-3 flex items-center gap-4 text-sm text-emerald-100">
					<span>{allActivities.filter(a => a.cost_estimate != null && a.cost_estimate > 0).length} of {allActivities.length} activities costed</span>
				</div>
				{#if totalExpenses > 0}
					<div class="mt-3 border-t border-emerald-400/30 pt-3">
						<p class="text-sm text-emerald-100">Actual Expenses Logged</p>
						<p class="text-xl font-bold">{formatCurrency(totalExpenses)}</p>
					</div>
				{/if}
			</div>

			<!-- Per-Day Breakdown -->
			{#if daysWithActivities.isLoading}
				{#each Array(4) as _}
					<Skeleton class="h-20" />
				{/each}
			{:else if daysWithActivities.data}
				<h3 class="mt-2 text-sm font-semibold uppercase tracking-wider text-slate-400">Per-Day Breakdown</h3>
				<div class="space-y-2">
					{#each daysWithActivities.data as day}
						{@const activities = day.activities ?? []}
						{@const dayCost = sumActivityCosts(activities)}
						{@const costedCount = activities.filter(a => a.cost_estimate != null && a.cost_estimate > 0).length}
						<a
							href="/day/{day.day_number}"
							class="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm transition-all active:scale-[0.98] hover:shadow-md"
						>
							<span class="text-2xl">{DAY_EMOJIS[(day.day_number - 1) % DAY_EMOJIS.length]}</span>
							<div class="min-w-0 flex-1">
								<div class="flex items-center justify-between">
									<p class="text-sm font-semibold text-slate-900 truncate">{day.title}</p>
									{#if dayCost > 0}
										<span class="ml-2 text-sm font-bold text-emerald-600">{formatCurrencyCompact(dayCost)}</span>
									{:else}
										<span class="ml-2 text-xs text-slate-400">No costs</span>
									{/if}
								</div>
								<p class="text-xs text-slate-500">Day {day.day_number}</p>
								{#if dayCost > 0}
									<!-- Mini cost bar by activity type -->
									{@const typeCosts = activities.reduce((acc, a) => {
										if (a.cost_estimate && a.cost_estimate > 0) {
											const t = a.type ?? 'other';
											acc[t] = (acc[t] ?? 0) + a.cost_estimate;
										}
										return acc;
									}, {} as Record<string, number>)}
									<div class="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-slate-100">
										{#each Object.entries(typeCosts) as [, cost]}
											<div
												class="h-full bg-emerald-400 first:rounded-l-full last:rounded-r-full"
												style="width: {(cost / dayCost) * 100}%"
											></div>
										{/each}
									</div>
									<p class="mt-0.5 text-[10px] text-slate-400">{costedCount} activities costed</p>
								{/if}
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Expenses Tab -->
	{#if activeTab === 'expenses'}
		<div class="mt-6 space-y-4">
			{#if expenses.isLoading}
				{#each Array(3) as _}
					<Skeleton class="h-16" />
				{/each}
			{:else if expenses.data && expenses.data.length > 0}
				<!-- Export Button -->
				<button
					onclick={handleExport}
					class="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-600 transition-all hover:bg-slate-200 active:scale-[0.98]"
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
					</svg>
					Export CSV for Spreadsheet
				</button>

				<!-- Expense List -->
				<div class="space-y-2">
					{#each expenses.data as expense}
						<div class="rounded-xl bg-white p-3 shadow-sm">
							<div class="flex items-start justify-between">
								<div class="flex items-center gap-2">
									<span class="text-lg">{EXPENSE_CATEGORY_ICONS[expense.category as ExpenseCategory]}</span>
									<div>
										<p class="text-sm font-semibold text-slate-900">{expense.title}</p>
										<p class="text-xs text-slate-500">
											{EXPENSE_CATEGORY_LABELS[expense.category as ExpenseCategory]}
											{#if expense.day_number}
												&middot; Day {expense.day_number}
											{/if}
											&middot; {memberMap.get(expense.paid_by_member_id) ?? 'Unknown'}
										</p>
									</div>
								</div>
								<span class="text-sm font-bold text-emerald-600">{formatCurrency(expense.total_amount)}</span>
							</div>
							{#if expense.notes}
								<p class="mt-1 text-xs text-slate-400">{expense.notes}</p>
							{/if}
						</div>
					{/each}
				</div>

				<!-- Total Bar -->
				<div class="rounded-xl bg-emerald-50 p-3 text-center">
					<p class="text-xs font-medium text-emerald-600">Total Logged</p>
					<p class="text-lg font-bold text-emerald-800">{formatCurrency(totalExpenses)}</p>
				</div>
			{:else}
				<!-- Empty State -->
				<div class="mt-8 flex flex-col items-center text-center">
					<div class="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
						<svg class="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
						</svg>
					</div>
					<h3 class="mt-3 text-sm font-semibold text-slate-900">No expenses yet</h3>
					<p class="mt-1 text-xs text-slate-500">Tap the + button to log your first expense</p>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Lists Tab -->
	{#if activeTab === 'lists'}
		<div class="mt-6 space-y-3">
			<a
				href="/packing"
				class="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm transition-all active:scale-[0.98] hover:shadow-md"
			>
				<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50">
					<svg class="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
					</svg>
				</div>
				<div>
					<p class="text-sm font-semibold text-slate-900">Packing & Checklists</p>
					<p class="text-xs text-slate-500">Shared packing lists, to-do items</p>
				</div>
				<svg class="ml-auto h-5 w-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
				</svg>
			</a>
		</div>
	{/if}
</main>

<!-- FAB for adding expenses -->
{#if activeTab === 'expenses'}
	<button
		onclick={() => editorOpen = true}
		class="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg transition-all active:scale-90 hover:bg-emerald-700"
		aria-label="Add expense"
	>
		<svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
		</svg>
	</button>
{/if}

<!-- Expense Editor -->
<ExpenseEditor
	bind:open={editorOpen}
	supabase={data.supabase}
	members={members.data ?? []}
/>

<BottomNav />
