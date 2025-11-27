<script lang="ts">
	let { form } = $props<{
		form: { message?: string } | null;
	}>();
</script>

<main class="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
	<div class="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
		<h1 class="text-lg font-semibold text-slate-50">Sign in</h1>
		<p class="mt-1 text-sm text-slate-400">Use your email and password to continue.</p>

		{#if form?.message}
			<p class="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
				{form.message}
			</p>
		{/if}

		<form method="POST" class="mt-4 space-y-4">
			<label class="block text-sm text-slate-300">
				<span class="mb-1 block text-xs uppercase tracking-wide text-slate-400">Email</span>
				<input
					name="email"
					type="email"
					required
					class="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
					placeholder="you@example.com"
					autocomplete="email"
				/>
			</label>

			<label class="block text-sm text-slate-300">
				<span class="mb-1 block text-xs uppercase tracking-wide text-slate-400">Password</span>
				<input
					name="password"
					type="password"
					required
					class="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
					placeholder="••••••••"
					autocomplete="current-password"
				/>
			</label>

			<button
				type="submit"
				class="w-full rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
			>
				Sign in
			</button>
		</form>
	</div>
</main>
