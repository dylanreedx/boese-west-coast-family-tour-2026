import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database';
import type { GroupMessage } from '$lib/types/app';
import { TRIP_ID } from '$lib/types/app';

export type GroupMessageWithMember = GroupMessage & {
	trip_members: { display_name: string; avatar_color: string | null } | null;
	reactions: { emoji: string; user_id: string; id?: string }[];
};

export function groupMessagesQuery(supabase: SupabaseClient<Database>) {
	return createQuery(() => ({
		queryKey: ['group-messages', TRIP_ID],
		queryFn: async () => {
			const { data, error } = await supabase
				.from('group_messages')
				.select('*, trip_members!inner(display_name, avatar_color)')
				.eq('trip_id', TRIP_ID)
				.order('created_at')
				.limit(200);
			if (error) throw error;

			// Fetch reactions for all messages
			const messageIds = (data ?? []).map((m) => m.id);
			let reactions: { id: string; message_id: string; emoji: string; user_id: string }[] = [];
			if (messageIds.length > 0) {
				const { data: rxns } = await supabase
					.from('message_reactions')
					.select('id, message_id, emoji, user_id')
					.in('message_id', messageIds);
				reactions = rxns ?? [];
			}

			// Merge reactions into messages
			return (data ?? []).map((msg) => ({
				...msg,
				reactions: reactions.filter((r) => r.message_id === msg.id)
			})) as GroupMessageWithMember[];
		}
	}));
}

export function useSendGroupMessage(supabase: SupabaseClient<Database>) {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: async ({ userId, content }: { userId: string; content: string }) => {
			const { data, error } = await supabase
				.from('group_messages')
				.insert({ trip_id: TRIP_ID, user_id: userId, content })
				.select()
				.single();
			if (error) throw error;
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['group-messages', TRIP_ID] });
		}
	}));
}

export function useToggleReaction(supabase: SupabaseClient<Database>) {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: async ({
			messageId,
			userId,
			emoji,
			existingReactionId
		}: {
			messageId: string;
			userId: string;
			emoji: string;
			existingReactionId?: string;
		}) => {
			if (existingReactionId) {
				const { error } = await supabase
					.from('message_reactions')
					.delete()
					.eq('id', existingReactionId);
				if (error) throw error;
				return null;
			} else {
				const { data, error } = await supabase
					.from('message_reactions')
					.insert({ message_id: messageId, user_id: userId, emoji })
					.select()
					.single();
				if (error) throw error;
				return data;
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['group-messages', TRIP_ID] });
		}
	}));
}
