<script lang="ts">
	import '../app.css';
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import { onMount } from 'svelte';
	import { setupRealtime } from '$lib/stores/realtime.svelte';
	import { setupPresence } from '$lib/stores/presence.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';

	let { children, data } = $props();

	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 1000 * 60 * 5,
				refetchOnWindowFocus: true
			}
		}
	});

	// Listen for Supabase auth changes and set up realtime
	onMount(() => {
		const { data: { subscription } } = data.supabase.auth.onAuthStateChange((_, newSession) => {
			if (newSession?.expires_at !== data.session?.expires_at) {
				queryClient.invalidateQueries();
			}
		});

		const cleanupRealtime = setupRealtime(
			data.supabase,
			queryClient,
			data.session?.user?.id
		);

		const memberName = data.session?.user?.user_metadata?.display_name;
		const cleanupPresence = setupPresence(
			data.supabase,
			data.session?.user?.id,
			memberName
		);

		return () => {
			subscription.unsubscribe();
			cleanupRealtime();
			cleanupPresence();
		};
	});
</script>

<QueryClientProvider client={queryClient}>
	{@render children()}
</QueryClientProvider>

<Toast />
