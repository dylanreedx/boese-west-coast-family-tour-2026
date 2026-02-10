<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { TRIP_ID } from '$lib/types/app';
	import type { TripMember } from '$lib/types/app';
	import Header from '$lib/components/layout/Header.svelte';
	import BottomNav from '$lib/components/layout/BottomNav.svelte';
	import SEO from '$lib/components/SEO.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import GroupChat from '$lib/components/family/GroupChat.svelte';
	import MembersSidebar from '$lib/components/family/MembersSidebar.svelte';
	import { page } from '$app/state';

	let { data } = $props();
	const userId = $derived(data.session?.user?.id);

	const membersQuery = createQuery(() => ({
		queryKey: ['trip-members', TRIP_ID],
		queryFn: async () => {
			const { data: members, error } = await data.supabase
				.from('trip_members')
				.select('*')
				.eq('trip_id', TRIP_ID)
				.order('joined_at');
			if (error) throw error;
			return members as TripMember[];
		}
	}));

	// Build a lookup map for GroupChat to use for optimistic messages
	const membersMap = $derived(
		(membersQuery.data ?? []).reduce<Record<string, { display_name: string; avatar_color: string | null }>>((acc, m) => {
			if (m.user_id) {
				acc[m.user_id] = { display_name: m.display_name, avatar_color: m.avatar_color };
			}
			return acc;
		}, {})
	);

	let copied = $state(false);
	let showMembers = $state(false);

	async function shareInvite() {
		const inviteUrl = `${page.url.origin}/join/BOESE2026`;
		if (navigator.share) {
			await navigator.share({
				title: 'Join our West Coast Trip!',
				text: "You're invited to help plan the Boese family road trip!",
				url: inviteUrl
			});
		} else {
			try {
				await navigator.clipboard.writeText(inviteUrl);
				copied = true;
				setTimeout(() => (copied = false), 2000);
			} catch {
				// silent
			}
		}
	}
</script>

<SEO
	title="Family - Boese West Coast Trip"
	description="Family chat hub for the Boese family West Coast road trip."
	ogStyle="bold"
/>

<Header title="Family" supabase={data.supabase} userEmail={data.session?.user?.email} />

<!-- Desktop: side-by-side | Mobile: stacked with collapsible sidebar -->
<main class="mx-auto flex max-w-5xl gap-0 pb-20 pt-0 lg:gap-4 lg:px-4 lg:pt-4">
	<!-- Sidebar: hidden on mobile unless toggled -->
	<aside class="hidden w-72 flex-shrink-0 lg:block">
		<div class="sticky top-16 rounded-2xl bg-white p-4 shadow-sm">
			{#if membersQuery.isLoading}
				{#each Array(3) as _}
					<Skeleton class="mb-2 h-10" />
				{/each}
			{:else if membersQuery.data}
				<MembersSidebar
					members={membersQuery.data}
					currentUserId={userId}
					{copied}
					onShare={shareInvite}
				/>
			{/if}
		</div>
	</aside>

	<!-- Chat area -->
	<div class="min-w-0 flex-1">
		<!-- Mobile members toggle -->
		<div class="border-b border-slate-200 bg-white px-4 py-2 lg:hidden">
			<button
				onclick={() => showMembers = !showMembers}
				class="flex w-full items-center justify-between text-xs font-semibold text-slate-500"
			>
				<span>
					{membersQuery.data?.length ?? 0} members
				</span>
				<svg
					class="h-4 w-4 transition-transform {showMembers ? 'rotate-180' : ''}"
					fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
				</svg>
			</button>

			{#if showMembers}
				<div class="mt-3 pb-1">
					{#if membersQuery.data}
						<MembersSidebar
							members={membersQuery.data}
							currentUserId={userId}
							{copied}
							onShare={shareInvite}
						/>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Chat -->
		<div class="h-[calc(100dvh-3.5rem-4rem)] lg:h-[calc(100dvh-3.5rem-4rem-1rem)] lg:rounded-2xl lg:bg-white lg:shadow-sm">
			<GroupChat supabase={data.supabase} {userId} {membersMap} />
		</div>
	</div>
</main>

<BottomNav />
