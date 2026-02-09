<script lang="ts">
	import { daysUntil } from '$lib/utils/date';

	let { startDate }: { startDate: string } = $props();

	const remaining = $derived(daysUntil(startDate));
	const isPast = $derived(remaining <= 0);
</script>

<div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 p-6 text-white shadow-lg">
	<div class="absolute -right-4 -top-4 text-8xl opacity-10">🌄</div>
	<div class="relative">
		{#if isPast}
			<p class="text-sm font-medium text-primary-200">Trip is underway!</p>
			<p class="mt-1 text-3xl font-extrabold">Let's go!</p>
		{:else}
			<p class="text-sm font-medium text-primary-200">Days until departure</p>
			<p class="mt-1 text-5xl font-extrabold tabular-nums">{remaining}</p>
			<p class="mt-2 text-sm text-primary-100">Detroit → Phoenix → Grand Canyon → Vegas → Death Valley → SF → Santa Monica → Joshua Tree</p>
		{/if}
	</div>
</div>
