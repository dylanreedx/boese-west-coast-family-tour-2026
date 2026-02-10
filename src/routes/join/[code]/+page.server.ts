import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createAdminClient } from '$lib/server/supabase-admin';
import { sendMagicLinkEmail } from '$lib/server/email';

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
	default: async ({ request, url, params }) => {
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

		const admin = createAdminClient();
		const { data, error: linkError } = await admin.auth.admin.generateLink({
			type: 'magiclink',
			email,
			options: {
				redirectTo: `${url.origin}/auth/callback?name=${encodeURIComponent(name.trim())}&invite=${code}`,
				data: {
					display_name: name.trim(),
					invite_code: code
				}
			}
		});

		if (linkError || !data?.properties?.action_link) {
			return fail(500, { error: linkError?.message ?? 'Failed to generate sign-in link', email, name });
		}

		const actionUrl = new URL(data.properties.action_link);
		const tokenHash = actionUrl.searchParams.get('token');
		if (!tokenHash) {
			return fail(500, { error: 'Failed to extract sign-in token', email, name });
		}
		const callbackUrl = `${url.origin}/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink&name=${encodeURIComponent(name.trim())}&invite=${encodeURIComponent(code)}`;

		const { success, error: emailError } = await sendMagicLinkEmail({
			to: email,
			magicLinkUrl: callbackUrl,
			recipientName: name.trim(),
			isInvite: true
		});

		if (!success) {
			return fail(500, { error: emailError ?? 'Failed to send email', email, name });
		}

		return { success: true, email };
	}
};
