<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	let loading = $state(false);
</script>

<svelte:head>
	<title>Join Trip - Boese West Coast Trip</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-primary-50 to-white px-4">
	<div class="w-full max-w-sm">
		<!-- Logo / Title -->
		<div class="mb-8 text-center">
			<span class="text-5xl">🚗</span>
			<h1 class="mt-3 text-2xl font-extrabold text-slate-900">Join the Trip!</h1>
			<p class="mt-1 text-sm text-slate-500">Boese West Coast Road Trip 2026</p>
		</div>

		{#if !data.valid}
			<!-- Invalid code -->
			<div class="rounded-2xl bg-white p-6 shadow-sm">
				<div class="text-center">
					<span class="text-4xl">🚫</span>
					<h2 class="mt-3 text-lg font-bold text-slate-900">Invalid invite code</h2>
					<p class="mt-2 text-sm text-slate-500">
						The code <span class="font-mono font-medium text-slate-700">{data.code}</span> isn't valid. Check with your family for the right link.
					</p>
				</div>
				<a
					href="/auth"
					class="mt-4 block w-full rounded-xl bg-primary-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.98]"
				>
					Sign in instead
				</a>
			</div>
		{:else if form?.success}
			<!-- Success state -->
			<div class="rounded-2xl bg-white p-6 shadow-sm">
				<div class="text-center">
					<span class="text-4xl">📧</span>
					<h2 class="mt-3 text-lg font-bold text-slate-900">Check your email</h2>
					<p class="mt-2 text-sm text-slate-500">
						We sent a magic link to <span class="font-medium text-slate-700">{form.email}</span>.
						Click it to join the trip!
					</p>
				</div>
			</div>
		{:else}
			<!-- Join form -->
			<div class="rounded-2xl bg-white p-6 shadow-sm">
				<div class="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2">
					<svg class="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
					</svg>
					<span class="text-sm font-medium text-emerald-700">Valid invite code</span>
				</div>

				<h2 class="text-lg font-bold text-slate-900">Tell us who you are</h2>
				<p class="mt-1 text-sm text-slate-500">We'll send you a magic link to join.</p>

				<form
					method="POST"
					use:enhance={() => {
						loading = true;
						return async ({ update }) => {
							loading = false;
							await update();
						};
					}}
					class="mt-5 space-y-4"
				>
					<div>
						<label for="name" class="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">
							Your Name
						</label>
						<input
							id="name"
							name="name"
							type="text"
							required
							placeholder="e.g. Mom, Dad, Dylan..."
							value={form?.name ?? ''}
							class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm transition-all focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
						/>
					</div>

					<div>
						<label for="email" class="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">
							Email
						</label>
						<input
							id="email"
							name="email"
							type="email"
							required
							placeholder="you@example.com"
							value={form?.email ?? ''}
							class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm transition-all focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
						/>
					</div>

					{#if form?.error}
						<p class="text-sm text-rose-600">{form.error}</p>
					{/if}

					<button
						type="submit"
						disabled={loading}
						class="w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if loading}
							Sending link...
						{:else}
							Join the Trip
						{/if}
					</button>
				</form>
			</div>

			<p class="mt-6 text-center text-xs text-slate-400">
				Already have an account? <a href="/auth" class="text-primary-600 font-medium hover:underline">Sign in</a>
			</p>
		{/if}
	</div>
</div>
