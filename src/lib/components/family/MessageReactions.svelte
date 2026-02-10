<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import type { Database } from '$lib/types/database';
	import { useToggleReaction } from '$lib/queries/group-chat';

	let {
		supabase,
		userId,
		messageId,
		reactions = [],
		size = 'sm'
	}: {
		supabase: SupabaseClient<Database>;
		userId?: string | null;
		messageId: string;
		reactions: { emoji: string; user_id: string; id?: string }[];
		size?: 'sm' | 'md';
	} = $props();

	const toggleReaction = useToggleReaction(supabase);

	const QUICK_REACTIONS = ['👍', '❤️', '🔥', '😂', '🤔', '👎'];

	let showPicker = $state(false);

	// Group reactions by emoji
	const grouped = $derived(() => {
		const map = new Map<string, { count: number; userReacted: boolean; reactionId?: string }>();
		for (const r of reactions) {
			const existing = map.get(r.emoji);
			if (existing) {
				existing.count++;
				if (r.user_id === userId) {
					existing.userReacted = true;
					existing.reactionId = r.id;
				}
			} else {
				map.set(r.emoji, {
					count: 1,
					userReacted: r.user_id === userId,
					reactionId: r.user_id === userId ? r.id : undefined
				});
			}
		}
		return map;
	});

	function toggle(emoji: string) {
		if (!userId) return;
		const existing = reactions.find((r) => r.emoji === emoji && r.user_id === userId);
		toggleReaction.mutate({
			messageId,
			userId,
			emoji,
			existingReactionId: existing?.id
		});
		showPicker = false;
	}
</script>

<div class="flex flex-wrap items-center gap-1">
	{#each [...grouped().entries()] as [emoji, info]}
		<button
			onclick={() => toggle(emoji)}
			disabled={!userId}
			class="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs transition-all
				{info.userReacted ? 'bg-primary-100 ring-1 ring-primary-300' : 'bg-slate-100 hover:bg-slate-200'}
				disabled:cursor-default disabled:opacity-60"
		>
			<span class={size === 'sm' ? 'text-xs' : 'text-sm'}>{emoji}</span>
			{#if info.count > 0}
				<span class="font-medium {info.userReacted ? 'text-primary-700' : 'text-slate-500'}">{info.count}</span>
			{/if}
		</button>
	{/each}

	{#if userId}
		<div class="relative">
			<button
				onclick={() => showPicker = !showPicker}
				class="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-400 transition-all hover:bg-slate-200 hover:text-slate-600"
			>
				+
			</button>

			{#if showPicker}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="fixed inset-0 z-40" onclick={() => showPicker = false}></div>
				<div class="absolute bottom-8 left-0 z-50 flex gap-1 rounded-xl bg-white p-2 shadow-lg ring-1 ring-slate-200">
					{#each QUICK_REACTIONS as emoji}
						<button
							onclick={() => toggle(emoji)}
							class="flex h-8 w-8 items-center justify-center rounded-lg text-base transition-all hover:bg-slate-100 active:scale-110"
						>
							{emoji}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
