<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import type { Database } from '$lib/types/database';
	import type { ExpenseCategory, TripMember } from '$lib/types/app';
	import { EXPENSE_CATEGORY_ICONS, EXPENSE_CATEGORY_LABELS } from '$lib/types/app';
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import { useCreateExpense } from '$lib/queries/expenses';

	let {
		open = $bindable(false),
		supabase,
		members = []
	}: {
		open: boolean;
		supabase: SupabaseClient<Database>;
		members: TripMember[];
	} = $props();

	const createExpense = useCreateExpense(supabase);

	const categories: ExpenseCategory[] = [
		'accommodation', 'food', 'transport', 'activities', 'fuel', 'parking', 'shopping', 'tips', 'other'
	];

	let title = $state('');
	let amount = $state('');
	let category = $state<ExpenseCategory>('other');
	let dayNumber = $state('');
	let paidByMemberId = $state('');
	let notes = $state('');

	// Default paid-by to first member (Dad)
	$effect(() => {
		if (members.length > 0 && !paidByMemberId) {
			paidByMemberId = members[0].id;
		}
	});

	function handleSave() {
		if (!title.trim() || !amount || !paidByMemberId) return;

		const parsedAmount = parseFloat(amount);
		if (isNaN(parsedAmount) || parsedAmount <= 0) return;

		createExpense.mutate({
			title: title.trim(),
			total_amount: parsedAmount,
			category,
			day_number: dayNumber ? parseInt(dayNumber) : null,
			paid_by_member_id: paidByMemberId,
			notes: notes.trim() || null,
			expense_date: new Date().toISOString().split('T')[0],
			trip_id: ''
		});

		open = false;
		resetForm();
	}

	function resetForm() {
		title = '';
		amount = '';
		category = 'other';
		dayNumber = '';
		notes = '';
	}
</script>

<BottomSheet bind:open title="Log Expense">
	<div class="space-y-4">
		<!-- Title -->
		<div>
			<label for="exp-title" class="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">What was it?</label>
			<input
				id="exp-title"
				bind:value={title}
				placeholder="e.g. Ramada Inn, Subway lunch"
				class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-base md:text-sm transition-all focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
			/>
		</div>

		<!-- Amount -->
		<div>
			<label for="exp-amount" class="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">Amount (USD)</label>
			<div class="relative">
				<span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
				<input
					id="exp-amount"
					type="number"
					min="0"
					step="0.01"
					bind:value={amount}
					placeholder="0.00"
					class="w-full rounded-xl border border-slate-200 py-2.5 pl-8 pr-4 text-base md:text-sm transition-all focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
				/>
			</div>
		</div>

		<!-- Category -->
		<div>
			<label class="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400">Category</label>
			<div class="flex flex-wrap gap-2">
				{#each categories as cat}
					<button
						onclick={() => category = cat}
						class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-all active:scale-95
							{category === cat ? 'bg-emerald-100 text-emerald-700 font-medium ring-2 ring-emerald-300' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
					>
						<span>{EXPENSE_CATEGORY_ICONS[cat]}</span>
						<span>{EXPENSE_CATEGORY_LABELS[cat]}</span>
					</button>
				{/each}
			</div>
		</div>

		<!-- Day -->
		<div>
			<label for="exp-day" class="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">Day (optional)</label>
			<select
				id="exp-day"
				bind:value={dayNumber}
				class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-base md:text-sm transition-all focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
			>
				<option value="">No specific day</option>
				{#each Array(8) as _, i}
					<option value={i + 1}>Day {i + 1}</option>
				{/each}
			</select>
		</div>

		<!-- Paid By -->
		<div>
			<label for="exp-paidby" class="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">Paid By</label>
			<select
				id="exp-paidby"
				bind:value={paidByMemberId}
				class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-base md:text-sm transition-all focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
			>
				{#each members as member}
					<option value={member.id}>{member.display_name}</option>
				{/each}
			</select>
		</div>

		<!-- Notes -->
		<div>
			<label for="exp-notes" class="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">Notes (optional)</label>
			<textarea
				id="exp-notes"
				bind:value={notes}
				placeholder="Receipt details, split info..."
				rows="2"
				class="w-full resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-base md:text-sm transition-all focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
			></textarea>
		</div>

		<!-- Save Button -->
		<button
			onclick={handleSave}
			disabled={!title.trim() || !amount || !paidByMemberId}
			class="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
		>
			Log Expense
		</button>
	</div>
</BottomSheet>
