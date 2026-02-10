<script lang="ts">
	import type { TripMember } from '$lib/types/app';
	import { onlineUsers } from '$lib/stores/presence.svelte';
	import { timeAgo } from '$lib/utils/time';
	import { page } from '$app/state';

	let {
		members = [],
		currentUserId,
		copied = false,
		onShare
	}: {
		members: TripMember[];
		currentUserId?: string | null;
		copied?: boolean;
		onShare?: () => void;
	} = $props();

	const ROLE_LABELS: Record<string, { label: string; color: string }> = {
		admin: { label: 'Admin', color: 'bg-purple-100 text-purple-700' },
		editor: { label: 'Editor', color: 'bg-primary-100 text-primary-700' },
		viewer: { label: 'Viewer', color: 'bg-slate-100 text-slate-600' }
	};

	// Sort: online first, then by joined_at
	const sortedMembers = $derived(
		[...members].sort((a, b) => {
			const aOnline = onlineUsers.set.has(a.user_id ?? '');
			const bOnline = onlineUsers.set.has(b.user_id ?? '');
			if (aOnline && !bOnline) return -1;
			if (!aOnline && bOnline) return 1;
			return 0;
		})
	);

	const onlineCount = $derived(
		members.filter((m) => onlineUsers.set.has(m.user_id ?? '')).length
	);

	const inviteUrl = $derived(`${page.url.origin}/join/BOESE2026`);
</script>

<div class="space-y-4">
	<!-- Online Status Header -->
	<div class="flex items-center gap-2">
		<div class="h-2 w-2 rounded-full bg-emerald-500"></div>
		<span class="text-xs font-semibold text-slate-600">
			{onlineCount} online
		</span>
		<span class="text-xs text-slate-400">of {members.length}</span>
	</div>

	<!-- Members List -->
	<div class="space-y-1.5">
		{#each sortedMembers as member}
			{@const role = ROLE_LABELS[member.role ?? 'editor']}
			{@const isOnline = onlineUsers.set.has(member.user_id ?? '')}
			{@const isYou = currentUserId === member.user_id}
			<div class="flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-slate-50">
				<!-- Avatar with presence dot -->
				<div class="relative flex-shrink-0">
					<div
						class="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
						style="background-color: {member.avatar_color}"
					>
						{member.display_name?.[0]?.toUpperCase() ?? '?'}
					</div>
					{#if isOnline}
						<div class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500"></div>
					{/if}
				</div>

				<!-- Name + status -->
				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-1.5">
						<span class="truncate text-sm font-medium text-slate-800">{member.display_name}</span>
						{#if isYou}
							<span class="rounded bg-slate-100 px-1 py-0.5 text-[9px] font-medium text-slate-500">you</span>
						{/if}
					</div>
					<div class="flex items-center gap-1.5">
						<span class="rounded px-1 py-0.5 text-[9px] font-medium {role.color}">{role.label}</span>
						{#if !isOnline && member.last_active_at}
							<span class="text-[10px] text-slate-400">{timeAgo(member.last_active_at)}</span>
						{:else if isOnline}
							<span class="text-[10px] text-emerald-600">online</span>
						{/if}
					</div>
				</div>
			</div>
		{/each}
	</div>

	<!-- Invite Card (compact) -->
	<div class="rounded-xl bg-gradient-to-br from-primary-50 to-primary-100/50 p-3">
		<p class="text-xs font-semibold text-primary-900">Invite Family</p>
		<div class="mt-2 flex gap-1.5">
			<div class="min-w-0 flex-1 truncate rounded-lg bg-white px-2 py-1.5 text-[10px] font-mono text-slate-400">
				{inviteUrl}
			</div>
			<button
				onclick={onShare}
				class="rounded-lg bg-primary-600 px-3 py-1.5 text-[10px] font-semibold text-white transition-all active:scale-95"
			>
				{copied ? 'Copied!' : 'Share'}
			</button>
		</div>
	</div>
</div>
