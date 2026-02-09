<script lang="ts">
	import '../app.css';
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import { onMount } from 'svelte';
	import { setupRealtime } from '$lib/stores/realtime.svelte';
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

		return () => {
			subscription.unsubscribe();
			cleanupRealtime();
		};
	});
</script>

<QueryClientProvider client={queryClient}>
	{@render children()}
</QueryClientProvider>

<Toast />
