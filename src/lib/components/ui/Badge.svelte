<script lang="ts">
	import type { ActivityStatus } from '$lib/types/app';
	import { STATUS_COLORS, STATUS_LABELS } from '$lib/utils/activity-icons';

	let { status, size = 'sm' }: { status: ActivityStatus; size?: 'sm' | 'md' } = $props();

	const colors = $derived(STATUS_COLORS[status]);
	const label = $derived(STATUS_LABELS[status]);
</script>

<span
	class="{colors.bg} {colors.text} {colors.border} inline-flex items-center rounded-full border font-medium
		{size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'}"
>
	{label}
</span>
