import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createServiceClient } from '$lib/server/supabase';
import { TRIP_ID } from '$lib/types/app';

const cache = new Map<number, { activities: any[]; ts: number }>();
const CACHE_TTL = 1000 * 60 * 5;

export const GET: RequestHandler = async ({ params, cookies }) => {
	const dayNumber = Number(params.dayNumber);
	if (!dayNumber || dayNumber < 1 || dayNumber > 8) return json({ activities: [] });

	const cached = cache.get(dayNumber);
	if (cached && Date.now() - cached.ts < CACHE_TTL) return json({ activities: cached.activities });

	const supabase = createServiceClient(cookies);
	const { data: day } = await supabase
		.from('days')
		.select('activities(id, title, latitude, longitude, sort_order)')
		.eq('trip_id', TRIP_ID)
		.eq('day_number', dayNumber)
		.order('sort_order', { referencedTable: 'activities' })
		.single();

	const activities = day?.activities ?? [];
	cache.set(dayNumber, { activities, ts: Date.now() });
	return json({ activities });
};
