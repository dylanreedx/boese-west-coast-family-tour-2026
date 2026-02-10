import { dev } from '$app/environment';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createAdminClient } from '$lib/server/supabase-admin';
import { sendMagicLinkEmail } from '$lib/server/email';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { session } = await locals.safeGetSession();
	if (session) {
		redirect(303, '/');
	}
	const error = url.searchParams.get('error');
	return { dev, error };
};

export const actions: Actions = {
	default: async ({ request, url, locals }) => {
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

		// In dev mode, verify the token server-side and sign in directly (no email needed)
		if (dev) {
			const actionUrl = new URL(data.properties.action_link);
			const tokenHash = actionUrl.searchParams.get('token');
			if (tokenHash) {
				const { error: verifyError } = await locals.supabase.auth.verifyOtp({
					token_hash: tokenHash,
					type: 'magiclink'
				});
				if (verifyError) {
					return fail(500, { error: verifyError.message, email });
				}
			}
			redirect(303, '/');
		}

		const actionUrl = new URL(data.properties.action_link);
		const tokenHash = actionUrl.searchParams.get('token');
		if (!tokenHash) {
			return fail(500, { error: 'Failed to extract sign-in token', email });
		}
		const callbackUrl = `${url.origin}/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink`;

		const { success, error: emailError } = await sendMagicLinkEmail({
			to: email,
			magicLinkUrl: callbackUrl
		});

		if (!success) {
			return fail(500, { error: emailError ?? 'Failed to send email', email });
		}

		return { success: true, email };
	}
};
