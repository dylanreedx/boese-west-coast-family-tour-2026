<script lang="ts">
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import type { SupabaseClient } from '@supabase/supabase-js';
	import type { Database } from '$lib/types/database';
	import type { ChatMessage, ActionMetadata, FamilyFeedback, PlaceDetails } from '$lib/types/app';
	import { TRIP_ID } from '$lib/types/app';
	import { addToast } from '$lib/stores/toasts.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import ActionCard from '$lib/components/trip/ActionCard.svelte';
	import DayDetailCard from '$lib/components/trip/DayDetailCard.svelte';
	import PlacesCarousel from '$lib/components/trip/PlacesCarousel.svelte';

	let {
		supabase,
		userId
	}: {
		supabase: SupabaseClient<Database>;
		userId?: string | null;
	} = $props();

	const queryClient = useQueryClient();

	const messagesQuery = createQuery(() => ({
		queryKey: ['chat-messages', TRIP_ID, userId],
		enabled: !!userId,
		queryFn: async () => {
			const { data, error } = await supabase
				.from('chat_messages')
				.select('*')
				.eq('trip_id', TRIP_ID)
				.eq('user_id', userId!)
				.order('created_at');
			if (error) throw error;
			return data as ChatMessage[];
		}
	}));

	let inputValue = $state('');
	let isStreaming = $state(false);
	let streamingContent = $state('');
	let streamingAction = $state<ActionMetadata | null>(null);
	let streamingDayCard = $state<Record<string, unknown> | null>(null);
	let streamingPlaces = $state<{ places: PlaceDetails[]; dayNumber?: number } | null>(null);
	let scrollContainer: HTMLDivElement | undefined = $state();
	let showClearConfirm = $state(false);
	let isClearing = $state(false);

	async function clearChat() {
		if (!userId || isClearing) return;
		isClearing = true;
		try {
			const { error } = await supabase
				.from('chat_messages')
				.delete()
				.eq('trip_id', TRIP_ID)
				.eq('user_id', userId);
			if (error) throw error;
			await queryClient.invalidateQueries({ queryKey: ['chat-messages', TRIP_ID, userId] });
		} catch {
			addToast('Failed to clear chat');
		} finally {
			isClearing = false;
			showClearConfirm = false;
		}
	}

	const allMessages = $derived([
		...(messagesQuery.data ?? []),
		...(isStreaming && (streamingContent || streamingAction || streamingDayCard || streamingPlaces)
			? [{
				id: 'streaming',
				role: 'assistant',
				content: streamingContent,
				created_at: new Date().toISOString(),
				trip_id: TRIP_ID,
				user_id: null,
				metadata: (() => {
					const meta: Record<string, unknown> = {};
					if (streamingAction) Object.assign(meta, streamingAction);
					if (streamingDayCard) meta.day_data = streamingDayCard;
					if (streamingPlaces) {
						meta.places_data = streamingPlaces.places;
						meta.places_context = { day_number: streamingPlaces.dayNumber };
					}
					return Object.keys(meta).length > 0 ? meta : null;
				})()
			} satisfies ChatMessage & { metadata: Record<string, unknown> | null }]
			: [])
	]);

	// Auto-scroll when messages change
	$effect(() => {
		// Track dependencies
		allMessages.length;
		streamingContent;
		// Scroll after render
		if (scrollContainer) {
			requestAnimationFrame(() => {
				scrollContainer!.scrollTop = scrollContainer!.scrollHeight;
			});
		}
	});

	const starterQuestions = [
		'Best restaurants in Phoenix?',
		'Grand Canyon sunrise tips?',
		'Vegas shows worth seeing?',
		'Hidden gems in Death Valley?',
		'Must-do in San Francisco?',
		'Joshua Tree hiking trails?'
	];

	async function sendMessage(text?: string) {
		const message = (text ?? inputValue).trim();
		if (!message || isStreaming) return;

		inputValue = '';
		isStreaming = true;
		streamingContent = '';
		streamingAction = null;
		streamingDayCard = null;
		streamingPlaces = null;

		// Optimistically add user message to cache
		const optimisticUserMsg: ChatMessage = {
			id: `optimistic-${Date.now()}`,
			trip_id: TRIP_ID,
			user_id: userId ?? null,
			role: 'user',
			content: message,
			created_at: new Date().toISOString(),
			metadata: null
		};

		queryClient.setQueryData(
			['chat-messages', TRIP_ID, userId],
			(old: ChatMessage[] | undefined) => [...(old ?? []), optimisticUserMsg]
		);

		try {
			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message })
			});

			if (!response.ok) {
				const err = await response.json();
				throw new Error(err.error || 'Failed to send message');
			}

			const reader = response.body?.getReader();
			if (!reader) throw new Error('No response stream');

			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() ?? '';

				for (const line of lines) {
					if (!line.startsWith('data: ')) continue;
					const data = line.slice(6);

					if (data === '[DONE]') break;

					try {
						const parsed = JSON.parse(data);
						if (parsed.error) throw new Error(parsed.error);
						if (parsed.delta) {
							streamingContent += parsed.delta;
						}
						if (parsed.action) {
							streamingAction = parsed.action as ActionMetadata;
						}
						if (parsed.dayCard) {
							streamingDayCard = parsed.dayCard;
						}
						if (parsed.places) {
							streamingPlaces = {
								places: parsed.places as PlaceDetails[],
								dayNumber: parsed.placesContext?.day_number
							};
						}
					} catch (e) {
						if (e instanceof SyntaxError) continue;
						throw e;
					}
				}
			}

			// Refresh from DB to get server-generated IDs
			await queryClient.invalidateQueries({ queryKey: ['chat-messages', TRIP_ID, userId] });
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Something went wrong';
			addToast(msg);
			// Revert optimistic update
			await queryClient.invalidateQueries({ queryKey: ['chat-messages', TRIP_ID, userId] });
		} finally {
			isStreaming = false;
			streamingContent = '';
			streamingAction = null;
			streamingDayCard = null;
			streamingPlaces = null;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}

	function handleActionStatusChange() {
		queryClient.invalidateQueries({ queryKey: ['chat-messages', TRIP_ID, userId] });
		queryClient.invalidateQueries({ queryKey: ['activities'] });
		queryClient.invalidateQueries({ queryKey: ['days-with-activities'] });
		queryClient.invalidateQueries({ queryKey: ['checklists'] });
		// Sync status change to family chat view
		queryClient.invalidateQueries({ queryKey: ['group-messages', TRIP_ID] });
	}

	// Track which messages have been shared to family chat
	const sharedMessagesQuery = createQuery(() => ({
		queryKey: ['shared-guide-messages', TRIP_ID, userId],
		enabled: !!userId,
		queryFn: async () => {
			const { data } = await supabase
				.from('group_messages')
				.select('shared_from_message_id')
				.eq('trip_id', TRIP_ID)
				.eq('user_id', userId!)
				.not('shared_from_message_id', 'is', null);
			return new Set((data ?? []).map((m) => m.shared_from_message_id));
		}
	}));

	const sharedMessageIds = $derived(sharedMessagesQuery.data ?? new Set<string | null>());

	// Fetch family feedback (reactions) for shared suggestions
	const familyFeedbackQuery = createQuery(() => ({
		queryKey: ['family-feedback', TRIP_ID, userId],
		enabled: !!userId && sharedMessageIds.size > 0,
		queryFn: async () => {
			// Get group messages that were shared from this user's guide chat
			const { data: groupMsgs } = await supabase
				.from('group_messages')
				.select('id, shared_from_message_id')
				.eq('trip_id', TRIP_ID)
				.eq('user_id', userId!)
				.not('shared_from_message_id', 'is', null);

			if (!groupMsgs || groupMsgs.length === 0) return new Map<string, FamilyFeedback>();

			const groupMsgIds = groupMsgs.map((m) => m.id);

			// Fetch reactions for these group messages
			const { data: reactions } = await supabase
				.from('message_reactions')
				.select('message_id, emoji, user_id')
				.in('message_id', groupMsgIds);

			// Fetch member names
			const { data: members } = await supabase
				.from('trip_members')
				.select('user_id, display_name')
				.eq('trip_id', TRIP_ID);

			const memberNames = new Map((members ?? []).map((m) => [m.user_id, m.display_name]));

			// Build feedback map: chatMessageId -> FamilyFeedback
			const feedbackMap = new Map<string, FamilyFeedback>();

			for (const gm of groupMsgs) {
				const chatMsgId = gm.shared_from_message_id;
				if (!chatMsgId) continue;

				const msgReactions = (reactions ?? []).filter((r) => r.message_id === gm.id);

				if (msgReactions.length === 0) continue;

				// Individual reactions with names
				const reactionsList = msgReactions.map((r) => ({
					emoji: r.emoji,
					memberName: memberNames.get(r.user_id) ?? 'Someone'
				}));

				// Summarized by emoji
				const emojiCounts = new Map<string, number>();
				for (const r of msgReactions) {
					emojiCounts.set(r.emoji, (emojiCounts.get(r.emoji) ?? 0) + 1);
				}
				const summary = [...emojiCounts.entries()].map(([emoji, count]) => ({ emoji, count }));

				feedbackMap.set(chatMsgId, { reactions: reactionsList, reactionSummary: summary });
			}

			return feedbackMap;
		}
	}));

	const familyFeedback = $derived(familyFeedbackQuery.data ?? new Map<string, FamilyFeedback>());

	async function shareToFamily(messageId: string, metadata: ActionMetadata) {
		if (!userId) return;
		const { error } = await supabase
			.from('group_messages')
			.insert({
				trip_id: TRIP_ID,
				user_id: userId,
				content: getShareDescription(metadata),
				shared_from_message_id: messageId,
				shared_action_metadata: metadata as unknown as Record<string, unknown>
			});
		if (error) {
			addToast('Failed to share to family chat');
			return;
		}
		addToast('Shared to Family Chat!');
		queryClient.invalidateQueries({ queryKey: ['shared-guide-messages', TRIP_ID, userId] });
		queryClient.invalidateQueries({ queryKey: ['family-feedback', TRIP_ID, userId] });
	}

	function getShareDescription(meta: ActionMetadata): string {
		if (meta.action === 'create_activity') {
			return `What do you think about "${meta.payload.title}" for Day ${meta.payload.day_number}?`;
		} else if (meta.action === 'add_packing_item') {
			return `Should we add "${meta.payload.label}" to our ${meta.payload.checklist_type} list?`;
		} else {
			return `Check out this suggestion from my Local Guide!`;
		}
	}

	function renderMarkdown(text: string): string {
		return text
			// Bold
			.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
			// Links
			.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-primary-600 underline">$1</a>')
			// Unordered lists
			.replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
			// Numbered lists
			.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
			// Line breaks
			.replace(/\n\n/g, '</p><p class="mt-2">')
			.replace(/\n/g, '<br>')
			// Wrap in paragraph
			.replace(/^/, '<p>')
			.replace(/$/, '</p>');
	}

	function getMessageMetadata(msg: ChatMessage & { metadata?: unknown }): ActionMetadata | null {
		if (!msg.metadata) return null;
		const m = msg.metadata as ActionMetadata;
		if (m.action && m.status) return m;
		return null;
	}

	function getMessageDayCard(msg: ChatMessage & { metadata?: unknown }): Record<string, unknown> | null {
		if (!msg.metadata) return null;
		const m = msg.metadata as Record<string, unknown>;
		return (m.day_data as Record<string, unknown>) ?? null;
	}

	function getMessagePlaces(msg: ChatMessage & { metadata?: unknown }): { places: PlaceDetails[]; dayNumber?: number } | null {
		if (!msg.metadata) return null;
		const m = msg.metadata as Record<string, unknown>;
		const places = m.places_data as PlaceDetails[] | undefined;
		if (!places || places.length === 0) return null;
		const ctx = m.places_context as { day_number?: number } | undefined;
		return { places, dayNumber: ctx?.day_number };
	}

	async function handlePlacesQuickAdd(metadata: ActionMetadata) {
		if (!userId) return;
		const payload = (metadata as any).payload;
		const description = `I'd like to add **${payload.title}** to Day ${payload.day_number}. Shall I go ahead?`;
		const { error } = await supabase
			.from('chat_messages')
			.insert({
				trip_id: TRIP_ID,
				user_id: userId,
				role: 'assistant',
				content: description,
				metadata: metadata as unknown as Record<string, unknown>
			});

		if (error) {
			addToast('Failed to prepare action');
			return;
		}

		await queryClient.invalidateQueries({ queryKey: ['chat-messages', TRIP_ID, userId] });
	}
</script>

<div class="flex h-full flex-col">
	<!-- Messages area -->
	<div bind:this={scrollContainer} class="flex-1 overflow-y-auto px-4 py-4">
		{#if allMessages.length > 0 && !isStreaming}
			<div class="mb-3 flex justify-center">
				{#if showClearConfirm}
					<div class="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
						<span class="text-xs text-slate-500">Clear all messages?</span>
						<button
							onclick={clearChat}
							disabled={isClearing}
							class="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-600 transition-all active:scale-95 disabled:opacity-50"
						>
							{isClearing ? 'Clearing...' : 'Clear'}
						</button>
						<button
							onclick={() => showClearConfirm = false}
							class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500 transition-all active:scale-95"
						>
							Cancel
						</button>
					</div>
				{:else}
					<button
						onclick={() => showClearConfirm = true}
						class="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-400 shadow-sm transition-all hover:border-slate-300 hover:text-slate-600 active:scale-95"
					>
						<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
						</svg>
						New chat
					</button>
				{/if}
			</div>
		{/if}

		{#if messagesQuery.isLoading}
			<div class="space-y-3">
				{#each Array(3) as _}
					<Skeleton class="h-12 w-3/4" />
					<Skeleton class="ml-auto h-10 w-2/3" />
				{/each}
			</div>
		{:else if allMessages.length === 0}
			<!-- Welcome state -->
			<div class="flex h-full flex-col items-center justify-center text-center">
				<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-100 to-amber-100">
					<svg class="h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
					</svg>
				</div>
				<h2 class="text-lg font-bold text-slate-900">Your Local Guide</h2>
				<p class="mt-1 max-w-xs text-sm text-slate-500">
					Ask me anything about your trip destinations. I know these places inside and out!
				</p>
				<div class="mt-6 flex flex-wrap justify-center gap-2">
					{#each starterQuestions as question}
						<button
							onclick={() => sendMessage(question)}
							class="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-all hover:border-primary-300 hover:text-primary-700 active:scale-95"
						>
							{question}
						</button>
					{/each}
				</div>
			</div>
		{:else}
			<!-- Message list -->
			<div class="space-y-3">
				{#each allMessages as msg (msg.id)}
					{#if msg.role === 'user'}
						<div class="flex justify-end">
							<div class="max-w-[80%] rounded-2xl rounded-br-md bg-primary-600 px-4 py-2.5 text-sm text-white shadow-sm">
								{msg.content}
							</div>
						</div>
					{:else}
						{@const actionMeta = getMessageMetadata(msg)}
						<div class="flex justify-start">
							<div class="max-w-[80%] rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm">
								{#if msg.id === 'streaming' && !streamingContent && !streamingAction && !streamingDayCard && !streamingPlaces}
									<div class="flex gap-1">
										<span class="h-2 w-2 animate-bounce rounded-full bg-slate-300" style="animation-delay: 0ms"></span>
										<span class="h-2 w-2 animate-bounce rounded-full bg-slate-300" style="animation-delay: 150ms"></span>
										<span class="h-2 w-2 animate-bounce rounded-full bg-slate-300" style="animation-delay: 300ms"></span>
									</div>
								{:else}
									{#if msg.content}
										<!-- eslint-disable-next-line svelte/no-at-html-tags -->
										{@html renderMarkdown(msg.content)}
									{/if}
									{#if actionMeta}
										<ActionCard
											metadata={actionMeta}
											messageId={msg.id}
											onStatusChange={handleActionStatusChange}
											onShare={shareToFamily}
											isShared={sharedMessageIds.has(msg.id)}
											familyFeedback={familyFeedback.get(msg.id) ?? null}
										/>
									{/if}
									{@const dayCard = getMessageDayCard(msg)}
									{@const placesData = getMessagePlaces(msg)}
									{#if dayCard}
										<DayDetailCard data={dayCard} />
									{/if}
									{#if placesData}
										<PlacesCarousel
											places={placesData.places}
											dayNumber={placesData.dayNumber}
											onQuickAdd={handlePlacesQuickAdd}
										/>
									{/if}
								{/if}
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
					placeholder="Ask about your trip..."
					disabled={isStreaming}
					rows={1}
					class="min-h-[40px] max-h-[120px] flex-1 resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm transition-all placeholder:text-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-50"
				></textarea>
				<button
					onclick={() => sendMessage()}
					disabled={!inputValue.trim() || isStreaming}
					class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm transition-all hover:bg-primary-700 active:scale-95 disabled:opacity-40"
				>
					{#if isStreaming}
						<svg class="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
					{:else}
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
						</svg>
					{/if}
				</button>
			</div>
		</div>
	{/if}
</div>
