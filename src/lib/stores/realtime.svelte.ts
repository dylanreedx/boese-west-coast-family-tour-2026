import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database';
import type { QueryClient } from '@tanstack/svelte-query';
import { TRIP_ID } from '$lib/types/app';
import { addToast } from './toasts.svelte';

export function setupRealtime(
	supabase: SupabaseClient<Database>,
	queryClient: QueryClient,
	currentUserId?: string | null
) {
	const channel = supabase
		.channel('trip-changes')
		.on(
			'postgres_changes',
			{ event: '*', schema: 'public', table: 'activities' },
			(payload) => {
				queryClient.invalidateQueries({ queryKey: ['day', TRIP_ID] });
				queryClient.invalidateQueries({ queryKey: ['days-with-activities'] });
				queryClient.invalidateQueries({ queryKey: ['activities'] });

				if (payload.eventType === 'INSERT' && payload.new) {
					const activity = payload.new as { title?: string };
					if (activity.title) {
						addToast(`New activity: ${activity.title}`);
					}
				}
			}
		)
		.on(
			'postgres_changes',
			{ event: '*', schema: 'public', table: 'votes' },
			() => {
				queryClient.invalidateQueries({ queryKey: ['day', TRIP_ID] });
				queryClient.invalidateQueries({ queryKey: ['days-with-activities'] });
			}
		)
		.on(
			'postgres_changes',
			{ event: '*', schema: 'public', table: 'comments' },
			() => {
				queryClient.invalidateQueries({ queryKey: ['comments'] });
			}
		)
		.on(
			'postgres_changes',
			{ event: '*', schema: 'public', table: 'checklist_items' },
			() => {
				queryClient.invalidateQueries({ queryKey: ['checklists'] });
			}
		)
		.on(
			'postgres_changes',
			{ event: '*', schema: 'public', table: 'chat_messages' },
			(payload) => {
				queryClient.invalidateQueries({ queryKey: ['chat-messages'] });

				if (
					payload.eventType === 'INSERT' &&
					payload.new &&
					payload.new.role === 'user' &&
					payload.new.user_id !== currentUserId
				) {
					addToast('New message in Local Guide chat');
				}
			}
		)
		.subscribe();

	return () => {
		supabase.removeChannel(channel);
	};
}
