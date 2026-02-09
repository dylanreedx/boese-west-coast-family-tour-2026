import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database';
import type { ActivityInsert, ActivityUpdate } from '$lib/types/app';
import { TRIP_ID } from '$lib/types/app';
import { CURATED_LOCATIONS } from '$lib/utils/location-suggestions';

export function activitiesQuery(supabase: SupabaseClient<Database>, dayId: string) {
	return createQuery(() => ({
		queryKey: ['activities', dayId],
		queryFn: async () => {
			const { data, error } = await supabase
				.from('activities')
				.select('*, votes(*)')
				.eq('day_id', dayId)
				.order('sort_order');
			if (error) throw error;
			return data;
		},
		enabled: !!dayId
	}));
}

export function useUpdateActivity(supabase: SupabaseClient<Database>) {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: async ({ id, ...updates }: ActivityUpdate & { id: string }) => {
			const { data, error } = await supabase
				.from('activities')
				.update(updates)
				.eq('id', id)
				.select()
				.single();
			if (error) throw error;
			return data;
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ['activities', data.day_id] });
			queryClient.invalidateQueries({ queryKey: ['days-with-activities'] });
		}
	}));
}

export function useCreateActivity(supabase: SupabaseClient<Database>) {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: async (activity: ActivityInsert) => {
			const { data, error } = await supabase
				.from('activities')
				.insert({ ...activity, trip_id: TRIP_ID })
				.select()
				.single();
			if (error) throw error;
			return data;
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ['activities', data.day_id] });
			queryClient.invalidateQueries({ queryKey: ['days-with-activities'] });
		}
	}));
}

export function useLocationSuggestions(supabase: SupabaseClient<Database>) {
	return createQuery(() => ({
		queryKey: ['location-suggestions'],
		queryFn: async () => {
			const { data, error } = await supabase
				.from('activities')
				.select('location_name')
				.not('location_name', 'is', null)
				.eq('trip_id', TRIP_ID);
			if (error) throw error;
			const dbLocations = data
				.map((r) => r.location_name!)
				.filter(Boolean);
			const all = [...new Set([...CURATED_LOCATIONS, ...dbLocations])];
			all.sort((a, b) => a.localeCompare(b));
			return all;
		},
		staleTime: 30 * 60 * 1000
	}));
}

export function useDeleteActivity(supabase: SupabaseClient<Database>) {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: async ({ id, dayId }: { id: string; dayId: string }) => {
			const { error } = await supabase.from('activities').delete().eq('id', id);
			if (error) throw error;
			return { dayId };
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ['activities', data.dayId] });
			queryClient.invalidateQueries({ queryKey: ['days-with-activities'] });
		}
	}));
}
