import { redirect } from '@sveltejs/kit';
import { TRIP_ID } from '$lib/types/app';
import type { RequestHandler } from './$types';

const VALID_INVITE_CODES = ['BOESE2026'];

const AVATAR_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6'];

export const GET: RequestHandler = async ({ url, locals }) => {
	const code = url.searchParams.get('code');
	const tokenHash = url.searchParams.get('token_hash');
	const type = (url.searchParams.get('type') as 'magiclink') || 'magiclink';
	let user = null;

	if (tokenHash) {
		const { data, error } = await locals.supabase.auth.verifyOtp({ token_hash: tokenHash, type });
		if (!error && data?.user) user = data.user;
	} else if (code) {
		const { data, error } = await locals.supabase.auth.exchangeCodeForSession(code);
		if (!error && data?.user) user = data.user;
	}

	if (!user) {
		redirect(303, '/auth?error=expired');
	}

	const name = url.searchParams.get('name') || user.user_metadata?.display_name || user.email?.split('@')[0] || 'Guest';
	const inviteCode = url.searchParams.get('invite');

	// Create profile if it doesn't exist
	const { data: existingProfile } = await locals.supabase
		.from('profiles')
		.select('id')
		.eq('id', user.id)
		.single();

	if (!existingProfile) {
		const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
		await locals.supabase.from('profiles').insert({
			id: user.id,
			email: user.email,
			display_name: name,
			avatar_color: color
		});
	}

	// Add as trip member if not already one
	const isInvite = inviteCode && VALID_INVITE_CODES.includes(inviteCode.toUpperCase());
	const { data: existingMember } = await locals.supabase
		.from('trip_members')
		.select('id')
		.eq('trip_id', TRIP_ID)
		.eq('user_id', user.id)
		.single();

	if (!existingMember && isInvite) {
		const { count } = await locals.supabase
			.from('trip_members')
			.select('id', { count: 'exact', head: true })
			.eq('trip_id', TRIP_ID);

		const role = (count ?? 0) === 0 ? 'admin' : 'editor';
		const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
		await locals.supabase.from('trip_members').insert({
			trip_id: TRIP_ID,
			user_id: user.id,
			display_name: name,
			role,
			avatar_color: color
		});
	}

	redirect(303, '/');
};
