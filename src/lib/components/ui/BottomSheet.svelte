<script lang="ts">
	import { tick } from 'svelte';

	let {
		open = $bindable(false),
		title = '',
		children
	}: {
		open: boolean;
		title?: string;
		children: import('svelte').Snippet;
	} = $props();

	function close() {
		open = false;
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			close();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity"
		onclick={handleBackdropClick}
	>
		<!-- Sheet -->
		<div
			class="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white shadow-2xl"
			style="animation: slideUp 0.3s ease-out"
		>
			<!-- Handle -->
			<div class="sticky top-0 z-10 bg-white px-4 pb-2 pt-3">
				<div class="mx-auto h-1 w-10 rounded-full bg-slate-300"></div>
				{#if title}
					<div class="mt-3 flex items-center justify-between">
						<h3 class="text-lg font-bold text-slate-900">{title}</h3>
						<button
							onclick={close}
							class="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
						>
							<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
				{/if}
			</div>

			<!-- Content -->
			<div class="px-4 pb-8">
				{@render children()}
			</div>
		</div>
	</div>
{/if}

<style>
	@keyframes slideUp {
		from { transform: translateY(100%); }
		to { transform: translateY(0); }
	}
</style>
