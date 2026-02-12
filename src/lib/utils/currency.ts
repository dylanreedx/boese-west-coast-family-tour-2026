import type { Activity, Expense, TripMember } from '$lib/types/app';

const formatter = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});

const compactFormatter = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	notation: 'compact',
	maximumFractionDigits: 1
});

export function formatCurrency(amount: number): string {
	return formatter.format(amount);
}

export function formatCurrencyCompact(amount: number): string {
	if (amount < 1000) return formatter.format(amount);
	return compactFormatter.format(amount);
}

export function sumActivityCosts(activities: Activity[]): number {
	return activities.reduce((sum, a) => sum + (a.cost_estimate ?? 0), 0);
}

export function exportExpensesCSV(
	expenses: Expense[],
	members: TripMember[]
): void {
	const memberMap = new Map(members.map((m) => [m.id, m.display_name]));

	const header = 'Date,Title,Category,Amount,Paid By,Notes';
	const rows = expenses.map((e) => {
		const date = e.expense_date ?? '';
		const title = csvEscape(e.title);
		const category = e.category;
		const amount = e.total_amount.toFixed(2);
		const paidBy = csvEscape(memberMap.get(e.paid_by_member_id) ?? 'Unknown');
		const notes = csvEscape(e.notes ?? '');
		return `${date},${title},${category},${amount},${paidBy},${notes}`;
	});

	const csv = [header, ...rows].join('\n');
	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'trip-expenses.csv';
	a.click();
	URL.revokeObjectURL(url);
}

function csvEscape(value: string): string {
	if (value.includes(',') || value.includes('"') || value.includes('\n')) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}
