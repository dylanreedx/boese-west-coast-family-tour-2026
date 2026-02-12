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
			() => {
				queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
			}
		)
		.on(
			'postgres_changes',
			{ event: '*', schema: 'public', table: 'group_messages' },
			() => {
				queryClient.invalidateQueries({ queryKey: ['group-messages'] });
				queryClient.invalidateQueries({ queryKey: ['family-feedback'] });
			}
		)
		.on(
			'postgres_changes',
			{ event: '*', schema: 'public', table: 'message_reactions' },
			() => {
				queryClient.invalidateQueries({ queryKey: ['group-messages'] });
				// Also refresh family feedback shown on guide chat ActionCards
				queryClient.invalidateQueries({ queryKey: ['family-feedback'] });
			}
		)
		.on(
			'postgres_changes',
			{ event: '*', schema: 'public', table: 'expenses' },
			(payload) => {
				queryClient.invalidateQueries({ queryKey: ['expenses'] });
				if (payload.eventType === 'INSERT' && payload.new) {
					const expense = payload.new as { title?: string };
					if (expense.title) {
						addToast(`New expense: ${expense.title}`);
					}
				}
			}
		)
		.on(
			'postgres_changes',
			{ event: '*', schema: 'public', table: 'expense_splits' },
			() => {
				queryClient.invalidateQueries({ queryKey: ['expenses'] });
			}
		)
		.on(
			'postgres_changes',
			{ event: '*', schema: 'public', table: 'expense_payments' },
			() => {
				queryClient.invalidateQueries({ queryKey: ['expense-payments'] });
			}
		)
		.subscribe();

	return () => {
		supabase.removeChannel(channel);
	};
}
