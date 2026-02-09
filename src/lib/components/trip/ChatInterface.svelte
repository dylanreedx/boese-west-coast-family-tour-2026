<script lang="ts">
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import type { SupabaseClient } from '@supabase/supabase-js';
	import type { Database } from '$lib/types/database';
	import type { ChatMessage, ActionMetadata } from '$lib/types/app';
	import { TRIP_ID } from '$lib/types/app';
	import { addToast } from '$lib/stores/toasts.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import ActionCard from '$lib/components/trip/ActionCard.svelte';

	let {
		supabase,
		userId
	}: {
		supabase: SupabaseClient<Database>;
		userId?: string | null;
	} = $props();

	const queryClient = useQueryClient();

	const messagesQuery = createQuery(() => ({
		queryKey: ['chat-messages', TRIP_ID],
		queryFn: async () => {
			const { data, error } = await supabase
				.from('chat_messages')
				.select('*')
				.eq('trip_id', TRIP_ID)
				.order('created_at');
			if (error) throw error;
			return data as ChatMessage[];
		}
	}));

	let inputValue = $state('');
	let isStreaming = $state(false);
	let streamingContent = $state('');
	let streamingAction = $state<ActionMetadata | null>(null);
	let scrollContainer: HTMLDivElement | undefined = $state();

	const allMessages = $derived([
		...(messagesQuery.data ?? []),
		...(isStreaming && (streamingContent || streamingAction)
			? [{
				id: 'streaming',
				role: 'assistant',
				content: streamingContent,
				created_at: new Date().toISOString(),
				trip_id: TRIP_ID,
				user_id: null,
				metadata: streamingAction
			} satisfies ChatMessage & { metadata: ActionMetadata | null }]
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
			['chat-messages', TRIP_ID],
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
					} catch (e) {
						if (e instanceof SyntaxError) continue;
						throw e;
					}
				}
			}

			// Refresh from DB to get server-generated IDs
			await queryClient.invalidateQueries({ queryKey: ['chat-messages', TRIP_ID] });
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Something went wrong';
			addToast(msg);
			// Revert optimistic update
			await queryClient.invalidateQueries({ queryKey: ['chat-messages', TRIP_ID] });
		} finally {
			isStreaming = false;
			streamingContent = '';
			streamingAction = null;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}

	function handleActionStatusChange() {
		queryClient.invalidateQueries({ queryKey: ['chat-messages', TRIP_ID] });
		queryClient.invalidateQueries({ queryKey: ['activities'] });
		queryClient.invalidateQueries({ queryKey: ['days-with-activities'] });
		queryClient.invalidateQueries({ queryKey: ['checklists'] });
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
</script>

<div class="flex h-full flex-col">
	<!-- Messages area -->
	<div bind:this={scrollContainer} class="flex-1 overflow-y-auto px-4 py-4">
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
								{#if msg.id === 'streaming' && !streamingContent && !streamingAction}
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
