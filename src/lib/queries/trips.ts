import { createQuery } from '@tanstack/svelte-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database';
import { TRIP_ID } from '$lib/types/app';

export function tripQuery(supabase: SupabaseClient<Database>) {
	return createQuery(() => ({
		queryKey: ['trip', TRIP_ID],
		queryFn: async () => {
			const { data, error } = await supabase
				.from('trips')
				.select('*')
				.eq('id', TRIP_ID)
				.single();
			if (error) throw error;
			return data;
		}
	}));
}

export function daysQuery(supabase: SupabaseClient<Database>) {
	return createQuery(() => ({
		queryKey: ['days', TRIP_ID],
		queryFn: async () => {
			const { data, error } = await supabase
				.from('days')
				.select('*')
				.eq('trip_id', TRIP_ID)
				.order('day_number');
			if (error) throw error;
			return data;
		}
	}));
}

export function daysWithActivitiesQuery(supabase: SupabaseClient<Database>) {
	return createQuery(() => ({
		queryKey: ['days-with-activities', TRIP_ID],
		queryFn: async () => {
			const { data, error } = await supabase
				.from('days')
				.select('*, activities(*)')
				.eq('trip_id', TRIP_ID)
				.order('day_number')
				.order('sort_order', { referencedTable: 'activities' });
			if (error) throw error;
			return data;
		}
	}));
}
