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

	// Lock body scroll when sheet is open
	$effect(() => {
		if (open) {
			document.body.style.overflow = 'hidden';
			return () => {
				document.body.style.overflow = '';
			};
		}
	});

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
		class="fixed inset-0 z-[60] overflow-hidden bg-black/40 backdrop-blur-sm transition-opacity md:flex md:items-center md:justify-center md:p-6"
		onclick={handleBackdropClick}
	>
		<!-- Sheet (mobile) / Dialog (desktop) -->
		<div
			class="absolute bottom-0 left-0 right-0 flex max-h-[90dvh] flex-col rounded-t-2xl bg-white shadow-2xl md:relative md:bottom-auto md:left-auto md:right-auto md:w-full md:max-w-lg md:max-h-[85vh] md:rounded-2xl"
			style="animation: slideUp 0.3s ease-out"
		>
			<!-- Header -->
			<div class="shrink-0 px-4 pb-2 pt-3">
				<!-- Drag handle (mobile only) -->
				<div class="mx-auto h-1 w-10 rounded-full bg-slate-300 md:hidden"></div>
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

			<!-- Content (scrollable) -->
			<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8" style="padding-bottom: max(2rem, env(safe-area-inset-bottom))">
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

	@media (min-width: 768px) {
		@keyframes slideUp {
			from { opacity: 0; transform: scale(0.95); }
			to { opacity: 1; transform: scale(1); }
		}
	}
</style>
