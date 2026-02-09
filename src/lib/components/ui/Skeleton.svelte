<script lang="ts">
	let { class: className = '' }: { class?: string } = $props();
</script>

<div class="animate-pulse rounded-lg bg-slate-200 {className}"></div>
