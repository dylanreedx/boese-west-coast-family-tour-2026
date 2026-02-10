import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database';
import { TRIP_ID } from '$lib/types/app';

type PresenceState = {
	user_id: string;
	display_name: string;
	avatar_color: string;
};

export const onlineUsers = $state<{ set: Set<string> }>({ set: new Set() });

export function setupPresence(
	supabase: SupabaseClient<Database>,
	userId: string | null | undefined,
	displayName?: string,
	avatarColor?: string
) {
	if (!userId) return () => {};

	const channel = supabase.channel(`presence:trip-${TRIP_ID}`, {
		config: { presence: { key: userId } }
	});

	channel
		.on('presence', { event: 'sync' }, () => {
			const state = channel.presenceState<PresenceState>();
			const ids = new Set<string>();
			for (const key of Object.keys(state)) {
				ids.add(key);
			}
			onlineUsers.set = ids;
		})
		.subscribe(async (status) => {
			if (status === 'SUBSCRIBED') {
				await channel.track({
					user_id: userId,
					display_name: displayName ?? '',
					avatar_color: avatarColor ?? '#6366f1'
				});

				updateLastActive(supabase, userId);
			}
		});

	// Heartbeat: update last_active_at every 60s
	const heartbeat = setInterval(() => {
		updateLastActive(supabase, userId);
	}, 60_000);

	return () => {
		clearInterval(heartbeat);
		supabase.removeChannel(channel);
	};
}

async function updateLastActive(supabase: SupabaseClient<Database>, userId: string) {
	await supabase
		.from('trip_members')
		.update({ last_active_at: new Date().toISOString() })
		.eq('trip_id', TRIP_ID)
		.eq('user_id', userId);
}
