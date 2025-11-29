<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import CWButton from '$lib/components/CWButton.svelte';
	import CWDialog from '$lib/components/CWDialog.svelte';
	import logo from '$lib/images/cropwatch_static.svg';
	import LOCK_ICON from '$lib/images/icons/lock.svg';
	import LOGOUT_ICON from '$lib/images/icons/logout.svg';

	function toggleSidebar() {
		if (typeof window === 'undefined') return;
		window.dispatchEvent(new CustomEvent('sidebar:toggle'));
	}

	async function logout() {
		loggingOutLoading = true;
		try {
			const res = await fetch(resolve('/api/public/logout'), {
				method: 'GET',
				credentials: 'include'
			});
			if (!res.ok) throw new Error(`Logout failed with ${res.status}`);
			await invalidateAll();
			logoutDialog = false;
			goto(resolve('/auth'));
			loggingOutLoading = false;
		} catch (error) {
			console.error('Logout failed:', error);
			loggingOutLoading = false;
		}
	}

	let logoutDialog: boolean = $state<boolean>(false);
	let loggingOutLoading: boolean = $state<boolean>(false);
</script>

<header
	class="flex items-center justify-between border-b border-slate-800 bg-slate-900/70 px-4 py-2"
>
	<div class="flex items-center gap-3">
		<button
			type="button"
			onclick={toggleSidebar}
			class="inline-flex h-14 w-14 items-center justify-center rounded-full border border-slate-700 text-slate-100 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 md:hidden"
			aria-label="Toggle sidebar"
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-5 w-5">
				<path d="M4 7h16M4 12h16M4 17h16" stroke-linecap="round" />
			</svg>
		</button>
		<div class="corner">
			<a href="/">
				<img src={logo} alt="CropWatch" />
			</a>
		</div>
	</div>

	<nav class="hidden md:flex">
		<svg viewBox="0 0 2 3" aria-hidden="true">
			<path d="M0,0 L1,2 C1.5,3 1.5,3 2,3 L2,0 Z" />
		</svg>
		<ul>
			<li aria-current={page.url.pathname === '/' ? 'page' : undefined}>
				<a href={resolve('/')}>Home</a>
			</li>
			<li aria-current={page.url.pathname.startsWith('/locations') ? 'page' : undefined}>
				<a href={resolve('/locations')}>Locations</a>
			</li>
		</ul>
		<svg viewBox="0 0 2 3" aria-hidden="true">
			<path d="M0,0 L0,3 C0.5,3 0.5,3 1,2 L2,0 Z" />
		</svg>
	</nav>

	<CWButton variant="secondary" onclick={() => (logoutDialog = true)}>
		<img src={LOCK_ICON} alt="Log out of account" class="h-4 w-4" />
		Log Out
	</CWButton>
</header>

<CWDialog
	open={logoutDialog}
	title="Log out"
	showCloseButton={true}
	closeOnBackdrop={true}
	closeOnEscape={true}
>
	<p class="mb-5">Are you sure you want to log out of your account?</p>

	<div class="flex justify-end gap-5">
		<button
			onclick={() => (logoutDialog = false)}
			class="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-700/60 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-700 hover:bg-slate-800"
		>
			<img src={LOCK_ICON} alt="Log out of account" class="h-4 w-4" />
			Stay Logged in
		</button>

		<CWButton variant="danger" loading={loggingOutLoading} onclick={() => logout()}>
			<img src={LOGOUT_ICON} alt="Log out of account" class="h-4 w-4" />
			Log Out
		</CWButton>
	</div>
</CWDialog>

<style>
	header {
		display: flex;
		justify-content: space-between;
	}

	.corner {
		width: 3em;
		height: 3em;
	}

	.corner a {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
	}

	.corner img {
		width: 2em;
		height: 2em;
		object-fit: contain;
	}

	nav {
		display: flex;
		justify-content: center;
		--background: rgba(52, 88, 250, 0.7);
	}

	svg {
		width: 2em;
		height: 3em;
		display: block;
	}

	path {
		fill: var(--background);
	}

	ul {
		position: relative;
		padding: 0;
		margin: 0;
		height: 3em;
		display: flex;
		justify-content: center;
		align-items: center;
		list-style: none;
		background: var(--background);
		background-size: contain;
	}

	li {
		position: relative;
		height: 100%;
	}

	li[aria-current='page']::before {
		--size: 6px;
		content: '';
		width: 0;
		height: 0;
		position: absolute;
		top: 0;
		left: calc(50% - var(--size));
		border: var(--size) solid transparent;
		border-top: var(--size) solid var(--color-theme-1);
	}

	nav a {
		display: flex;
		height: 100%;
		align-items: center;
		padding: 0 0.5rem;
		color: var(--color-text);
		font-weight: 700;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		text-decoration: none;
		transition: color 0.2s linear;
	}

	a:hover {
		color: var(--color-theme-1);
	}
</style>
