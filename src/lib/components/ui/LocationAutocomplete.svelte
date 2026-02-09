<script lang="ts">
	let {
		value = $bindable(''),
		suggestions = [],
		id = '',
		placeholder = 'Where is it?'
	}: {
		value: string;
		suggestions: string[];
		id?: string;
		placeholder?: string;
	} = $props();

	let showDropdown = $state(false);
	let highlightIndex = $state(-1);
	let inputEl = $state<HTMLInputElement | null>(null);

	const filtered = $derived.by(() => {
		const q = value.toLowerCase().trim();
		const matches = q
			? suggestions.filter((s) => s.toLowerCase().includes(q))
			: suggestions;
		return matches.slice(0, 8);
	});

	function selectItem(item: string) {
		value = item;
		showDropdown = false;
		highlightIndex = -1;
	}

	function handleFocus() {
		showDropdown = true;
		highlightIndex = -1;
	}

	function handleBlur() {
		// Delay so mousedown on dropdown item fires first
		setTimeout(() => {
			showDropdown = false;
			highlightIndex = -1;
		}, 150);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!showDropdown || filtered.length === 0) {
			if (e.key === 'ArrowDown') {
				showDropdown = true;
				highlightIndex = 0;
				e.preventDefault();
			}
			return;
		}

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				highlightIndex = (highlightIndex + 1) % filtered.length;
				break;
			case 'ArrowUp':
				e.preventDefault();
				highlightIndex = highlightIndex <= 0 ? filtered.length - 1 : highlightIndex - 1;
				break;
			case 'Enter':
				e.preventDefault();
				if (highlightIndex >= 0 && highlightIndex < filtered.length) {
					selectItem(filtered[highlightIndex]);
				}
				break;
			case 'Escape':
				showDropdown = false;
				highlightIndex = -1;
				break;
		}
	}
</script>

<div class="relative">
	<input
		bind:this={inputEl}
		{id}
		bind:value
		{placeholder}
		autocomplete="off"
		onfocus={handleFocus}
		onblur={handleBlur}
		onkeydown={handleKeydown}
		role="combobox"
		aria-expanded={showDropdown && filtered.length > 0}
		aria-autocomplete="list"
		aria-controls="{id}-listbox"
		class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-base md:text-sm transition-all focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
	/>

	{#if showDropdown && filtered.length > 0}
		<ul
			id="{id}-listbox"
			role="listbox"
			class="absolute left-0 right-0 z-50 mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
		>
			{#each filtered as item, i}
				<li
					role="option"
					aria-selected={i === highlightIndex}
					onmousedown={(e) => { e.preventDefault(); selectItem(item); }}
					onpointerenter={() => highlightIndex = i}
					class="cursor-pointer select-none px-4 py-2.5 text-sm transition-colors
						{i === highlightIndex ? 'bg-primary-50 text-primary-700' : 'text-slate-700 hover:bg-slate-50'}"
				>
					{item}
				</li>
			{/each}
		</ul>
	{/if}
</div>
