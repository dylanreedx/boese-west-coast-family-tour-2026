import { createMutation, useQueryClient } from '@tanstack/svelte-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database';
import type { VoteType } from '$lib/types/app';
import { TRIP_ID } from '$lib/types/app';

export function useToggleVote(supabase: SupabaseClient<Database>) {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: async ({
			activityId,
			userId,
			voteType,
			existingVoteId
		}: {
			activityId: string;
			userId: string;
			voteType: VoteType;
			existingVoteId?: string;
		}) => {
			if (existingVoteId) {
				const { error } = await supabase.from('votes').delete().eq('id', existingVoteId);
				if (error) throw error;
				return { removed: true, activityId };
			} else {
				const { data, error } = await supabase
					.from('votes')
					.insert({ activity_id: activityId, user_id: userId, vote_type: voteType })
					.select()
					.single();
				if (error) throw error;
				return { removed: false, activityId, vote: data };
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['day', TRIP_ID] });
			queryClient.invalidateQueries({ queryKey: ['days-with-activities'] });
			queryClient.invalidateQueries({ queryKey: ['activities'] });
		}
	}));
}
