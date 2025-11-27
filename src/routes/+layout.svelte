<script lang="ts">
	import Header from '$lib/core/Header.svelte';
	import Sidebar from '$lib/core/Sidebar.svelte';
	import type { Device } from '$lib/Interfaces/device.interface';
	import type { Facility } from '$lib/Interfaces/facility.interface';
	import type { Location } from '$lib/Interfaces/location.interface';
	import './layout.css';
	import type { AppState } from '$lib/Interfaces/appState.interface';
	import { createAppState, provideAppState, useAppState } from '$lib/data/AppState.svelte';
	import { setContext } from 'svelte';

	let { data, children } = $props<{
		data: { facilities: Facility[]; locations: Location[]; devices: Device[] };
	}>();
	let appState = createAppState({
		facilities: data.facilities,
		locations: data.locations,
		devices: data.devices
	});

	provideAppState(appState);

	let selectedFacilityId = $state<string | 'all'>('all');
	let selectedLocationId = $state<string | 'all'>('all');

	// Share selection with child pages
	setContext('filters', {
		getFacility: () => selectedFacilityId,
		getLocation: () => selectedLocationId
	});

	const locationsForFacility = $derived(
		selectedFacilityId === 'all'
			? appState.locations
			: appState.locations.filter((l: Location) => l.facilityId === selectedFacilityId)
	);

	const total = $derived(appState.devices.length);
	const alerts = $derived(appState.devices.filter((d: Device) => d.hasAlert).length);
	const offline = $derived(appState.devices.filter((d: Device) => d.status === 'offline').length);
</script>

<div class="app flex min-h-screen flex-col bg-slate-950 text-slate-100">
	<div class="flex flex-1 flex-row overflow-hidden">
		<Sidebar
			facilities={appState.facilities}
			devices={appState.devices}
			{locationsForFacility}
			bind:selectedFacilityId
			bind:selectedLocationId
			{total}
			{alerts}
			{offline}
		/>
		<main class="flex-1 flex-col overflow-auto">
			<Header />
			{@render children()}
		</main>
	</div>
</div>
