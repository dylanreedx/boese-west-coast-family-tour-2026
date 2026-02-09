<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
	let loading = $state(false);
</script>

<svelte:head>
	<title>Sign In - Boese West Coast Trip</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-primary-50 to-white px-4">
	<div class="w-full max-w-sm">
		<!-- Logo / Title -->
		<div class="mb-8 text-center">
			<span class="text-5xl">🚗</span>
			<h1 class="mt-3 text-2xl font-extrabold text-slate-900">Boese West Coast Trip</h1>
			<p class="mt-1 text-sm text-slate-500">May 13-20, 2026</p>
		</div>

		{#if form?.success}
			<!-- Success state -->
			<div class="rounded-2xl bg-white p-6 shadow-sm">
				<div class="text-center">
					<span class="text-4xl">📧</span>
					<h2 class="mt-3 text-lg font-bold text-slate-900">Check your email</h2>
					<p class="mt-2 text-sm text-slate-500">
						We sent a magic link to <span class="font-medium text-slate-700">{form.email}</span>.
						Click it to sign in.
					</p>
				</div>
			</div>
		{:else}
			<!-- Sign in form -->
			<div class="rounded-2xl bg-white p-6 shadow-sm">
				<h2 class="text-lg font-bold text-slate-900">Sign in with email</h2>
				<p class="mt-1 text-sm text-slate-500">We'll send you a magic link — no password needed.</p>

				<form
					method="POST"
					use:enhance={() => {
						loading = true;
						return async ({ update }) => {
							loading = false;
							await update();
						};
					}}
					class="mt-5"
				>
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

					{#if form?.error}
						<p class="mt-2 text-sm text-rose-600">{form.error}</p>
					{/if}

					<button
						type="submit"
						disabled={loading}
						class="mt-4 w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if loading}
							Sending link...
						{:else}
							Send Magic Link
						{/if}
					</button>
				</form>
			</div>

			<p class="mt-6 text-center text-xs text-slate-400">
				Have an invite code? <a href="/join/BOESE2026" class="text-primary-600 font-medium hover:underline">Join the trip</a>
			</p>
		{/if}
	</div>
</div>
