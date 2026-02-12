export const DAY_COLORS = [
	'#ef4444', '#f97316', '#eab308', '#22c55e',
	'#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'
];

export function getDayColor(dayNumber: number): string {
	return DAY_COLORS[(dayNumber - 1) % DAY_COLORS.length];
}
