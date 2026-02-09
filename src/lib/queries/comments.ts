import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database';

export function commentsQuery(supabase: SupabaseClient<Database>, activityId: string) {
	return createQuery(() => ({
		queryKey: ['comments', activityId],
		queryFn: async () => {
			const { data, error } = await supabase
				.from('comments')
				.select('*, profiles(display_name, avatar_color)')
				.eq('activity_id', activityId)
				.order('created_at');
			if (error) throw error;
			return data;
		},
		enabled: !!activityId
	}));
}

export function useCreateComment(supabase: SupabaseClient<Database>) {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: async ({ activityId, userId, body }: { activityId: string; userId: string; body: string }) => {
			const { data, error } = await supabase
				.from('comments')
				.insert({ activity_id: activityId, user_id: userId, body })
				.select('*, profiles(display_name, avatar_color)')
				.single();
			if (error) throw error;
			return data;
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ['comments', data.activity_id] });
		}
	}));
}
