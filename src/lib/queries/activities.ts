import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database';
import type { ActivityInsert, ActivityUpdate } from '$lib/types/app';
import { TRIP_ID } from '$lib/types/app';

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
