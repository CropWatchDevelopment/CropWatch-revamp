<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { Device } from '$lib/Interfaces/device.interface';
	import type { Facility } from '$lib/Interfaces/facility.interface';
	import type { Location } from '$lib/Interfaces/location.interface';

	// Svelte 5 only: use $props to access props

	let {
		facilities,
		locationsForFacility,
		devices,
		selectedFacilityId = $bindable(),
		selectedLocationId = $bindable(),
		total,
		offline,
		alerts
	} = $props<{
		facilities: Facility[];
		locationsForFacility: Location[];
		devices: Device[];
		selectedLocationId: string | 'all';
		selectedFacilityId: string | 'all';
		total: number;
		offline: number;
		alerts: number;
	}>();

	let search: string = $state('');
	let viewportWidth = $state(1280);
	let isMobileDrawerOpen = $state(false);
	let isCollapsed = $state(false);
	let peekOpen = $state(false);
	let currentViewport: 'mobile' | 'tablet' | 'desktop' = 'desktop';

	const isMobile = $derived(viewportWidth < 768);
	const shouldShowLabels = $derived(!isCollapsed || isMobile || peekOpen);
	const sidebarWidth = $derived(() => {
		if (isMobile) return 288;
		return !isCollapsed || peekOpen ? 320 : 84;
	});

	function determineViewport(width: number): 'mobile' | 'tablet' | 'desktop' {
		if (width < 768) return 'mobile';
		if (width < 1280) return 'tablet';
		return 'desktop';
	}

	function applyViewportDefaults(mode: 'mobile' | 'tablet' | 'desktop') {
		if (mode === 'mobile') {
			isCollapsed = false;
			isMobileDrawerOpen = false;
		} else if (mode === 'tablet') {
			isCollapsed = true;
			isMobileDrawerOpen = false;
		} else {
			isCollapsed = false;
		}
	}

	function handleResize(width: number) {
		viewportWidth = width;
		const mode = determineViewport(width);
		if (mode !== currentViewport) {
			currentViewport = mode;
			applyViewportDefaults(mode);
		}
	}

	function closeMobileDrawer() {
		isMobileDrawerOpen = false;
	}

	function toggleCollapse() {
		if (isMobile) {
			isMobileDrawerOpen = !isMobileDrawerOpen;
			return;
		}
		isCollapsed = !isCollapsed;
	}

	function handleMouseEnter() {
		if (!isMobile && isCollapsed) {
			peekOpen = true;
		}
	}

	function handleMouseLeave() {
		if (!isMobile) {
			peekOpen = false;
		}
	}

	onMount(() => {
		if (typeof window === 'undefined') return;
		currentViewport = determineViewport(window.innerWidth);
		handleResize(window.innerWidth);

		const resizeHandler = () => handleResize(window.innerWidth);
		const globalToggle = () => {
			if (isMobile) {
				isMobileDrawerOpen = !isMobileDrawerOpen;
			} else {
				isCollapsed = !isCollapsed;
			}
		};
		const escHandler = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				closeMobileDrawer();
			}
		};

		window.addEventListener('resize', resizeHandler, { passive: true });
		window.addEventListener('sidebar:toggle', globalToggle);
		window.addEventListener('keydown', escHandler);

		return () => {
			window.removeEventListener('resize', resizeHandler);
			window.removeEventListener('sidebar:toggle', globalToggle);
			window.removeEventListener('keydown', escHandler);
		};
	});

	onDestroy(() => {
		closeMobileDrawer();
		peekOpen = false;
	});
</script>

<!-- Responsive sidebar -->
<div class="relative h-full bg-slate-900/75">
	{#if isMobile && isMobileDrawerOpen}
		<button
			type="button"
			class="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm md:hidden"
			onclick={closeMobileDrawer}
			aria-label="Close sidebar overlay"
		></button>
	{/if}

	<aside
		onmouseenter={handleMouseEnter}
		onmouseleave={handleMouseLeave}
		class={`flex flex-col gap-4 border-r h-full border-slate-800 bg-slate-900/75 p-4 transition-all duration-200 ease-in-out ${
			isMobile
				? `fixed inset-y-0 left-0 z-40 transform shadow-2xl shadow-black/40 ${
						isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
					}`
				: 'relative'
		}`}
		style={`width:${sidebarWidth}px;`}
	>
		<div class="flex items-center justify-between gap-2">
			<span
				class={`${
					shouldShowLabels
						? 'text-xs font-semibold uppercase tracking-wide text-slate-400'
						: 'sr-only'
				}`}
			>
				Navigation
			</span>
			<button
				onclick={toggleCollapse}
				class={`inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 text-xs text-slate-200 transition hover:bg-slate-800 ${
					isMobile ? 'md:hidden' : ''
				}`}
				aria-label={isMobile
					? isMobileDrawerOpen
						? 'Close sidebar'
						: 'Open sidebar'
					: isCollapsed
						? 'Expand sidebar'
						: 'Collapse sidebar'}
			>
				{#if isMobile}
					{isMobileDrawerOpen ? '×' : '☰'}
				{:else}
					{isCollapsed ? '≫' : '≪'}
				{/if}
			</button>
		</div>

		<div>
			<h2
				class={`${
					shouldShowLabels
						? 'text-xs font-semibold uppercase tracking-wide text-slate-400'
						: 'sr-only'
				}`}
			>
				Global search
			</h2>
			<div
				class={`mt-2 flex items-center gap-2 rounded-xl bg-slate-900 ring-1 ring-slate-700/70 ${
					shouldShowLabels ? 'px-3 py-2' : 'justify-center px-2 py-2'
				}`}
			>
				<span class="text-sm text-slate-400">⌕</span>
				{#if shouldShowLabels}
					<input
						bind:value={search}
						class="flex-1 border-none bg-transparent text-sm outline-none placeholder:text-slate-500"
						placeholder="Search facility, location, device, ID…"
					/>
				{/if}
			</div>
		</div>

		<div class="space-y-3">
			<div>
				<h2
					class={`${
						shouldShowLabels
							? 'text-xs font-semibold uppercase tracking-wide text-slate-400'
							: 'sr-only'
					}`}
				>
					Facilities
				</h2>
				<div class="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1 text-sm">
					<button
						onclick={() => {
							selectedFacilityId = 'all';
							selectedLocationId = 'all';
						}}
						class={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-800/70 ${
							selectedFacilityId === 'all' ? 'bg-slate-800' : ''
						}`}
					>
						<span class="flex items-center gap-2">
							<span
								class="inline-flex h-5 w-5 items-center justify-center rounded-md bg-slate-800 text-[10px] text-slate-300 ring-1 ring-slate-700/60"
							>
								all
							</span>
							<span class={shouldShowLabels ? '' : 'sr-only'}>All facilities</span>
						</span>
						<span class={`text-xs text-slate-500 ${shouldShowLabels ? '' : 'sr-only'}`}>
							{devices?.length}
						</span>
					</button>

					{#each facilities as f (f.id)}
						{@const count = devices.filter((d: Device) => d.facilityId === f.id).length}
						{@const hasAlert = devices.some((d: Device) => d.facilityId === f.id && d.hasAlert)}
						<button
							onclick={() => {
								selectedFacilityId = f.id;
								selectedLocationId = 'all';
							}}
							class={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-800/70 ${
								selectedFacilityId === f.id ? 'bg-slate-800' : ''
							}`}
						>
							<span class="flex items-center gap-2">
								<span
									class="inline-flex h-5 w-8 items-center justify-center rounded-md bg-slate-900 text-[10px] font-semibold tracking-tight text-slate-200 ring-1 ring-slate-700/70"
								>
									{f.code}
								</span>
								<span class={`${shouldShowLabels ? 'truncate' : 'sr-only'}`} title={f.name}>
									{f.name}
								</span>
							</span>
							<span
								class={`flex items-center gap-1 text-xs text-slate-500 ${shouldShowLabels ? '' : 'sr-only'}`}
							>
								{#if hasAlert}
									<span class="inline-flex h-2 w-2 rounded-full bg-amber-400"></span>
								{/if}
								<span>{count}</span>
							</span>
						</button>
					{/each}
				</div>
			</div>

			<div>
				<h2
					class={`${
						shouldShowLabels
							? 'text-xs font-semibold uppercase tracking-wide text-slate-400'
							: 'sr-only'
					}`}
				>
					Locations
				</h2>
				<div class="mt-2 max-h-52 space-y-1 overflow-y-auto pr-1 text-sm">
					<button
						onclick={() => (selectedLocationId = 'all')}
						class={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-800/70 ${
							selectedLocationId === 'all' ? 'bg-slate-800' : ''
						}`}
					>
						<span class={shouldShowLabels ? '' : 'sr-only'}>All locations</span>
						<span class={`text-xs text-slate-500 ${shouldShowLabels ? '' : 'sr-only'}`}>
							{devices?.length}
						</span>
					</button>

					{#each locationsForFacility as loc (loc.id)}
						{@const locDevices = devices.filter((d: Device) => d.locationId === loc.id)}
						{@const hasAlert = locDevices.some((d: Device) => d.hasAlert)}
						<span class="flex flex-row items-center group">
							<button
								onclick={() => (selectedLocationId = loc.id)}
								class={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-800/70 ${
									selectedLocationId === loc.id ? 'bg-slate-800' : ''
								}`}
							>
								<span class={`${shouldShowLabels ? 'truncate' : 'sr-only'}`} title={loc.name}>
									{loc.name}
								</span>
								<span
									class={`flex items-center gap-1 text-xs text-slate-500 ${
										shouldShowLabels ? '' : 'sr-only'
									}`}
								>
									{#if hasAlert}
										<span class="inline-flex h-2 w-2 rounded-full bg-amber-400"></span>
									{/if}
									<span>{locDevices.length}</span>
								</span>
							</button>
							<button class="hidden group-hover:flex px-1">⋮</button>
						</span>
					{/each}
				</div>
			</div>
		</div>

		<span class="flex-1"></span>

		<div class="mt-auto space-y-2 text-xs text-slate-500">
			<div class="flex items-center justify-between">
				<span class={shouldShowLabels ? '' : 'sr-only'}>Total in view</span>
				<span class={`font-mono text-slate-200 ${shouldShowLabels ? '' : 'sr-only'}`}>{total}</span>
			</div>
			<div class="flex items-center justify-between">
				<span class={shouldShowLabels ? '' : 'sr-only'}>Alerts</span>
				<span class={`font-mono text-amber-300 ${shouldShowLabels ? '' : 'sr-only'}`}>{alerts}</span
				>
			</div>
			<div class="flex items-center justify-between">
				<span class={shouldShowLabels ? '' : 'sr-only'}>Offline</span>
				<span class={`font-mono text-rose-300 ${shouldShowLabels ? '' : 'sr-only'}`}>{offline}</span
				>
			</div>
		</div>
	</aside>
</div>
