import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createAdminClient } from '$lib/server/supabase-admin';
import { sendMagicLinkEmail } from '$lib/server/email';

export const load: PageServerLoad = async ({ locals }) => {
	const { session } = await locals.safeGetSession();
	if (session) {
		redirect(303, '/');
	}
};

export const actions: Actions = {
	default: async ({ request, url }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;

		if (!email) {
			return fail(400, { error: 'Email is required', email });
		}

		const admin = createAdminClient();
		const { data, error: linkError } = await admin.auth.admin.generateLink({
			type: 'magiclink',
			email,
			options: {
				redirectTo: `${url.origin}/auth/callback`
			}
		});

		if (linkError || !data?.properties?.action_link) {
			return fail(500, { error: linkError?.message ?? 'Failed to generate sign-in link', email });
		}

		const { success, error: emailError } = await sendMagicLinkEmail({
			to: email,
			magicLinkUrl: data.properties.action_link
		});

		if (!success) {
			return fail(500, { error: emailError ?? 'Failed to send email', email });
		}

		return { success: true, email };
	}
};
