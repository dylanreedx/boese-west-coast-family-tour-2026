<script lang="ts">
	import Header from '$lib/components/layout/Header.svelte';
	import BottomNav from '$lib/components/layout/BottomNav.svelte';
	import ChatInterface from '$lib/components/trip/ChatInterface.svelte';
	import SEO from '$lib/components/SEO.svelte';

	let { data } = $props();
	const userId = $derived(data.session?.user?.id);
</script>

<SEO
	title="Local Guide - Boese West Coast Trip"
	description="AI-powered local guide for the Boese family West Coast road trip. Ask about destinations, restaurants, and hidden gems."
	ogStyle="bold"
/>

<Header title="Local Guide" supabase={data.supabase} userEmail={data.session?.user?.email} />

<main class="h-[calc(100dvh-3.5rem-4rem)]">
	<ChatInterface supabase={data.supabase} {userId} />
</main>

<BottomNav />
