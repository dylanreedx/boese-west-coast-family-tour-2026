<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import type { SupabaseClient } from '@supabase/supabase-js';

	let {
		title = 'West Coast Trip 2026',
		supabase,
		userEmail
	}: {
		title?: string;
		supabase?: SupabaseClient;
		userEmail?: string | null;
	} = $props();

	let showMenu = $state(false);

	async function signOut() {
		if (!supabase) return;
		await supabase.auth.signOut();
		await invalidate('supabase:auth');
		goto('/auth');
	}
</script>

<header class="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-lg">
	<div class="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
		<div class="flex items-center gap-2">
			<span class="text-lg">🚗</span>
			<h1 class="text-lg font-bold tracking-tight text-slate-900">{title}</h1>
		</div>

		{#if userEmail}
			<div class="relative">
				<button
					onclick={() => showMenu = !showMenu}
					class="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700 transition-all hover:bg-primary-200"
					aria-label="User menu"
				>
					{userEmail[0].toUpperCase()}
				</button>

				{#if showMenu}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="fixed inset-0 z-50" onclick={() => showMenu = false}>
						<div
							class="absolute right-4 top-14 w-56 rounded-xl bg-white p-2 shadow-lg ring-1 ring-slate-200"
							onclick={(e) => e.stopPropagation()}
						>
							<p class="truncate px-3 py-2 text-xs text-slate-400">{userEmail}</p>
							<button
								onclick={signOut}
								class="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
							>
								Sign out
							</button>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</header>
