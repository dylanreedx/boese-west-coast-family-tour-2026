<script lang="ts">
	import type { Activity } from '$lib/types/app';

	let { activities }: { activities: Activity[] } = $props();

	const gaps = $derived(
		activities
			.filter(a => a.status === 'tbd')
			.map(a => a.title)
	);
</script>

{#if gaps.length > 0}
	<div class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
		<div class="flex items-start gap-2">
			<span class="mt-0.5 text-amber-500">
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
				</svg>
			</span>
			<div>
				<p class="text-sm font-semibold text-amber-800">
					{gaps.length} item{gaps.length === 1 ? '' : 's'} need{gaps.length === 1 ? 's' : ''} planning
				</p>
				<p class="mt-0.5 text-xs text-amber-600">
					{gaps.slice(0, 3).join(', ')}{gaps.length > 3 ? ` + ${gaps.length - 3} more` : ''}
				</p>
			</div>
		</div>
	</div>
{/if}
