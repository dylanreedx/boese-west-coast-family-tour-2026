import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const { session, user } = await locals.safeGetSession();

	// Allow access to auth routes without session
	const isAuthRoute = url.pathname.startsWith('/auth') || url.pathname.startsWith('/join');
	if (!session && !isAuthRoute) {
		redirect(303, '/auth');
	}

	return { session, user };
};
