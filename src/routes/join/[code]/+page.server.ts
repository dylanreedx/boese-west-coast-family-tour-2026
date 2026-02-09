import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const VALID_INVITE_CODES = ['BOESE2026'];

export const load: PageServerLoad = async ({ params, locals }) => {
	const { session } = await locals.safeGetSession();
	if (session) {
		redirect(303, '/');
	}

	const valid = VALID_INVITE_CODES.includes(params.code.toUpperCase());
	return { code: params.code, valid };
};

export const actions: Actions = {
	default: async ({ request, locals, url, params }) => {
		const code = params.code.toUpperCase();
		if (!VALID_INVITE_CODES.includes(code)) {
			return fail(400, { error: 'Invalid invite code' });
		}

		const formData = await request.formData();
		const email = formData.get('email') as string;
		const name = formData.get('name') as string;

		if (!email || !name?.trim()) {
			return fail(400, { error: 'Name and email are required', email, name });
		}

		const { error } = await locals.supabase.auth.signInWithOtp({
			email,
			options: {
				emailRedirectTo: `${url.origin}/auth/callback?name=${encodeURIComponent(name.trim())}&invite=${code}`,
				data: {
					display_name: name.trim(),
					invite_code: code
				}
			}
		});

		if (error) {
			return fail(500, { error: error.message, email, name });
		}

		return { success: true, email };
	}
};
