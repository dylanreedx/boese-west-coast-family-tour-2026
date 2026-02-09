<script lang="ts">
	import { page } from '$app/state';

	let {
		title = 'Boese West Coast Trip 2026',
		description = 'Family road trip planner: Detroit to Phoenix, Grand Canyon, Las Vegas, Death Valley, San Francisco, Santa Monica, Joshua Tree and back. May 13–20, 2026.',
		ogStyle = 'journey'
	}: {
		title?: string;
		description?: string;
		ogStyle?: 'journey' | 'bold';
	} = $props();

	const ogImageUrl = $derived(`${page.url.origin}/og?style=${ogStyle}`);
	const canonicalUrl = $derived(page.url.href);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />

	<!-- Open Graph -->
	<meta property="og:type" content="website" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:image" content={ogImageUrl} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:site_name" content="Boese West Coast Trip 2026" />

	<!-- Twitter/X Card -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={ogImageUrl} />
</svelte:head>
