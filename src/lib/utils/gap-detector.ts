import type { Activity, DayWithActivities } from '$lib/types/app';

export type Gap = {
	type: 'missing_hotel' | 'missing_meal' | 'tbd_item' | 'empty_day';
	message: string;
	dayNumber?: number;
};

export function detectGaps(days: DayWithActivities[]): Gap[] {
	const gaps: Gap[] = [];

	for (const day of days) {
		const activities = day.activities ?? [];
		const dayNum = day.day_number;

		// Empty day (no activities at all)
		if (activities.length === 0) {
			gaps.push({
				type: 'empty_day',
				message: `Day ${dayNum} has no activities planned`,
				dayNumber: dayNum
			});
			continue;
		}

		// Missing hotel (except last day - going home)
		if (dayNum < 8) {
			const hasHotel = activities.some(
				(a) => a.type === 'hotel' && a.status !== 'tbd'
			);
			if (!hasHotel) {
				gaps.push({
					type: 'missing_hotel',
					message: `Day ${dayNum} has no confirmed hotel`,
					dayNumber: dayNum
				});
			}
		}

		// TBD items
		const tbdItems = activities.filter((a) => a.status === 'tbd');
		for (const item of tbdItems) {
			gaps.push({
				type: 'tbd_item',
				message: `"${item.title}" is still TBD`,
				dayNumber: dayNum
			});
		}
	}

	return gaps;
}

export function gapSummary(gaps: Gap[]): { critical: number; warnings: number } {
	const critical = gaps.filter(
		(g) => g.type === 'missing_hotel' || g.type === 'empty_day'
	).length;
	const warnings = gaps.filter((g) => g.type === 'tbd_item').length;
	return { critical, warnings };
}
