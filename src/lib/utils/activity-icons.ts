import type { ActivityType, ActivityStatus } from '$lib/types/app';

export const ACTIVITY_ICONS: Record<ActivityType, string> = {
	flight: '\u2708\uFE0F',
	drive: '\uD83D\uDE97',
	hotel: '\uD83C\uDFE8',
	restaurant: '\uD83C\uDF7D\uFE0F',
	activity: '\uD83C\uDFAF',
	sightseeing: '\uD83D\uDCF8',
	shopping: '\uD83D\uDECD\uFE0F',
	rest: '\uD83D\uDE34',
	other: '\uD83D\uDCCC'
};

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
	flight: 'Flight',
	drive: 'Drive',
	hotel: 'Hotel',
	restaurant: 'Meal',
	activity: 'Activity',
	sightseeing: 'Sightseeing',
	shopping: 'Shopping',
	rest: 'Rest',
	other: 'Other'
};

export const STATUS_COLORS: Record<ActivityStatus, { bg: string; text: string; border: string }> = {
	confirmed: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
	tentative: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
	tbd: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' }
};

export const STATUS_LABELS: Record<ActivityStatus, string> = {
	confirmed: 'Confirmed',
	tentative: 'Tentative',
	tbd: 'Needs Planning'
};
