<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import type { Database } from '$lib/types/database';
	import { commentsQuery, useCreateComment } from '$lib/queries/comments';
	import { timeAgo } from '$lib/utils/time';

	let {
		activityId,
		userId,
		supabase
	}: {
		activityId: string;
		userId?: string | null;
		supabase: SupabaseClient<Database>;
	} = $props();

	const comments = commentsQuery(supabase, activityId);
	const createComment = useCreateComment(supabase);

	let body = $state('');

	function submit() {
		if (!body.trim() || !userId) return;
		createComment.mutate(
			{ activityId, userId, body: body.trim() },
			{ onSuccess: () => { body = ''; } }
		);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			submit();
		}
	}

</script>

<div class="space-y-3">
	{#if comments.data && comments.data.length > 0}
		<div class="space-y-2">
			{#each comments.data as comment}
				{@const profile = comment.profiles}
				<div class="flex gap-2">
					<div
						class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
						style="background-color: {profile?.avatar_color ?? '#6366f1'}"
					>
						{profile?.display_name?.[0]?.toUpperCase() ?? '?'}
					</div>
					<div class="min-w-0 flex-1">
						<div class="flex items-baseline gap-2">
							<span class="text-xs font-semibold text-slate-700">{profile?.display_name ?? 'Unknown'}</span>
							<span class="text-[10px] text-slate-400">{timeAgo(comment.created_at)}</span>
						</div>
						<p class="text-sm text-slate-600 leading-snug">{comment.body}</p>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	{#if userId}
		<div class="flex gap-2">
			<input
				bind:value={body}
				onkeydown={handleKeydown}
				placeholder="Add a comment..."
				class="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm transition-all focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
			/>
			<button
				onclick={submit}
				disabled={!body.trim() || createComment.isPending}
				class="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition-all active:scale-95 disabled:opacity-50"
			>
				Post
			</button>
		</div>
	{/if}
</div>
