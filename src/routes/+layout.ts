import { createClient } from '$lib/supabase';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ data, depends }) => {
	depends('supabase:auth');
	const supabase = createClient();

	const { data: { session } } = await supabase.auth.getSession();

	return {
		...data,
		supabase,
		session
	};
};
