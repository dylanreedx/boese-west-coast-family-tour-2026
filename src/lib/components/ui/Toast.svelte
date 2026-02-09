<script lang="ts">
	import { toasts, dismissToast } from '$lib/stores/toasts.svelte';
</script>

{#if toasts.items.length > 0}
	<div class="fixed left-4 right-4 top-16 z-50 flex flex-col gap-2">
		{#each toasts.items as toast (toast.id)}
			<div
				class="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-sm text-white shadow-lg"
				style="animation: slideDown 0.3s ease-out"
			>
				<span class="flex-1">{toast.message}</span>
				<button
					onclick={() => dismissToast(toast.id)}
					class="text-slate-400 hover:text-white"
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		{/each}
	</div>
{/if}

<style>
	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-12px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
