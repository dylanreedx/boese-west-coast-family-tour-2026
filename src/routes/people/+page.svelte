<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { TRIP_ID } from '$lib/types/app';
	import Header from '$lib/components/layout/Header.svelte';
	import BottomNav from '$lib/components/layout/BottomNav.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import { page } from '$app/state';

	let { data } = $props();

	const membersQuery = createQuery(() => ({
		queryKey: ['trip-members', TRIP_ID],
		queryFn: async () => {
			const { data: members, error } = await data.supabase
				.from('trip_members')
				.select('*')
				.eq('trip_id', TRIP_ID)
				.order('joined_at');
			if (error) throw error;
			return members;
		}
	}));

	const inviteUrl = $derived(`${page.url.origin}/join/BOESE2026`);
	let copied = $state(false);

	async function copyInvite() {
		try {
			await navigator.clipboard.writeText(inviteUrl);
			copied = true;
			setTimeout(() => copied = false, 2000);
		} catch {
			// Fallback for older browsers
			const input = document.createElement('input');
			input.value = inviteUrl;
			document.body.appendChild(input);
			input.select();
			document.execCommand('copy');
			document.body.removeChild(input);
			copied = true;
			setTimeout(() => copied = false, 2000);
		}
	}

	async function shareInvite() {
		if (navigator.share) {
			await navigator.share({
				title: 'Join our West Coast Trip!',
				text: 'You\'re invited to help plan the Boese family road trip!',
				url: inviteUrl
			});
		} else {
			copyInvite();
		}
	}

	const ROLE_LABELS: Record<string, { label: string; color: string }> = {
		admin: { label: 'Admin', color: 'bg-purple-100 text-purple-700' },
		editor: { label: 'Editor', color: 'bg-primary-100 text-primary-700' },
		viewer: { label: 'Viewer', color: 'bg-slate-100 text-slate-600' }
	};
</script>

<svelte:head>
	<title>Family - Boese West Coast Trip</title>
</svelte:head>

<Header title="Family" supabase={data.supabase} userEmail={data.session?.user?.email} />

<main class="mx-auto max-w-2xl px-4 pb-24 pt-4">
	<!-- Invite Card -->
	<div class="rounded-2xl bg-gradient-to-br from-primary-50 to-primary-100/50 p-5">
		<h2 class="text-sm font-semibold text-primary-900">Invite Family Members</h2>
		<p class="mt-1 text-xs text-primary-600">Share this link so they can join the trip planning.</p>
		<div class="mt-3 flex gap-2">
			<div class="flex-1 truncate rounded-xl bg-white px-3 py-2.5 text-xs font-mono text-slate-500">
				{inviteUrl}
			</div>
			<button
				onclick={shareInvite}
				class="flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all active:scale-95"
			>
				{#if copied}
					Copied!
				{:else}
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
					</svg>
					Share
				{/if}
			</button>
		</div>
	</div>

	<!-- Members List -->
	<section class="mt-6">
		<h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Trip Crew</h2>

		{#if membersQuery.isLoading}
			{#each Array(3) as _}
				<Skeleton class="mb-2 h-16" />
			{/each}
		{:else if membersQuery.data}
			<div class="space-y-2">
				{#each membersQuery.data as member}
					{@const role = ROLE_LABELS[member.role ?? 'editor']}
					{@const isYou = data.session?.user?.id === member.user_id}
					<div class="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
						<!-- Avatar -->
						<div
							class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
							style="background-color: {member.avatar_color}"
						>
							{member.display_name?.[0]?.toUpperCase() ?? '?'}
						</div>

						<!-- Info -->
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span class="font-semibold text-slate-900 truncate">{member.display_name}</span>
								{#if isYou}
									<span class="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">You</span>
								{/if}
							</div>
							<span class="inline-block mt-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium {role.color}">
								{role.label}
							</span>
						</div>
					</div>
				{/each}
			</div>

			{#if membersQuery.data.length === 0}
				<div class="rounded-xl bg-white p-8 text-center shadow-sm">
					<span class="text-3xl">👨‍👩‍👧‍👦</span>
					<p class="mt-3 text-sm text-slate-500">No members yet. Share the invite link above!</p>
				</div>
			{/if}
		{:else if membersQuery.isError}
			<div class="rounded-xl bg-rose-50 p-6 text-center">
				<p class="text-sm text-rose-600">Couldn't load members. Try refreshing.</p>
			</div>
		{/if}
	</section>
</main>

<BottomNav />
