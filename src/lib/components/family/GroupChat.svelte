<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import type { Database } from '$lib/types/database';
	import type { ActionMetadata } from '$lib/types/app';
	import { TRIP_ID } from '$lib/types/app';
	import { useQueryClient } from '@tanstack/svelte-query';
	import { groupMessagesQuery, useSendGroupMessage, type GroupMessageWithMember } from '$lib/queries/group-chat';
	import { addToast } from '$lib/stores/toasts.svelte';
	import { timeAgo } from '$lib/utils/time';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import MessageReactions from './MessageReactions.svelte';

	let {
		supabase,
		userId,
		membersMap = {}
	}: {
		supabase: SupabaseClient<Database>;
		userId?: string | null;
		membersMap?: Record<string, { display_name: string; avatar_color: string | null }>;
	} = $props();

	const messagesQuery = groupMessagesQuery(supabase);
	const sendMessage = useSendGroupMessage(supabase);
	const queryClient = useQueryClient();

	let inputValue = $state('');
	let scrollContainer: HTMLDivElement | undefined = $state();

	// Auto-scroll when messages change
	$effect(() => {
		const _ = messagesQuery.data?.length;
		if (scrollContainer) {
			requestAnimationFrame(() => {
				scrollContainer!.scrollTop = scrollContainer!.scrollHeight;
			});
		}
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}

	function handleSend() {
		const text = inputValue.trim();
		if (!text || !userId) return;
		inputValue = '';

		// Optimistic update
		const optimistic: GroupMessageWithMember = {
			id: `optimistic-${Date.now()}`,
			trip_id: TRIP_ID,
			user_id: userId,
			content: text,
			shared_from_message_id: null,
			shared_action_metadata: null,
			created_at: new Date().toISOString(),
			trip_members: membersMap[userId] ?? { display_name: 'You', avatar_color: '#6366f1' },
			reactions: []
		};

		queryClient.setQueryData(
			['group-messages', TRIP_ID],
			(old: GroupMessageWithMember[] | undefined) => [...(old ?? []), optimistic]
		);

		sendMessage.mutate(
			{ userId, content: text },
			{
				onError: () => {
					addToast('Failed to send message');
					queryClient.invalidateQueries({ queryKey: ['group-messages', TRIP_ID] });
				}
			}
		);
	}

	function isSharedSuggestion(msg: GroupMessageWithMember): boolean {
		return !!msg.shared_from_message_id && !!msg.shared_action_metadata;
	}

	function getActionMetadata(msg: GroupMessageWithMember): ActionMetadata | null {
		if (!msg.shared_action_metadata) return null;
		return msg.shared_action_metadata as unknown as ActionMetadata;
	}
</script>

<div class="flex h-full flex-col">
	<!-- Messages area -->
	<div bind:this={scrollContainer} class="flex-1 overflow-y-auto px-4 py-4">
		{#if messagesQuery.isLoading}
			<div class="space-y-3">
				{#each Array(4) as _}
					<Skeleton class="h-12 w-3/4" />
					<Skeleton class="ml-auto h-10 w-2/3" />
				{/each}
			</div>
		{:else if messagesQuery.data && messagesQuery.data.length === 0}
			<div class="flex h-full flex-col items-center justify-center text-center">
				<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-100 to-primary-50">
					<svg class="h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
					</svg>
				</div>
				<h2 class="text-lg font-bold text-slate-900">Family Chat</h2>
				<p class="mt-1 max-w-xs text-sm text-slate-500">
					Start chatting with your family about the trip! Share ideas, plans, and excitement.
				</p>
			</div>
		{:else if messagesQuery.data}
			<div class="space-y-3">
				{#each messagesQuery.data as msg (msg.id)}
					{@const isOwn = msg.user_id === userId}
					{@const memberInfo = msg.trip_members}
					{#if isOwn}
						<!-- Own message: right-aligned -->
						<div class="flex justify-end">
							<div class="max-w-[85%]">
								{#if isSharedSuggestion(msg)}
									{@const actionMeta = getActionMetadata(msg)}
									{#if actionMeta}
										{#await import('./SharedSuggestionCard.svelte') then { default: SharedSuggestionCard }}
											<SharedSuggestionCard
												metadata={actionMeta}
												sharerName="You"
												isOwner={true}
											/>
										{/await}
									{/if}
									{#if msg.content}
										<p class="mt-1 text-xs text-slate-500 italic">{msg.content}</p>
									{/if}
								{:else}
									<div class="rounded-2xl rounded-br-md bg-primary-600 px-4 py-2.5 text-sm text-white shadow-sm">
										{msg.content}
									</div>
								{/if}
								<div class="mt-1 flex items-center justify-end gap-2">
									<MessageReactions {supabase} {userId} messageId={msg.id} reactions={msg.reactions} size="sm" />
									<span class="text-[10px] text-slate-400">{timeAgo(msg.created_at)}</span>
								</div>
							</div>
						</div>
					{:else}
						<!-- Others' message: left-aligned with avatar -->
						<div class="flex gap-2">
							<div
								class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
								style="background-color: {memberInfo?.avatar_color ?? '#6366f1'}"
							>
								{memberInfo?.display_name?.[0]?.toUpperCase() ?? '?'}
							</div>
							<div class="max-w-[85%]">
								<span class="mb-0.5 block text-xs font-semibold text-slate-600">
									{memberInfo?.display_name ?? 'Unknown'}
								</span>
								{#if isSharedSuggestion(msg)}
									{@const actionMeta = getActionMetadata(msg)}
									{#if actionMeta}
										{#await import('./SharedSuggestionCard.svelte') then { default: SharedSuggestionCard }}
											<SharedSuggestionCard
												metadata={actionMeta}
												sharerName={memberInfo?.display_name ?? 'Unknown'}
												isOwner={false}
											/>
										{/await}
									{/if}
									{#if msg.content}
										<p class="mt-1 text-xs text-slate-500 italic">{msg.content}</p>
									{/if}
								{:else}
									<div class="rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm">
										{msg.content}
									</div>
								{/if}
								<div class="mt-1 flex items-center gap-2">
									<MessageReactions {supabase} {userId} messageId={msg.id} reactions={msg.reactions} size="sm" />
									<span class="text-[10px] text-slate-400">{timeAgo(msg.created_at)}</span>
								</div>
							</div>
						</div>
					{/if}
				{/each}
			</div>
		{/if}
	</div>

	<!-- Input area -->
	{#if userId}
		<div class="border-t border-slate-200 bg-white px-4 py-3">
			<div class="flex items-end gap-2">
				<textarea
					bind:value={inputValue}
					onkeydown={handleKeydown}
					placeholder="Message your family..."
					rows={1}
					class="min-h-[40px] max-h-[120px] flex-1 resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm transition-all placeholder:text-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
				></textarea>
				<button
					onclick={handleSend}
					disabled={!inputValue.trim() || sendMessage.isPending}
					class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm transition-all hover:bg-primary-700 active:scale-95 disabled:opacity-40"
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
					</svg>
				</button>
			</div>
		</div>
	{/if}
</div>
