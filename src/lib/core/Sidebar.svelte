<script lang="ts">
	import type { Device } from "$lib/Interfaces/device.interface";
	import type { Facility } from "$lib/Interfaces/facility.interface";

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

	let search: string = $state<string>('');
</script>

<!-- Left rail: facility & location selector -->
<aside class="flex w-80 flex-col gap-4 border-r border-slate-800 bg-slate-950/70 p-4">
	<div>
		<h2 class="text-xs font-semibold uppercase tracking-wide text-slate-400">Global search</h2>
		<div
			class="mt-2 flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 ring-1 ring-slate-700/70"
		>
			<span class="text-sm text-slate-500">⌕</span>
			<input
				bind:value={search}
				class="flex-1 bg-transparent border-none text-sm outline-none placeholder:text-slate-500"
				placeholder="Search facility, location, device, ID…"
			/>
		</div>
	</div>

	<div class="space-y-3">
		<div>
			<h2 class="text-xs font-semibold uppercase tracking-wide text-slate-400">Facilities</h2>
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
						<span>All facilities</span>
					</span>
					<span class="text-xs text-slate-500">{devices?.length}</span>
				</button>

				{#each facilities as f (f.id)}
					{@const count = devices.filter((d) => d.facilityId === f.id).length}
					{@const hasAlert = devices.some((d) => d.facilityId === f.id && d.hasAlert)}

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
							<span class="truncate" title={f.name}>
								{f.name}
							</span>
						</span>
						<span class="flex items-center gap-1 text-xs text-slate-500">
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
			<h2 class="text-xs font-semibold uppercase tracking-wide text-slate-400">Locations</h2>
			<div class="mt-2 max-h-52 space-y-1 overflow-y-auto pr-1 text-sm">
				<button
					onclick={() => (selectedLocationId = 'all')}
					class={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-800/70 ${
						selectedLocationId === 'all' ? 'bg-slate-800' : ''
					}`}
				>
					<span>All locations</span>
					<span class="text-xs text-slate-500">{devices?.length}</span>
				</button>

				{#each locationsForFacility as loc (loc.id)}
					{@const locDevices = devices.filter((d) => d.locationId === loc.id)}
					{@const hasAlert = locDevices.some((d) => d.hasAlert)}

					<button
						onclick={() => (selectedLocationId = loc.id)}
						class={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-800/70 ${
							selectedLocationId === loc.id ? 'bg-slate-800' : ''
						}`}
					>
						<span class="truncate" title={loc.name}>
							{loc.name}
						</span>
						<span class="flex items-center gap-1 text-xs text-slate-500">
							{#if hasAlert}
								<span class="inline-flex h-2 w-2 rounded-full bg-amber-400"></span>
							{/if}
							<span>{locDevices.length}</span>
						</span>
					</button>
				{/each}
			</div>
		</div>
	</div>

	<div class="mt-auto space-y-2 text-xs text-slate-500">
		<div class="flex items-center justify-between">
			<span>Total in view</span>
			<span class="font-mono text-slate-200">{total}</span>
		</div>
		<div class="flex items-center justify-between">
			<span>Alerts</span>
			<span class="font-mono text-amber-300">{alerts}</span>
		</div>
		<div class="flex items-center justify-between">
			<span>Offline</span>
			<span class="font-mono text-rose-300">{offline}</span>
		</div>
	</div>
</aside>
