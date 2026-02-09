<script lang="ts">
	import type { Vote, VoteType } from '$lib/types/app';
	import type { SupabaseClient } from '@supabase/supabase-js';
	import type { Database } from '$lib/types/database';
	import { useToggleVote } from '$lib/queries/votes';

	let {
		activityId,
		votes = [],
		userId,
		supabase
	}: {
		activityId: string;
		votes: Vote[];
		userId?: string | null;
		supabase: SupabaseClient<Database>;
	} = $props();

	const toggleVote = useToggleVote(supabase);

	const REACTIONS: { type: VoteType; emoji: string }[] = [
		{ type: 'up', emoji: '👍' },
		{ type: 'heart', emoji: '❤️' },
		{ type: 'fire', emoji: '🔥' },
		{ type: 'question', emoji: '❓' }
	];

	function countByType(type: VoteType): number {
		return votes.filter((v) => v.vote_type === type).length;
	}

	function userVoteForType(type: VoteType): Vote | undefined {
		return votes.find((v) => v.vote_type === type && v.user_id === userId);
	}

	function toggle(type: VoteType) {
		if (!userId) return;
		const existing = userVoteForType(type);
		toggleVote.mutate({
			activityId,
			userId,
			voteType: type,
			existingVoteId: existing?.id
		});
	}

	let animating = $state<VoteType | null>(null);
</script>

<div class="flex items-center gap-1">
	{#each REACTIONS as { type, emoji }}
		{@const count = countByType(type)}
		{@const active = !!userVoteForType(type)}
		{#if count > 0 || userId}
			<button
				onclick={() => {
					animating = type;
					toggle(type);
					setTimeout(() => animating = null, 300);
				}}
				disabled={!userId}
				class="flex items-center gap-0.5 rounded-full px-2 py-1 text-xs transition-all
					{active ? 'bg-primary-100 ring-1 ring-primary-300' : 'bg-slate-50 hover:bg-slate-100'}
					{animating === type ? 'scale-125' : ''}
					disabled:cursor-default disabled:opacity-60"
				style="transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)"
			>
				<span class="text-sm">{emoji}</span>
				{#if count > 0}
					<span class="font-medium {active ? 'text-primary-700' : 'text-slate-500'}">{count}</span>
				{/if}
			</button>
		{/if}
	{/each}
</div>
