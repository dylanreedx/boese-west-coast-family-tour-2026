<script lang="ts">
	import { tick } from 'svelte';

	let {
		value = '',
		placeholder = 'Tap to edit...',
		onsave,
		multiline = false,
		editable = true,
		class: className = ''
	}: {
		value: string;
		placeholder?: string;
		onsave?: (value: string) => void;
		multiline?: boolean;
		editable?: boolean;
		class?: string;
	} = $props();

	let editing = $state(false);
	let draft = $state(value);
	let inputEl = $state<HTMLElement | null>(null);

	async function startEdit() {
		if (!editable) return;
		draft = value;
		editing = true;
		await tick();
		inputEl?.focus();
	}

	function save() {
		editing = false;
		if (draft.trim() !== value) {
			onsave?.(draft.trim());
		}
	}

	function cancel() {
		editing = false;
		draft = value;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !multiline) {
			e.preventDefault();
			save();
		}
		if (e.key === 'Escape') {
			cancel();
		}
	}
</script>

{#if editing}
	{#if multiline}
		<textarea
			bind:this={inputEl}
			bind:value={draft}
			onblur={save}
			onkeydown={handleKeydown}
			class="w-full resize-none rounded-lg border border-primary-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ring-2 ring-primary-100 transition-all focus:outline-none {className}"
			rows="3"
		></textarea>
	{:else}
		<input
			bind:this={inputEl}
			bind:value={draft}
			onblur={save}
			onkeydown={handleKeydown}
			class="w-full rounded-lg border border-primary-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm ring-2 ring-primary-100 transition-all focus:outline-none {className}"
		/>
	{/if}
{:else}
	<button
		onclick={startEdit}
		class="group/edit w-full text-left transition-all {className}
			{editable ? 'cursor-text hover:bg-slate-50 rounded-lg -mx-2 px-2 py-0.5' : 'cursor-default'}
			{!value ? 'text-slate-400 italic border-b border-dashed border-slate-300' : ''}"
	>
		{value || placeholder}
		{#if editable}
			<svg class="ml-1 inline h-3 w-3 text-slate-300 opacity-0 transition-opacity group-hover/edit:opacity-100" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
			</svg>
		{/if}
	</button>
{/if}
